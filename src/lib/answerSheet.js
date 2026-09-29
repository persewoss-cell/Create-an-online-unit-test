// 정답 엑셀 양식 만들기 / 읽기
// 양식: 번호 | 정답 | 배점(선택, 비우면 자동)
// 정답 칸에는 객관식이든 단답형이든 서술형이든 그대로 적으면 문항 유형·핵심어는 자동으로 정해진다.

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

/** @param {number[]} numbers 문항 번호 목록 */
export async function buildAnswerTemplate(numbers) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('정답');
  ws.columns = [
    { header: '번호', key: 'no', width: 8 },
    { header: '정답', key: 'answer', width: 60 },
    { header: '배점(비우면 자동)', key: 'points', width: 18 },
  ];
  const head = ws.getRow(1);
  head.font = { bold: true };
  head.alignment = { horizontal: 'center' };
  head.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
  });
  for (const no of numbers) ws.addRow({ no });
  ws.getColumn('answer').numFmt = '@'; // 정답은 글자로 (3/4 가 날짜로 바뀌지 않게)
  for (let r = 2; r <= numbers.length + 1; r++) ws.getCell(`B${r}`).numFmt = '@';
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
    ['단답형', '서까래'],
    ['단답형 (여러 답 인정)', '로제타 선생님 / 로제타'],
    ['단답형 (모두 써야 정답)', '산소, 이산화 탄소'],
    ['서술형', '모범 답안 문장을 그대로 적기'],
    ['서술형 (예시 답안)', '(예) 우울한 표정 / 걱정하는 목소리 등'],
    ['', ''],
    ['배점', '비워 두면 100점을 문항 수로 나눠 자동으로 정합니다.'],
  ].forEach((r, i) => {
    const row = help.addRow(r);
    if (i === 0) row.font = { bold: true };
  });
  return wb.xlsx.writeBuffer();
}

export async function downloadAnswerTemplate(numbers, title = '단원평가') {
  const buf = await buildAnswerTemplate(numbers);
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
 * 정답 엑셀 읽기
 * @param {ArrayBuffer} data
 * @returns {Promise<{answers: Map<number,string>, points: Map<number,number>}>}
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
    const a = f(/^(정답|답|답안)/);
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
  for (let r = startRow; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const no = Number(cellText(row.getCell(noCol).value).replace(/[^\d]/g, ''));
    const ans = cellText(row.getCell(ansCol).value).trim();
    if (!no || !ans) continue;
    answers.set(no, ans);
    if (ptCol) {
      const p = Number(cellText(row.getCell(ptCol).value));
      if (p > 0) points.set(no, p);
    }
  }
  return { answers, points };
}
