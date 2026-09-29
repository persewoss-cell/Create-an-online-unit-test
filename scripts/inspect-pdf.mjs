// 사용법: node scripts/inspect-pdf.mjs 문제.pdf [정답.pdf]
// 규칙 기반 인식 결과를 터미널에서 확인한다 (양식별 인식 점검용)
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { itemsToLines } from '../src/lib/layout.js';
import { parseQuestions, fillDefaultPoints } from '../src/lib/parseQuestions.js';
import { parseAnswerText, mergeQuestionsAndAnswers } from '../src/lib/parseAnswers.js';

const require = createRequire(import.meta.url);
const pdfjsDir = require.resolve('pdfjs-dist/package.json').replace(/package\.json$/, '');

export async function extract(path) {
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(readFileSync(path)),
    cMapUrl: `${pdfjsDir}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${pdfjsDir}standard_fonts/`,
  }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const items = tc.items.map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height }));
    pages.push({ page: p, lines: itemsToLines(items, vp.width) });
  }
  return pages;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const [qPath, aPath] = process.argv.slice(2);
  const qPages = await extract(qPath);
  console.log('── 문제지 줄 ──');
  qPages.forEach((p) => p.lines.forEach((l) => console.log(`p${p.page} | ${l}`)));
  const { questions, warnings } = parseQuestions(qPages);
  let result = { questions, keys: {}, warnings };
  if (aPath) {
    const aPages = await extract(aPath);
    console.log('── 정답지 줄 ──');
    aPages.forEach((p) => p.lines.forEach((l) => console.log(`p${p.page} | ${l}`)));
    const merged = mergeQuestionsAndAnswers(questions, parseAnswerText(aPages.flatMap((p) => p.lines)));
    result = { ...merged, warnings: [...warnings, ...merged.warnings] };
  }
  console.log('── 인식 결과 ──');
  for (const q of fillDefaultPoints(result.questions)) {
    console.log(`${q.no}. [${q.type}${q.multi ? ',복수' : ''}] 보기 ${q.choiceCount} / ${q.points}점 / p${q.page} :: ${q.text.slice(0, 40)}`);
    if (result.keys[q.no]) console.log('    정답 →', JSON.stringify(result.keys[q.no]));
  }
  result.warnings.forEach((w) => console.log('⚠', w));
}
