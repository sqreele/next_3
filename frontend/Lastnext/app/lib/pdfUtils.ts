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
  const { saveAs } = await import('file-saver');
  const typedBlob = withPdfContentType(blob);
  const looksValid = await isPdfBlob(typedBlob);
  if (!looksValid) {
    throw new Error('Generated file is not a valid PDF (missing %PDF header).');
  }
  saveAs(typedBlob, filename);
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