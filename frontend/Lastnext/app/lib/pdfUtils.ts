"use client";
// ./app/lib/pdfUtils.ts
import { saveAs as fileSaverSaveAs } from 'file-saver';
export const isPdfBlob = async (blob: Blob): Promise<boolean> => {
  try {
    const header = await blob.slice(0, 5).text();
    return header.startsWith('%PDF-');
  } catch {
    return false;
  }
};

export const validatePdfBlob = async (blob: Blob): Promise<{ isValid: boolean; error?: string; warnings?: string[] }> => {
  const warnings: string[] = [];
  
  try {
    // Check if blob exists
    if (!blob) {
      return { isValid: false, error: 'PDF blob is null or undefined' };
    }
    
    // Check blob type
    if (!(blob instanceof Blob)) {
      return { isValid: false, error: 'Object is not a valid Blob instance' };
    }
    
    // Check size
    if (blob.size === 0) {
      return { isValid: false, error: 'PDF blob is empty (0 bytes)' };
    }
    
    if (blob.size < 100) {
      return { isValid: false, error: `PDF blob is too small (${blob.size} bytes) - minimum valid PDF is ~100 bytes` };
    }
    
    if (blob.size > 100 * 1024 * 1024) { // 100MB
      warnings.push(`PDF is very large (${Math.round(blob.size / 1024 / 1024)}MB) - may cause performance issues`);
    }
    
    // Check PDF header
    let header;
    try {
      header = await blob.slice(0, 8).text();
    } catch (error) {
      return { isValid: false, error: 'Cannot read PDF header - blob may be corrupted' };
    }
    
    if (!header.startsWith('%PDF-')) {
      return { isValid: false, error: `Invalid PDF header: "${header.substring(0, 5)}" - expected "%PDF-"` };
    }
    
    // Extract PDF version
    const versionMatch = header.match(/%PDF-(\d\.\d)/);
    if (versionMatch) {
      const version = parseFloat(versionMatch[1]);
      if (version < 1.0 || version > 2.0) {
        warnings.push(`Unusual PDF version: ${version}`);
      }
    }
    
    // Check for EOF marker - read more bytes to account for trailing whitespace
    let foundEof = false;
    const tailSizes = [10, 50, 100, 500]; // Try different tail sizes
    
    for (const tailSize of tailSizes) {
      if (blob.size < tailSize) continue;
      
      try {
        const end = await blob.slice(-tailSize).text();
        if (end.includes('%%EOF')) {
          foundEof = true;
          break;
        }
      } catch (error) {
        // Continue to next size
      }
    }
    
    if (!foundEof) {
      // Try binary search for EOF
      try {
        const lastBytes = new Uint8Array(await blob.slice(-500).arrayBuffer());
        const eofPattern = [37, 37, 69, 79, 70]; // %%EOF in ASCII
        
        for (let i = lastBytes.length - eofPattern.length; i >= 0; i--) {
          let match = true;
          for (let j = 0; j < eofPattern.length; j++) {
            if (lastBytes[i + j] !== eofPattern[j]) {
              match = false;
              break;
            }
          }
          if (match) {
            foundEof = true;
            break;
          }
        }
      } catch (error) {
        warnings.push('Could not perform binary EOF search');
      }
    }
    
    if (!foundEof) {
      return { isValid: false, error: 'PDF is incomplete - no %%EOF marker found' };
    }
    
    // Additional structure validation
    try {
      const first1KB = await blob.slice(0, Math.min(1024, blob.size)).text();
      
      // Check for basic PDF structure elements
      if (!first1KB.includes('obj') && !first1KB.includes('<<')) {
        warnings.push('PDF may lack proper object structure');
      }
      
      // Check for catalog (usually required)
      if (!first1KB.includes('/Type') && blob.size > 1024) {
        warnings.push('PDF may lack proper document catalog');
      }
    } catch (error) {
      warnings.push('Could not validate PDF internal structure');
    }
    
    return { isValid: true, warnings: warnings.length > 0 ? warnings : undefined };
  } catch (error) {
    return { isValid: false, error: `Validation error: ${error instanceof Error ? error.message : String(error)}` };
  }
};

