// pdf.js로 PDF에서 텍스트 줄을 뽑고, 학생 화면용 페이지 이미지를 만든다.
import { layoutLines } from './layout.js';

let pdfjsPromise = null;

async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      // 학교 PC의 오래된 브라우저에서도 동작하도록 legacy 빌드 사용
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

const BASE = import.meta.env?.BASE_URL ?? '/';

export async function openPdf(data) {
  const pdfjs = await loadPdfjs();
  return pdfjs.getDocument({
    data,
    // 한글 PDF(특히 한/글에서 변환한 파일)는 CMap이 필요하다
    cMapUrl: `${BASE}pdfjs/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${BASE}pdfjs/standard_fonts/`,
  }).promise;
}

/** pdf.js 문서에서 페이지별 줄 목록 추출 */
export async function extractPages(doc) {
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items
      .filter((it) => typeof it.str === 'string')
      .map((it) => ({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
        w: it.width,
        h: it.height || Math.hypot(it.transform[2], it.transform[3]),
      }));
    pages.push({ page: p, lines: layoutLines(items, viewport.width, viewport.height) });
  }
  return pages;
}

/**
 * 페이지를 JPEG data URL로 렌더링 (Firestore 문서 1MB 제한을 넘지 않도록 품질 조절)
 * @returns {Promise<{src:string, aspect:number}[]>}  aspect = 가로/세로
 */
export async function renderPages(doc, { targetWidth = 1100, maxBytes = 850_000, onProgress } = {}) {
  const out = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const base = page.getViewport({ scale: 1 });
    let scale = targetWidth / base.width;
    let dataUrl = '';
    const aspect = base.width / base.height;
    for (let attempt = 0; attempt < 6; attempt++) {
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      const quality = Math.max(0.45, 0.8 - attempt * 0.1);
      dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrl.length <= maxBytes) break;
      scale *= 0.85;
    }
    out.push({ src: dataUrl, aspect, widthCm: (base.width / 72) * 2.54 });
    onProgress?.(p, doc.numPages);
  }
  return out;
}

export async function readFileAsArrayBuffer(file) {
  return new Uint8Array(await file.arrayBuffer());
}
