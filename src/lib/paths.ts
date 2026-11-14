/** Resolve a path against a document URL so the same build works at / and /resume/. */
export function resolveAgainstDocument(documentUrl: string, relativePath: string): string {
  return new URL(relativePath, documentUrl).href;
}

export function onnxWasmDirectory(documentUrl?: string): string {
  const base = documentUrl ?? document.baseURI;
  const href = resolveAgainstDocument(base, 'ort/');
  return href.endsWith('/') ? href : `${href}/`;
}

export function pdfWorkerUrl(documentUrl?: string): string {
  const base = documentUrl ?? document.baseURI;
  return resolveAgainstDocument(base, 'pdf.worker.min.mjs');
}
