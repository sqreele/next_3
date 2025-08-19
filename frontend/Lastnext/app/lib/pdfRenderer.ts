// ./app/lib/pdfRenderer.ts
"use client";

import process from 'process';
import { Buffer } from 'buffer';
import {
  pdf as createPdf,
  Document as PdfDocument,
  Page as PdfPage,
  Text as PdfText,
  View as PdfView,
  StyleSheet as PdfStyleSheet,
  Image as PdfImage,
  Font as PdfFont,
  type Styles
} from '@react-pdf/renderer';

// Minimal runtime shims for browser environment
if (typeof window !== 'undefined') {
  try {
    if (typeof (window as any).process === 'undefined') {
      (window as any).process = process as any;
    }
    if (typeof (window as any).Buffer === 'undefined') {
      (window as any).Buffer = Buffer as any;
    }
    if (typeof (window as any).global === 'undefined') {
      (window as any).global = window as any;
    }
  } catch (error) {
    console.warn('Failed to setup PDF runtime shims:', error);
  }
}

export async function generatePdfBlob(documentElement: React.ReactElement): Promise<Blob> {
  if (!createPdf || typeof createPdf !== 'function') {
    throw new Error('PDF function not available');
  }

  try {
    console.log('📄 Creating PDF instance...');
    
    // Create PDF instance with better error handling
    let instance;
    try {
      instance = createPdf(documentElement);
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
export const Document = PdfDocument;
export const Page = PdfPage;
export const Text = PdfText;
export const View = PdfView;
export const StyleSheet = PdfStyleSheet;
export const Image = PdfImage;
export const Font = PdfFont;

export type { Styles };
