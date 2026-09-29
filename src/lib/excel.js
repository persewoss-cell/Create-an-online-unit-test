// 평가 결과를 엑셀(.xlsx)로 내보내기
import { gradeSubmission } from './grading.js';
import { answerToText, keyToText } from './format.js';

const MARK = { correct: 'O', wrong: 'X', review: '검토' };

export function sortSubmissions(subs) {
  return [...subs].sort((a, b) => a.grade - b.grade || a.classNo - b.classNo || a.number - b.number);
}

export async function exportResultsXlsx(exam, keys, submissions) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = exam.ownerName || '단원평가';
  const qs = exam.questions;
  const rows = sortSubmissions(submissions).map((s) => ({ s, r: gradeSubmission(exam, keys, s) }));

  const headerStyle = (row) => {
    row.font = { bold: true };
    row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    row.eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
      c.border = { bottom: { style: 'thin' } };
    });
  };

  // 1) 성적표
  const ws = wb.addWorksheet('성적');
  ws.addRow([exam.title]).font = { bold: true, size: 14 };
  ws.addRow([`${exam.grade}학년 ${exam.semester}학기 · ${exam.subject} · ${exam.unit || ''}`]);
  ws.addRow([]);
  const head = ws.addRow([
    '학년', '반', '번호', '이름', '점수(100점)', '득점', '만점', '맞은 문항', '검토 대기', '제출 시각',
    ...qs.map((q) => `${q.no}번`),
  ]);
  headerStyle(head);
  for (const { s, r } of rows) {
    const row = ws.addRow([
      s.grade, s.classNo, s.number, s.name, r.score100, r.earned, r.total, r.correctCount, r.reviewCount,
      s.submittedAt?.toDate ? s.submittedAt.toDate() : '',
      ...r.items.map((it) => MARK[it.status]),
    ]);
    row.getCell(10).numFmt = 'yyyy-mm-dd hh:mm';
    r.items.forEach((it, i) => {
      const c = row.getCell(11 + i);
      c.alignment = { horizontal: 'center' };
      if (it.status === 'wrong') c.font = { color: { argb: 'FFC62828' } };
      if (it.status === 'review') c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3C4' } };
    });
  }
  if (rows.length) {
    const avg = rows.reduce((a, x) => a + x.r.score100, 0) / rows.length;
    ws.addRow([]);
    ws.addRow(['', '', '', '평균', Math.round(avg * 10) / 10]).font = { bold: true };
  }
  ws.columns.forEach((col, i) => {
    col.width = i === 3 ? 10 : i === 9 ? 17 : i >= 10 ? 6 : 9;
  });
  ws.views = [{ state: 'frozen', xSplit: 4, ySplit: 4 }];

  // 2) 학생 답안 원문
  const wa = wb.addWorksheet('답안');
  headerStyle(wa.addRow(['학년', '반', '번호', '이름', ...qs.map((q) => `${q.no}번`)]));
  for (const { s } of rows) {
    wa.addRow([s.grade, s.classNo, s.number, s.name, ...qs.map((q) => answerToText(q, s.answers?.[q.no]))]);
  }
  wa.columns.forEach((col, i) => {
    col.width = i < 4 ? 8 : 18;
  });

  // 3) 문항 분석
  const wq = wb.addWorksheet('문항분석');
  headerStyle(wq.addRow(['번호', '유형', '배점', '정답', '정답 수', '오답 수', '검토 대기', '정답률(%)']));
  const TYPE = { mc: '객관식', short: '단답형', essay: '서술형' };
  qs.forEach((q, qi) => {
    const st = rows.map((x) => x.r.items[qi].status);
    const c = st.filter((x) => x === 'correct').length;
    const w = st.filter((x) => x === 'wrong').length;
    const rv = st.filter((x) => x === 'review').length;
    wq.addRow([q.no, TYPE[q.type], q.points, keyToText(q, keys[q.no]), c, w, rv, rows.length ? Math.round((c / rows.length) * 1000) / 10 : 0]);
  });
  wq.columns.forEach((col, i) => {
    col.width = i === 3 ? 40 : 10;
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${exam.title.replace(/[\\/:*?"<>|]/g, '_')}_결과.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
