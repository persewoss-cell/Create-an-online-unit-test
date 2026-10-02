import { describe, it, expect } from 'vitest';
import { findSameExam } from '../src/lib/examDup.js';

const list = [{ id: 'a', grade: 5, semester: 1, subject: '수학', unit: '2. 약수와 배수' }];

describe('findSameExam', () => {
  it('학년·학기·과목·단원이 같으면 찾는다 (띄어쓰기 무시)', () => {
    expect(findSameExam(list, { grade: '5', semester: '1', subject: '수학', unit: '2.약수와  배수' })?.id).toBe('a');
  });
  it('단원명이 다르면 없다', () => {
    expect(findSameExam(list, { grade: 5, semester: 1, subject: '수학', unit: '2. 약수와 배수 추가평가' })).toBeNull();
  });
  it('학기·과목이 다르면 없다', () => {
    expect(findSameExam(list, { grade: 5, semester: 2, subject: '수학', unit: '2. 약수와 배수' })).toBeNull();
    expect(findSameExam(list, { grade: 5, semester: 1, subject: '과학', unit: '2. 약수와 배수' })).toBeNull();
  });
  it('고치는 중인 자기 자신은 빼고 본다', () => {
    expect(findSameExam(list, { grade: 5, semester: 1, subject: '수학', unit: '2. 약수와 배수' }, 'a')).toBeNull();
  });
});