export const withPdfContentType = (blob: Blob): Blob => {
  if (blob.type === 'application/pdf') return blob;
  return new Blob([blob], { type: 'application/pdf' });
};

export const saveBlobAsPdf = async (blob: Blob, filename: string): Promise<void> => {
  // Validate PDF before saving
  const validation = await validatePdfBlob(blob);
  if (!validation.isValid) {
    throw new Error(`Invalid PDF: ${validation.error}`);
  }
  
  // Log warnings if any
  if (validation.warnings && validation.warnings.length > 0) {
    console.warn('PDF validation warnings:', validation.warnings);
  }

  const typedBlob = withPdfContentType(blob);

  // Try file-saver first (robust handling across module formats)
  try {
    const possibleSaveAs: any = fileSaverSaveAs as unknown as any;
    if (typeof possibleSaveAs === 'function') {
      possibleSaveAs(typedBlob, filename);
      console.log(`PDF saved successfully: ${filename} (${blob.size} bytes)`);
      return;
    }
    // If import shape is unexpected, log and fall through to fallback
    console.warn('file-saver export is not a function; using fallback');
  } catch (error) {
    console.warn('file-saver failed, using fallback:', error);
  }

  // Fallback download method
  if (typeof window !== 'undefined') {
    const url = URL.createObjectURL(typedBlob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    console.log(`PDF saved successfully via fallback: ${filename} (${blob.size} bytes)`);
    return;
  }

  throw new Error('Unable to save PDF in this environment');
};

export const generatePdfWithRetry = async (
  pdfGenerator: () => Promise<Blob>,
  maxRetries: number = 3,
  onRetry?: (attempt: number, error: Error) => void
): Promise<Blob> => {
  let lastError: Error | null = null;
  const errors: Array<{ attempt: number; error: Error }> = [];
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`🔄 PDF generation attempt ${i + 1}/${maxRetries}`);
      
      // Add a timeout for the entire generation process
      const generationPromise = pdfGenerator();
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`PDF generation timeout on attempt ${i + 1}`)), 90000) // 90 seconds
      );
      
      const blob = await Promise.race([generationPromise, timeoutPromise]);
      
      // Validate the blob
      console.log(`🔍 Validating generated PDF (attempt ${i + 1})...`);
      const validation = await validatePdfBlob(blob);
      
      if (!validation.isValid) {
        throw new Error(`Invalid PDF: ${validation.error}`);
      }
      
      if (validation.warnings && validation.warnings.length > 0) {
        console.warn(`⚠️ PDF validation warnings (attempt ${i + 1}):`, validation.warnings);
      }
      
      console.log(`✅ PDF generation successful on attempt ${i + 1}`);
      return blob;
      
    } catch (error) {
      const err = error as Error;
      console.error(`❌ PDF generation attempt ${i + 1} failed:`, err.message);
      console.error('Error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack
      });
      
      lastError = err;
      errors.push({ attempt: i + 1, error: err });
      
      // Call retry callback if provided
      if (onRetry && i < maxRetries - 1) {
        onRetry(i + 1, err);
      }
      
      if (i < maxRetries - 1) {
        // Wait before retrying (exponential backoff with jitter)
        const baseDelay = 1000 * Math.pow(2, i); // 1s, 2s, 4s
        const jitter = Math.random() * 500; // 0-500ms random jitter
        const delay = baseDelay + jitter;
        
        console.log(`⏳ Waiting ${Math.round(delay)}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Clear any potential memory leaks between attempts
        if (typeof window !== 'undefined' && 'gc' in window) {
          try {
            (window as any).gc();
          } catch (e) {
            // Garbage collection not available
          }
        }
      }
    }
  }
  
  // Provide detailed error information
  const errorSummary = errors.map(e => `Attempt ${e.attempt}: ${e.error.message}`).join('\n');
  const finalError = new Error(
    `Failed to generate PDF after ${maxRetries} attempts.\n\nError summary:\n${errorSummary}\n\nLast error: ${lastError?.message || 'Unknown error'}`
  );
  
  // Attach the original error for debugging
  if (lastError) {
    (finalError as any).cause = lastError;
  }
  
  throw finalError;
};
