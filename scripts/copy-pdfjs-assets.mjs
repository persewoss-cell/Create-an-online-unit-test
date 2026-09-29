// pdf.js의 CMap/표준 글꼴 파일을 public/pdfjs 로 복사 (한글 PDF 인식에 필요)
import { cpSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const root = dirname(require.resolve('pdfjs-dist/package.json'));
const dest = join(process.cwd(), 'public', 'pdfjs');
mkdirSync(dest, { recursive: true });
for (const dir of ['cmaps', 'standard_fonts']) cpSync(join(root, dir), join(dest, dir), { recursive: true });
console.log('pdf.js assets copied to public/pdfjs');
