import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
const htmlPath = path.join(dist, 'index.html');
if (!existsSync(htmlPath)) {
  console.error('dist/index.html is missing. Run npm run build first.');
  process.exit(1);
}

const html = readFileSync(htmlPath, 'utf8');
const refs = [...html.matchAll(/\s(?:src|href)=["']([^"']+)["']/g)].map((match) => match[1]);
const badRefs = refs.filter((ref) => ref.startsWith('/') || /^https?:/i.test(ref));
if (badRefs.length) {
  console.error('Absolute asset URLs in dist/index.html:', badRefs);
  process.exit(1);
}
if (!refs.some((ref) => ref.startsWith('./assets/'))) {
  console.error('Expected relative ./assets/ URLs in dist/index.html.');
  process.exit(1);
}

const assets = path.join(dist, 'assets');
const files = readdirSync(assets);
for (const file of files) {
  if (!/\.(js|css)$/.test(file)) continue;
  const text = readFileSync(path.join(assets, file), 'utf8');
  if (/(["'`])\/assets\//.test(text) || /(["'`])\/ort\//.test(text) || /(["'`])\/pdf\.worker/.test(text)) {
    console.error(`Root-absolute asset path in ${file}`);
    process.exit(1);
  }
  if (file.endsWith('.css') && /url\(\s*["']?\//.test(text)) {
    console.error(`Root-absolute CSS url in ${file}`);
    process.exit(1);
  }
}

for (const required of ['ort/ort-wasm-simd-threaded.wasm', 'ort/ort-wasm-simd-threaded.mjs', 'pdf.worker.min.mjs', 'favicon.svg']) {
  if (!existsSync(path.join(dist, required))) {
    console.error(`Missing ${required}`);
    process.exit(1);
  }
}

console.log('Relative dist check passed.');
