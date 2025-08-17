"use client";

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
    throw new Error(`PDF generation failed: ${error.message}`);
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
