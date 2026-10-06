// 정답 엑셀 양식 만들기 / 읽기
// 양식: 번호 | 정답 | 배점(선택, 비우면 자동 · 부분 점수는 3 ; 2)
// 정답 칸에는 객관식이든 단답형이든 서술형이든 그대로 적으면 문항 유형·핵심어는 자동으로 정해진다.

import { fillDefaultPoints } from './parseQuestions.js';

function download(buf, filename) {
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const CIRCLED_SET = '①②③④⑤⑥⑦⑧⑨⑩';

/** 문제지 인식 결과를 보고 정답 칸에 무엇을 어떻게 적으면 되는지 안내 */
export function answerHint(q) {
  if (!q || typeof q !== 'object') return '';
  const tail = q.manual ? ' · 선생님이 직접 채점하는 문항(비워 둬도 됨)' : '';
  if (q.parts?.length) {
    return `답이 ${q.parts.length}부분 — 부분마다 ; 로 구분 (예: ${q.parts.map((p) => (p.type === 'mc' ? (p.choiceLabels || ['①'])[0] : p.type === 'match' ? '(1)-①' : '답')).join(' ; ')})` + tail;
  }
  if (q.type === 'draw') return '✏️ 그리기 문항 — 비워 두면 학생 그림을 선생님이 채점' + tail;
  if (q.draw) return '✏️ 그리기 + 답 칸 — ( ) 칸에 들어갈 답만 적기 (예: 3 cm), 그림은 선생님이 채점' + tail;
  if (q.type === 'mc') {
    // 직접 입력 보기에서 기호를 비워 두었으면 번호로 적기
    const labels = (q.choiceLabels || CIRCLED_SET.slice(0, q.choiceCount || 5).split('')).map((l, i) => String(l || '').trim() || `${i + 1}`);
    if (q.oxBlanks) return `○표 할 괄호: ${labels.join(' / ')} 중에서 적기 (예: ${labels[labels.length - 1]})` + tail;
    return `${labels.join(' ')} 중에서 적기${q.multi ? ' (여러 개면 2, 4 처럼)' : ''} (예: ${labels[0]})` + tail;
  }
  if (q.type === 'match') return '(1)-① (2)-② 처럼 적기' + tail;
  if (q.blankCount > 1) {
    const ex = Array.from({ length: q.blankCount }, (_, i) => [3, 6, 9, 12, 15, 18, 21, 24][i]).join(', ');
    return `답 칸 ${q.blankCount}개 — 순서대로 쉼표로 구분 (예: ${ex})` + tail;
  }
  if (q.fillBoxes) return '□ 칸에 들어갈 답 (칸이 여러 개면 순서대로 쉼표로, 예: 3, 6)' + tail;
  if (q.type === 'essay') return '모범 답안 문장 또는 (예) 예시 / 예시 등' + tail;
  return '답 그대로 적기 (여러 답 인정: 답1 / 답2)' + tail;
}

/** @param {(number|object)[]} list 문항 번호 목록 또는 문항 목록(인식 결과) */
export async function buildAnswerTemplate(list) {
  const numbers = list.map((x) => (typeof x === 'object' ? Number(x.no) : x));
  const byNo = Object.fromEntries(list.filter((x) => typeof x === 'object').map((x) => [Number(x.no), x]));
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('정답');
  ws.columns = [
    { header: '번호', key: 'no', width: 8 },
    { header: '정답', key: 'answer', width: 40 },
    { header: '배점(비우면 자동)', key: 'points', width: 18 },
    { header: '답 쓰는 법 (자동 안내)', key: 'hint', width: 70 },
  ];
  const head = ws.getRow(1);
  head.font = { bold: true };
  head.alignment = { horizontal: 'center' };
  head.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
  });
  for (const no of numbers) {
    const row = ws.addRow({ no, hint: answerHint(byNo[no]) });
    row.getCell('hint').font = { color: { argb: 'FF5D6B7E' } };
  }
  ws.getColumn('answer').numFmt = '@'; // 정답은 글자로 (3/4 가 날짜로 바뀌지 않게)
  ws.getColumn('points').numFmt = '@'; // 부분 점수 "3 ; 2"
  for (let r = 2; r <= numbers.length + 1; r++) {
    ws.getCell(`B${r}`).numFmt = '@';
    ws.getCell(`C${r}`).numFmt = '@';
  }
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  const help = wb.addWorksheet('작성 방법');
  help.getColumn(1).width = 26;
  help.getColumn(2).width = 60;
  [
    ['정답 칸에 이렇게 적으세요', ''],
    ['객관식', '4  또는  ④'],
    ['객관식 (답이 여러 개)', '2, 4'],
    ['기호로 고르는 문제', '㉮'],
    ['○표 하는 문제', '(3)'],
    ['선 잇기', '(1)-① (2)-②'],
    ['○표 할 괄호 고르기', '오른쪽  (또는 왼쪽, 가운데, 위, 아래)'],
    ['□ 칸이 여러 개', '3, 6  (순서대로 쉼표)'],
    ['그리기 (선생님 채점)', '그리기  /  그리기 + 3 cm'],
    ['한 문항에 답 종류가 여러 개', '부분마다 ;  (예: 두 원의 지름의 합과 같습니다. ; 20 cm)'],
    ['선생님이 직접 채점', '검토'],
    ['단답형', '서까래'],
    ['단답형 (여러 답 인정)', '로제타 선생님 / 로제타'],
    ['단답형 (모두 써야 정답)', '산소, 이산화 탄소'],
    ['서술형', '모범 답안 문장을 그대로 적기'],
    ['서술형 (예시 답안)', '(예) 우울한 표정 / 걱정하는 목소리 등'],
    ['', ''],
    ['배점', '비워 두면 100점을 문항 수로 나눠 자동으로 정합니다. 일부만 적으면 나머지 점수를 남은 문항에 고르게 나눕니다.'],
    ['부분 점수', '정답을 ; 로 나눈 문항은 배점도 부분마다 ;  (예: 3 ; 2 → 맞힌 부분만큼 점수)'],
  ].forEach((r, i) => {
    const row = help.addRow(r);
    if (i === 0) row.font = { bold: true };
  });
  return wb.xlsx.writeBuffer();
}

