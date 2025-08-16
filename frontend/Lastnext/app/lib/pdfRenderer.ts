"use client";

// Wrapper for @react-pdf/renderer to handle import issues robustly
import * as ReactPDF from '@react-pdf/renderer';

let cachedPdfFunction: ((element: React.ReactElement) => any) | null = null;

function getPdfFunction(): (element: React.ReactElement) => any {
  if (cachedPdfFunction) return cachedPdfFunction;

  // Prefer named export
  const namedPdf: unknown = (ReactPDF as any).pdf;
  if (typeof namedPdf === 'function') {
    cachedPdfFunction = namedPdf as (element: React.ReactElement) => any;
    return cachedPdfFunction;
  }

  // Fallback: some bundlers nest under default
  const defaultPdf: unknown = (ReactPDF as any)?.default?.pdf;
  if (typeof defaultPdf === 'function') {
    cachedPdfFunction = defaultPdf as (element: React.ReactElement) => any;
    return cachedPdfFunction;
  }

  const availableExports = Object.keys(ReactPDF || {});
  throw new Error(`@react-pdf/renderer 'pdf' export not found. Available exports: ${availableExports.join(', ')}`);
}

export async function generatePdfBlob(documentElement: React.ReactElement): Promise<Blob> {
  const pdf = getPdfFunction();
  const instance = pdf(documentElement);

  if (!instance || typeof instance.toBlob !== 'function') {
    throw new Error('PDF instance does not have toBlob method');
  }

  return await instance.toBlob();
}

// Re-export types and components
export { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
export type { Styles } from '@react-pdf/renderer';