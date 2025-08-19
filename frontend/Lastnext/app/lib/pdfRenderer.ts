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

// Import ESM package (@react-pdf/renderer) with proper ESM syntax
import * as reactPdf from '@react-pdf/renderer';

export async function generatePdfBlob(documentElement: React.ReactElement): Promise<Blob> {
  if (!reactPdf.pdf || typeof reactPdf.pdf !== 'function') {
    throw new Error('PDF function not available');
  }

  try {
    console.log('📄 Creating PDF instance...');
    
    // Create PDF instance with better error handling
    let instance;
    try {
      instance = reactPdf.pdf(documentElement);
    } catch (error) {
      console.error('Failed to create PDF instance:', error);
      throw new Error(`PDF instance creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    if (!instance || typeof instance.toBlob !== 'function') {
      throw new Error('Invalid PDF instance created - toBlob method not available');
    }
    
    console.log('⚙️ Converting to blob...');
    
    // Add timeout to prevent hanging with increased timeout for complex PDFs
    const blobPromise = instance.toBlob();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('PDF generation timeout after 60 seconds')), 60000)
    );
    
    let blob;
    try {
      blob = await Promise.race([blobPromise, timeoutPromise]) as Blob;
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        throw error;
      }
      throw new Error(`PDF blob conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    if (!blob) {
      throw new Error('Generated PDF blob is null or undefined');
    }
    
    if (blob.size === 0) {
      throw new Error('Generated PDF blob is empty (0 bytes)');
    }
    
    if (blob.size < 100) {
      throw new Error(`Generated PDF blob is too small (${blob.size} bytes) - likely corrupted`);
    }
    
    // Validate PDF header with better error handling
    let header;
    try {
      header = await blob.slice(0, 5).text();
    } catch (error) {
      console.error('Failed to read PDF header:', error);
      throw new Error('Cannot read PDF header - blob may be corrupted');
    }
    
    if (!header.startsWith('%PDF-')) {
      throw new Error(`Invalid PDF header: "${header}" - expected "%PDF-"`);
    }
    
    // Additional validation: check for proper PDF structure
    try {
      const tail = await blob.slice(-100).text();
      if (!tail.includes('%%EOF')) {
        console.warn('PDF may be incomplete - no %%EOF marker found in last 100 bytes');
      }
    } catch (error) {
      console.warn('Could not validate PDF EOF marker:', error);
    }
    
    console.log('✅ PDF blob generated successfully, size:', blob.size, 'bytes');
    return blob;
    
  } catch (error) {
    console.error('❌ Error in generatePdfBlob:', error);
    console.error('📊 Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    throw error;
  }
}

// Re-export components with validation
export const Document = reactPdf.Document;
export const Page = reactPdf.Page;
export const Text = reactPdf.Text;
export const View = reactPdf.View;
export const StyleSheet = reactPdf.StyleSheet;
export const Image = reactPdf.Image;
export const Font = reactPdf.Font;

export type { Styles } from '@react-pdf/renderer';
