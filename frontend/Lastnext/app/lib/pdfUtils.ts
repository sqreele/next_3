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