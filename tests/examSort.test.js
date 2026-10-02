import { describe, it, expect } from 'vitest';
import { sortExams, nextSort } from '../src/lib/examSort.js';

const t = (s) => ({ seconds: s });
const exams = [
  { id: 'a', grade: 5, semester: 1, subject: '수학', unit: '10. 비', title: '가', status: 'open', createdAt: t(1) },
  { id: 'b', grade: 3, semester: 2, subject: '과학', unit: '2. 생물', title: '나', status: 'draft', createdAt: t(3) },
  { id: 'c', grade: 5, semester: 1, subject: '국어', unit: '', title: '다', status: 'closed', createdAt: t(2) },
];
const ids = (l) => l.map((e) => e.id).join('');

describe('평가 목록 정렬', () => {
  it('기본은 새로 만든 것이 위로', () => {
    expect(ids(sortExams(exams))).toBe('bca');
  });
  it('학년 오름·내림 (같은 학년은 새로 만든 순)', () => {
    expect(ids(sortExams(exams, {}, { key: 'grade', dir: 'asc' }))).toBe('bca');
    expect(ids(sortExams(exams, {}, { key: 'grade', dir: 'desc' }))).toBe('cab');
  });
  it('단원은 앞 번호를 숫자로 비교, 단원이 없으면 화면에 보이는 평가 제목으로', () => {
    expect(ids(sortExams(exams, {}, { key: 'unit', dir: 'asc' }))).toBe('bac');
    expect(ids(sortExams(exams, {}, { key: 'unit', dir: 'desc' }))).toBe('cab');
  });
  it('빈 값은 오름·내림 상관없이 맨 아래', () => {
    const st = { a: { avg: 90 }, b: {}, c: { avg: 70 } };
    expect(ids(sortExams(exams, st, { key: 'avg', dir: 'asc' }))).toBe('cab');
    expect(ids(sortExams(exams, st, { key: 'avg', dir: 'desc' }))).toBe('acb');
  });
  it('과목은 가나다순, 상태는 개시 전 → 응시 중 → 마감', () => {
    expect(ids(sortExams(exams, {}, { key: 'subject', dir: 'asc' }))).toBe('bca');
    expect(ids(sortExams(exams, {}, { key: 'status', dir: 'asc' }))).toBe('bac');
  });
  it('평균처럼 통계로 정렬', () => {
    const st = { a: { avg: 90 }, b: { avg: 70 }, c: {} };
    expect(ids(sortExams(exams, st, { key: 'avg', dir: 'desc' }))).toBe('abc');
  });
  it('누를 때마다 오름 → 내림 → 해제', () => {
    let s = nextSort(null, 'grade');
    expect(s).toEqual({ key: 'grade', dir: 'asc' });
    s = nextSort(s, 'grade');
    expect(s).toEqual({ key: 'grade', dir: 'desc' });
    expect(nextSort(s, 'grade')).toBe(null);
    expect(nextSort(s, 'subject')).toEqual({ key: 'subject', dir: 'asc' });
  });
});
