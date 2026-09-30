import { describe, it, expect } from 'vitest';
import { normalizeSchool, teacherLoginId, teacherAuthPassword, gsidOf, studentIdOf, teacherLabel } from '../src/lib/school.js';

describe('학교·선생님 계정', () => {
  it('학교 이름은 띄어쓰기를 무시하고 "○○초"는 "○○초등학교"로', () => {
    expect(normalizeSchool(' 광양 중동 초등학교 ')).toBe('광양중동초등학교');
    expect(normalizeSchool('광양중동초')).toBe('광양중동초등학교');
    expect(normalizeSchool('광양중학교')).toBe('광양중학교');
  });
  it('선생님 로그인 ID는 학교_학년_반', () => {
    expect(teacherLoginId({ school: '광양중동초', grade: '5', classNo: '02' })).toBe('광양중동초등학교_5_2');
  });
  it('0000 같은 짧은 비밀번호도 Firebase 최소 길이(6자)를 넘는다', () => {
    expect(teacherAuthPassword('0000').length).toBeGreaterThanOrEqual(6);
    expect(teacherAuthPassword('0000')).not.toBe(teacherAuthPassword('1111'));
  });
  it('학생 번호와 학교까지 붙인 번호', () => {
    const p = { school: '광양중동초', grade: '5', classNo: 2, number: '03' };
    expect(studentIdOf(p)).toBe('5-2-3');
    expect(gsidOf(p)).toBe('광양중동초등학교_5-2-3');
  });
  it('이름표', () => {
    expect(teacherLabel({ school: '광양중동초등학교', grade: 5, classNo: 2 })).toBe('광양중동초등학교 5학년 2반');
    expect(teacherLabel({ name: '관리자' })).toBe('관리자');
  });
});
