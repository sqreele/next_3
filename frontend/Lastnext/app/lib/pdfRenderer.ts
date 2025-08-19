// ./app/lib/pdfRenderer.ts
"use client";

// Enhanced runtime shims with better error handling
if (typeof window !== 'undefined') {
  try {
    if (typeof (window as any).process === 'undefined') {
      (window as any).process = require('process/browser');
    }
    if (typeof (window as any).Buffer === 'undefined') {
      (window as any).Buffer = require('buffer').Buffer;
    }
    if (typeof (window as any).global === 'undefined') {
      (window as any).global = window as any;
    }
  } catch (error) {
    console.warn('Failed to setup PDF runtime shims:', error);
  }
}

// Import with error handling
let pdfComponents: any = {};
let pdfFunction: any = null;

try {
  const reactPdf = require('@react-pdf/renderer');
  pdfComponents = reactPdf;
  pdfFunction = reactPdf.pdf;
} catch (error) {
  console.error('Failed to import @react-pdf/renderer:', error);
  throw new Error('PDF renderer not available');
}

export async function generatePdfBlob(documentElement: React.ReactElement): Promise<Blob> {
  if (!pdfFunction || typeof pdfFunction !== 'function') {
    throw new Error('PDF function not available');
  }

  try {
    console.log('📄 Creating PDF instance...');
    
    // Create PDF instance with timeout
    const instance = pdfFunction(documentElement);
    
    if (!instance || typeof instance.toBlob !== 'function') {
      throw new Error('Invalid PDF instance created');
    }
    
    console.log('⚙️ Converting to blob...');
    
    // Add timeout to prevent hanging
    const blobPromise = instance.toBlob();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('PDF generation timeout')), 30000)
    );
    
    const blob = await Promise.race([blobPromise, timeoutPromise]) as Blob;
    
    if (!blob || blob.size === 0) {
      throw new Error('Generated PDF blob is empty');
    }
    
    // Validate PDF header
    const header = await blob.slice(0, 5).text();
    if (!header.startsWith('%PDF-')) {
      throw new Error('Generated blob is not a valid PDF');
    }
    
    console.log('✅ PDF blob generated successfully, size:', blob.size);
    return blob;
    
  } catch (error) {
    console.error('❌ Error in generatePdfBlob:', error);
    throw error;
  }
}

// Re-export components with validation
export const Document = pdfComponents.Document;
export const Page = pdfComponents.Page;
export const Text = pdfComponents.Text;
export const View = pdfComponents.View;
export const StyleSheet = pdfComponents.StyleSheet;
export const Image = pdfComponents.Image;
export const Font = pdfComponents.Font;

export type { Styles } from '@react-pdf/renderer';
