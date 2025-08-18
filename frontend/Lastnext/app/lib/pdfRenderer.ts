"use client";

// Runtime shims for browser env required by @react-pdf/pdfkit chain
// Guarded to avoid SSR usage. Use ESM-friendly imports instead of require.
import processShim from 'process';
import { Buffer as BufferShim } from 'buffer';

if (typeof window !== 'undefined') {
  // @ts-ignore
  if (typeof (window as any).process === 'undefined') {
    // @ts-ignore
    (window as any).process = processShim;
  }
  // @ts-ignore
  if (typeof (window as any).Buffer === 'undefined') {
    // @ts-ignore
    (window as any).Buffer = BufferShim;
  }
  // Some libs reference global
  // @ts-ignore
  if (typeof (window as any).global === 'undefined') {
    // @ts-ignore
    (window as any).global = window as any;
  }
}

// Import @react-pdf/renderer
import { 
  pdf, 
  Document, 
  Page, 
  Text, 
  View, 
  StyleSheet, 
  Image, 
  Font 
} from '@react-pdf/renderer';

export async function generatePdfBlob(documentElement: React.ReactElement): Promise<Blob> {
  try {
    console.log('📄 Creating PDF instance...');
    console.log('🔍 PDF function type:', typeof pdf);
    
    // Ensure pdf is actually a function
    if (typeof pdf !== 'function') {
      console.error('❌ pdf is not a function, type:', typeof pdf);
      throw new Error(`pdf is not a function, got type: ${typeof pdf}`);
    }
    
    // Create PDF instance
    const instance = pdf(documentElement);
    
    if (!instance) {
      throw new Error('Failed to create PDF instance');
    }
    
    console.log('🔍 PDF instance created, checking toBlob method...');
    console.log('🔍 Instance type:', typeof instance);
    console.log('🔍 Instance has toBlob:', 'toBlob' in instance);
    
    if (typeof instance.toBlob !== 'function') {
      throw new Error(`PDF instance does not have toBlob method. Available methods: ${Object.keys(instance).join(', ')}`);
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

// Re-export components and types
export { 
  Document, 
  Page, 
  Text, 
  View, 
  StyleSheet, 
  Image, 
  Font 
};

export type { Styles } from '@react-pdf/renderer';