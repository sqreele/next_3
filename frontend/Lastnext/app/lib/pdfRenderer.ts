"use client";

// Runtime shims for browser env required by @react-pdf/pdfkit chain
// Guarded to avoid SSR usage
if (typeof window !== 'undefined') {
  // @ts-ignore
  if (typeof (window as any).process === 'undefined') {
    // Lazy require to keep bundle lean
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    (window as any).process = require('process/browser');
  }
  // @ts-ignore
  if (typeof (window as any).Buffer === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    (window as any).Buffer = require('buffer').Buffer;
  }
  // Some libs reference global
  // @ts-ignore
  if (typeof (window as any).global === 'undefined') {
    // @ts-ignore
    (window as any).global = window as any;
  }
}

// Fixed wrapper for @react-pdf/renderer
import { pdf } from '@react-pdf/renderer';

export async function generatePdfBlob(documentElement: React.ReactElement): Promise<Blob> {
  try {
    console.log('📄 Creating PDF instance...');
    
    // Direct import of pdf function
    const instance = pdf(documentElement);
    
    if (!instance) {
      throw new Error('Failed to create PDF instance');
    }
    
    if (typeof instance.toBlob !== 'function') {
      throw new Error('PDF instance does not have toBlob method');
    }
    
    console.log('⚙️ Converting to blob...');
    const blob = await instance.toBlob();
    
    if (!blob || blob.size === 0) {
      throw new Error('Generated PDF blob is empty');
    }
    
    console.log('✅ PDF blob generated successfully, size:', blob.size);
    return blob;
    
  } catch (error) {
    console.error('❌ Error in generatePdfBlob:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`PDF generation failed: ${errorMessage}`);
  }
}

// Re-export types and components
export { 
  Document, 
  Page, 
  Text, 
  View, 
  StyleSheet, 
  Image, 
  Font 
} from '@react-pdf/renderer';

export type { Styles } from '@react-pdf/renderer';
