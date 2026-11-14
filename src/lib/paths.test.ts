import { describe, expect, it } from 'vitest';
import { onnxWasmDirectory, pdfWorkerUrl, resolveAgainstDocument } from './paths';

describe('document-relative URLs', () => {
  it('resolves runtime files at the subdomain root', () => {
    expect(resolveAgainstDocument('https://resume.aiteksolutions.net/', 'ort/')).toBe(
      'https://resume.aiteksolutions.net/ort/',
    );
    expect(pdfWorkerUrl('https://resume.aiteksolutions.net/index.html')).toBe(
      'https://resume.aiteksolutions.net/pdf.worker.min.mjs',
    );
    expect(onnxWasmDirectory('https://resume.aiteksolutions.net/')).toBe('https://resume.aiteksolutions.net/ort/');
  });

  it('resolves runtime files under the proxied /resume/ path', () => {
    expect(resolveAgainstDocument('https://aiteksolutions.net/resume/', 'ort/')).toBe(
      'https://aiteksolutions.net/resume/ort/',
    );
    expect(resolveAgainstDocument('https://aiteksolutions.net/resume/index.html', 'ort/file.wasm')).toBe(
      'https://aiteksolutions.net/resume/ort/file.wasm',
    );
    expect(onnxWasmDirectory('https://aiteksolutions.net/resume/')).toBe('https://aiteksolutions.net/resume/ort/');
    expect(pdfWorkerUrl('https://aiteksolutions.net/resume/index.html')).toBe(
      'https://aiteksolutions.net/resume/pdf.worker.min.mjs',
    );
  });
});