export async function downloadAnswerTemplate(list, title = '단원평가') {
  const buf = await buildAnswerTemplate(list);
  download(buf, `${title.replace(/[\\/:*?"<>|]/g, '_')}_정답양식.xlsx`);
}

function cellText(v) {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((t) => t.text).join('');
    if (v.text != null) return String(v.text);
    if (v.result != null) return String(v.result);
    if (v instanceof Date) return `${v.getMonth() + 1}/${v.getDate()}`;
  }
  return String(v);
}

/**
 * 배점 칸 읽기: "5" → 5점, 부분 점수 "3 ; 2" 또는 "3+2" → 5점 (부분 3점, 2점)
 * @returns {{points:number, parts:number[]|null}|null}
 */
export function parsePoints(text) {
  const s = String(text ?? '').replace(/점/g, '').trim();
  if (!s) return null;
  const nums = s.split(/\s*[;；+＋]\s*/).filter(Boolean).map(Number);
  if (!nums.length || nums.some((n) => !(n >= 0) || Number.isNaN(n))) return null;
  const total = Math.round(nums.reduce((a, b) => a + b, 0) * 10) / 10;
  if (!(total > 0)) return null;
  return { points: total, parts: nums.length > 1 ? nums : null };
}

/**
 * 정답 엑셀 읽기
 * @param {ArrayBuffer} data
 * @returns {Promise<{answers: Map<number,string>, points: Map<number,number>, partPoints: Map<number,number[]>}>}
 */
export async function readAnswerSheet(data) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);
  const ws = wb.worksheets.find((w) => w.name === '정답') || wb.worksheets[0];
  let noCol = 1;
  let ansCol = 2;
  let ptCol = 3;
  let startRow = 1;
  for (let r = 1; r <= Math.min(5, ws.rowCount); r++) {
    const row = ws.getRow(r);
    const cells = [];
    row.eachCell({ includeEmpty: true }, (c, col) => cells.push([col, cellText(c.value).replace(/\s/g, '')]));
    const f = (re) => cells.find(([, t]) => re.test(t))?.[0];
    const n = f(/^(번호|문항|문항번호|no)$/i);
    const a = f(/^(정답|답|답안)$/);
    if (n && a) {
      noCol = n;
      ansCol = a;
      ptCol = f(/^배점/) || 0;
      startRow = r + 1;
      break;
    }
  }
  const answers = new Map();
  const points = new Map();
  const partPoints = new Map();
  for (let r = startRow; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const no = Number(cellText(row.getCell(noCol).value).replace(/[^\d]/g, ''));
    const ans = cellText(row.getCell(ansCol).value).trim();
    if (!no || !ans) continue;
    answers.set(no, ans);
    if (ptCol) {
      const p = parsePoints(cellText(row.getCell(ptCol).value));
      if (p) {
        points.set(no, p.points);
        if (p.parts) partPoints.set(no, p.parts);
      }
    }
  }
  return { answers, points, partPoints };
}

/**
 * 엑셀에 배점이 일부라도 있으면: 적힌 배점은 그대로, 나머지 문항은 남은 점수를 고르게 나눈다 (총점 100).
 * 엑셀에 배점이 하나도 없으면 지금 배점(균등 분배 또는 문제지에 적힌 배점)을 그대로 둔다.
 * @param {object[]} items 편집 중인 문항
 * @param {Map<number,number>} points 엑셀 배점
 */
export function withSheetPoints(items, points) {
  if (!points.size) return items;
  return fillDefaultPoints(items.map((it) => ({ ...it, points: points.get(Number(it.no)) ?? null })));
}
