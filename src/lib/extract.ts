import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import { pdfWorkerUrl } from './paths';

export const MAX_FILE_BYTES = 8 * 1024 * 1024;

let workerReady = false;

function configurePdfWorker(): void {
  if (workerReady) return;
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl();
  workerReady = true;
}

export type ResumeFileKind = 'pdf' | 'docx' | 'text' | 'unsupported';

export function fileKind(file: File): ResumeFileKind {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  if (
    name.endsWith('.docx') ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'docx';
  }
  if (
    name.endsWith('.txt') ||
    name.endsWith('.md') ||
    name.endsWith('.text') ||
    file.type.startsWith('text/')
  ) {
    return 'text';
  }
  return 'unsupported';
}

export async function extractResumeFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('That file is larger than 8 MB. Paste the text instead.');
  }
  const kind = fileKind(file);
  if (kind === 'unsupported') {
    throw new Error('Use a PDF, DOCX, or plain text file.');
  }
  const buffer = await file.arrayBuffer();
  if (kind === 'pdf') return extractPdf(buffer);
  if (kind === 'docx') return extractDocx(buffer);
  return new TextDecoder().decode(buffer);
}

async function extractPdf(data: ArrayBuffer): Promise<string> {
  configurePdfWorker();
  try {
    const pdf = await getDocument({ data: new Uint8Array(data) }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(linesFromPdfItems(content.items));
    }
    const text = pages.filter(Boolean).join('\n\n').trim();
    if (!text) {
      throw new Error('This PDF has no text layer. Paste the resume text instead.');
    }
    return text;
  } catch (error) {
    if (error instanceof Error && /text layer|password/i.test(error.message)) throw error;
    throw new Error('The PDF could not be read. Paste the resume text instead.');
  }
}

function linesFromPdfItems(items: unknown[]): string {
  const positioned: Array<{ str: string; x: number; y: number; width: number; eol: boolean }> = [];
  for (const item of items) {
    if (!item || typeof item !== 'object' || !('str' in item)) continue;
    const textItem = item as {
      str: string;
      transform?: number[];
      width?: number;
      hasEOL?: boolean;
    };
    if (!textItem.str) continue;
    const transform = textItem.transform ?? [1, 0, 0, 1, 0, 0];
    positioned.push({
      str: textItem.str,
      x: transform[4] ?? 0,
      y: transform[5] ?? 0,
      width: textItem.width ?? 0,
      eol: Boolean(textItem.hasEOL),
    });
  }
  positioned.sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: string[] = [];
  let current: typeof positioned = [];
  let currentY = positioned[0]?.y ?? 0;

  const flush = () => {
    if (current.length === 0) return;
    current.sort((a, b) => a.x - b.x);
    let line = '';
    let lastX = Number.NEGATIVE_INFINITY;
    for (const part of current) {
      const gap = part.x - lastX;
      if (line && gap > 6) line += part.str.startsWith(' ') ? part.str : ` ${part.str}`;
      else line += part.str;
      lastX = part.x + part.width;
    }
    const trimmed = line.replace(/\s+/g, ' ').trim();
    if (trimmed) lines.push(trimmed);
    current = [];
  };

  for (const item of positioned) {
    if (current.length && Math.abs(item.y - currentY) > 2) {
      flush();
      currentY = item.y;
    }
    current.push(item);
    if (item.eol) {
      flush();
      currentY = item.y;
    }
  }
  flush();
  return lines.join('\n');
}

async function extractDocx(data: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth');
  const api = mammoth as unknown as {
    extractRawText?: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
    default?: { extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> };
  };
  const extract = api.extractRawText ?? api.default?.extractRawText;
  if (!extract) throw new Error('DOCX reading is unavailable in this browser.');
  try {
    const result = await extract({ arrayBuffer: data });
    const text = result.value.trim();
    if (!text) throw new Error('This document has no text. Paste the resume instead.');
    return text;
  } catch (error) {
    if (error instanceof Error && /no text/i.test(error.message)) throw error;
    throw new Error('The DOCX file could not be read. Paste the resume text instead.');
  }
}
