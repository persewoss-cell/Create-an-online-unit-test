// 학생 명단 엑셀 양식 만들기 / 읽기 (학년 | 반 | 번호 | 이름)

function cellText(v) {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((t) => t.text).join('');
    if (v.text != null) return String(v.text);
    if (v.result != null) return String(v.result);
  }
  return String(v);
}

export async function downloadRosterTemplate(grade) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('학생명단');
  ws.columns = [
    { header: '학년', key: 'grade', width: 8 },
    { header: '반', key: 'classNo', width: 8 },
    { header: '번호', key: 'number', width: 8 },
    { header: '이름', key: 'name', width: 16 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
  });
  ws.addRow({ grade: grade || 3, classNo: 1, number: 1, name: '홍길동' });
  ws.addRow({ grade: grade || 3, classNo: 1, number: 2, name: '김철수' });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '학생명단_양식.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * @returns {Promise<{entries:{grade,classNo,number,name}[], errors:string[]}>}
 */
export async function readRosterSheet(data, defaultGrade) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);
  const ws = wb.worksheets[0];
  let cols = { grade: 0, classNo: 1, number: 2, name: 3 };
  let start = 1;
  for (let r = 1; r <= Math.min(5, ws.rowCount); r++) {
    const cells = [];
    ws.getRow(r).eachCell({ includeEmpty: true }, (c, col) => cells.push([col, cellText(c.value).replace(/\s/g, '')]));
    const f = (re) => cells.find(([, t]) => re.test(t))?.[0];
    const name = f(/^(이름|성명)$/);
    const cls = f(/^반$/);
    const num = f(/^(번호|번)$/);
    if (name && cls && num) {
      cols = { grade: f(/^학년$/) || 0, classNo: cls, number: num, name };
      start = r + 1;
      break;
    }
  }
  if (start === 1) cols = { grade: 1, classNo: 2, number: 3, name: 4 }; // 머리글이 없으면 학년·반·번호·이름 순서로 본다
  const entries = [];
  const errors = [];
  const seen = new Set();
  for (let r = start; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const get = (c) => (c ? cellText(row.getCell(c).value).trim() : '');
    const name = get(cols.name);
    if (!name) continue;
    const grade = Number(get(cols.grade).replace(/[^\d]/g, '')) || Number(defaultGrade);
    const classNo = Number(get(cols.classNo).replace(/[^\d]/g, ''));
    const number = Number(get(cols.number).replace(/[^\d]/g, ''));
    if (!(grade >= 1 && grade <= 6) || !(classNo > 0) || !(number > 0)) {
      errors.push(`${r}번째 줄(${name}): 학년·반·번호를 확인해 주세요.`);
      continue;
    }
    const id = `${grade}-${classNo}-${number}`;
    if (seen.has(id)) errors.push(`${grade}학년 ${classNo}반 ${number}번이 두 번 있습니다(${name}).`);
    seen.add(id);
    entries.push({ grade, classNo, number, name });
  }
  return { entries, errors };
}
