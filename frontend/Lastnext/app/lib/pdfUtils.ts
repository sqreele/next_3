export const isPdfBlob = async (blob: Blob): Promise<boolean> => {
  try {
    const header = await blob.slice(0, 5).text();
    return header.startsWith('%PDF-');
  } catch {
    return false;
  }
};

export const withPdfContentType = (blob: Blob): Blob => {
  if (blob.type === 'application/pdf') return blob;
  return new Blob([blob], { type: 'application/pdf' });
};

export const saveBlobAsPdf = async (blob: Blob, filename: string): Promise<void> => {
  const typedBlob = withPdfContentType(blob);
  const looksValid = await isPdfBlob(typedBlob);
  if (!looksValid) {
    throw new Error('Generated file is not a valid PDF (missing %PDF header).');
  }

  let saveAsFn: ((data: Blob, filename: string) => void) | null = null;
  try {
    const mod: any = await import('file-saver');
    // Resolve across CJS/ESM variations
    if (mod) {
      if (typeof mod.saveAs === 'function') {
        saveAsFn = mod.saveAs;
      } else if (typeof mod.default === 'function') {
        saveAsFn = mod.default;
      } else if (mod.default && typeof mod.default.saveAs === 'function') {
        saveAsFn = mod.default.saveAs;
      } else if (typeof mod === 'function') {
        saveAsFn = mod as (data: Blob, filename: string) => void;
      }
    }
  } catch (err) {
    console.warn('file-saver import failed, will use fallback downloader.', err);
  }

  if (saveAsFn) {
    try {
      saveAsFn(typedBlob, filename);
      return;
    } catch (err) {
      console.warn('file-saver saveAs invocation failed, using fallback downloader.', err);
    }
  }

  // Fallback: trigger a download via an anchor element
  if (typeof window !== 'undefined') {
    const url = URL.createObjectURL(typedBlob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }

  throw new Error('Unable to save PDF in this environment');
};

// New helper function with retry logic
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
      if (!blob || blob.size === 0) {
        throw new Error('Generated PDF blob is empty');
      }
      
      // Check if it's a valid PDF
      const isValid = await isPdfBlob(blob);
      if (!isValid && i < maxRetries - 1) {
        console.warn(`Generated blob is not a valid PDF, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
        continue;
      }
      
      return blob;
    } catch (error) {
      console.error(`PDF generation attempt ${i + 1} failed:`, error);
      lastError = error as Error;
      
      if (i < maxRetries - 1) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
      }
    }
  }
  
  throw lastError || new Error('Failed to generate PDF after multiple attempts');
};