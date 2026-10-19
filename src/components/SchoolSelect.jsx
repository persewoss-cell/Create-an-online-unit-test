import { useEffect, useState } from 'react';
import { listDirectory } from '../lib/db.js';
import { normalizeSchool } from '../lib/school.js';

/** 등록된 학교·반 목록 (로그인 전에도 읽힘). 불러오는 중 null, 못 불러오면 [] */
export function useDirectory() {
  const [dir, setDir] = useState(null);
  useEffect(() => {
    let alive = true;
    listDirectory()
      .then((list) => alive && setDir(list))
      .catch(() => alive && setDir([]));
    return () => {
      alive = false;
    };
  }, []);
  return dir;
}

/** 학교 이름 가나다순 (중복 없이) */
export function schoolsOf(dir) {
  return [...new Set((dir || []).map((d) => d.school))].sort((a, b) => a.localeCompare(b, 'ko'));
}

/**
 * 로그인 화면 학교 고르기: 등록된 학교만 드롭다운으로.
 * 목록을 못 불러오면(아직 비어 있음 등) 예전처럼 직접 입력한다.
 */
export default function SchoolSelect({ value, onChange, label = '학교 이름', ariaLabel = label }) {
  const dir = useDirectory();
  const schools = schoolsOf(dir);
  // 저장해 둔 학교가 목록에 없으면 비워서 다시 고르게
  useEffect(() => {
    if (schools.length && value && !schools.includes(normalizeSchool(value))) onChange('');
    else if (schools.length && value && value !== normalizeSchool(value)) onChange(normalizeSchool(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dir]);
  // 학교가 하나뿐이면 저절로 고른다
  useEffect(() => {
    if (schools.length === 1 && !value) onChange(schools[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dir]);

  return (
    <label className="field">
      <span>{label}</span>
      {dir === null ? (
        <select disabled aria-label={ariaLabel}><option>학교 목록 불러오는 중…</option></select>
      ) : schools.length ? (
        <select value={normalizeSchool(value)} onChange={(e) => onChange(e.target.value)} aria-label={ariaLabel}>
          <option value="">학교를 고르세요</option>
          {schools.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder="예: 광양중동초등학교" maxLength={40} aria-label={ariaLabel} />
      )}
    </label>
  );
}
