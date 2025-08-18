"use client";

import React from 'react';

export async function testPdfGeneration() {
  try {
    console.log('🧪 Starting PDF test...');
    
    // Step 1: Test dynamic import
    console.log('1️⃣ Testing dynamic import...');
    const pdfModule = await import('@react-pdf/renderer');
    console.log('✅ Module imported:', Object.keys(pdfModule));
    
    // Step 2: Extract components
    const { pdf, Document, Page, Text } = pdfModule;
    console.log('2️⃣ Extracted components:', { 
      pdf: typeof pdf,
      Document: typeof Document,
      Page: typeof Page,
      Text: typeof Text
    });
    
    // Step 3: Create simple document
    console.log('3️⃣ Creating test document...');
    const TestDoc = () => React.createElement(
      Document,
      {},
      React.createElement(
        Page,
        { size: "A4", style: { padding: 30 } },
        React.createElement(Text, {}, 'Hello PDF Test!')
      )
    );
    
    // Step 4: Test pdf function
    console.log('4️⃣ Testing pdf function...');
    const pdfInstance = pdf(React.createElement(TestDoc));
    console.log('✅ PDF instance created:', typeof pdfInstance, Object.keys(pdfInstance));
    
    // Step 5: Generate blob
    console.log('5️⃣ Generating blob...');
    const blob = await pdfInstance.toBlob();
    console.log('✅ Blob generated:', blob.size, 'bytes');
    
    return { success: true, blobSize: blob.size };
  } catch (error) {
    console.error('❌ Test failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    };
  }
}