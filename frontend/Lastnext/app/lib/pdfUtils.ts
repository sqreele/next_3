// ./app/lib/pdfUtils.ts
export const isPdfBlob = async (blob: Blob): Promise<boolean> => {
  try {
    const header = await blob.slice(0, 5).text();
    return header.startsWith('%PDF-');
  } catch {
    return false;
  }
};

export const validatePdfBlob = async (blob: Blob): Promise<{ isValid: boolean; error?: string }> => {
  try {
    // Check size
    if (blob.size === 0) {
      return { isValid: false, error: 'PDF blob is empty' };
    }
    
    if (blob.size < 100) {
      return { isValid: false, error: 'PDF blob is too small' };
    }
    
    // Check PDF header
    const header = await blob.slice(0, 5).text();
    if (!header.startsWith('%PDF-')) {
      return { isValid: false, error: 'Invalid PDF header' };
    }
    
    // Check for EOF marker
    const end = await blob.slice(-10).text();
    if (!end.includes('EOF')) {
      console.warn('PDF may be incomplete - no EOF marker found');
    }
    
    return { isValid: true };
  } catch (error) {
    return { isValid: false, error: `Validation error: ${error}` };
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

  const typedBlob = withPdfContentType(blob);

  // Try file-saver first
  try {
    const { saveAs } = await import('file-saver');
    saveAs(typedBlob, filename);
    return;
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
    return;
  }

  throw new Error('Unable to save PDF in this environment');
};

export const generatePdfWithRetry = async (
  pdfGenerator: () => Promise<Blob>,
  maxRetries: number = 3
): Promise<Blob> => {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`PDF generation attempt ${i + 1}/${maxRetries}`);
      const blob = await pdfGenerator();
      
      // Validate the blob
      const validation = await validatePdfBlob(blob);
      if (!validation.isValid) {
        throw new Error(`Invalid PDF: ${validation.error}`);
      }
      
      return blob;
    } catch (error) {
      console.error(`PDF generation attempt ${i + 1} failed:`, error);
      lastError = error as Error;
      
      if (i < maxRetries - 1) {
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  
  throw lastError || new Error('Failed to generate PDF after multiple attempts');
};
