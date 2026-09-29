// Firestore 데이터 구조
//  teachers/{uid}                      관리자(교사) 프로필 — 관리 도구로만 생성
//  exams/{examId}                      평가 정보 + 문항(정답 제외)
//  exams/{examId}/pages/{n}            학생 화면에 보여줄 문제지 페이지 이미지
//  exams/{examId}/private/key          정답 (교사만, 또는 제출을 마친 학생만 읽기 가능)
//  exams/{examId}/submissions/{학년-반-번}  학생 답안 (한 번만 생성 가능 → 1회 응시)
//  exams/{examId}/submitters/{uid}     제출 표시 (정답 열람 권한 확인용)

import {
  collection, collectionGroup, doc, getDoc, getDocs, query, where, writeBatch, serverTimestamp, updateDoc, deleteField,
  setDoc, deleteDoc, onSnapshot,
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword, signOut, signInAnonymously, onAuthStateChanged, reauthenticateWithCredential,
  updatePassword, EmailAuthProvider, setPersistence, browserLocalPersistence, browserSessionPersistence,
} from 'firebase/auth';
import { auth, db } from '../firebase.js';

// ─────────────── 교사 ───────────────

export function watchAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

export async function getTeacher(uid) {
  const snap = await getDoc(doc(db, 'teachers', uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

// 관리자(교사) 한 명만 쓰는 사이트: 고정된 관리자 계정에 비밀번호만 입력해 로그인한다.
// 관리자 계정과 teachers 문서는 Firebase 관리 도구로 미리 만들어 둔다(README 참고).
export const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'admin@unit-test.app';

/** keep=true 면 브라우저를 닫아도 로그인 유지, false 면 브라우저를 닫으면 로그아웃 */
export async function adminSignIn(password, keep = true) {
  await setPersistence(auth, keep ? browserLocalPersistence : browserSessionPersistence);
  const cred = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
  const t = await getTeacher(cred.user.uid);
  if (!t) {
    await signOut(auth);
    throw new Error('관리자 계정 설정이 완료되지 않았습니다. README의 “관리자 계정 만들기”를 확인해 주세요.');
  }
  return t;
}

/** 관리자 비밀번호 변경 (현재 비밀번호 확인 후) */
export async function changeAdminPassword(current, next) {
  const user = auth.currentUser;
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(ADMIN_EMAIL, current));
  await updatePassword(user, next);
}

export function logout() {
  return signOut(auth);
}

// ─────────────── 평가 (교사) ───────────────

const pad = (n) => String(n).padStart(3, '0');

/** 평가 생성: 평가 문서 → 정답 → 페이지 이미지 순서로 저장 */
export async function createExam({ meta, questions, keys, pages, ownerUid, ownerName }, onProgress) {
  const ref = doc(collection(db, 'exams'));
  await setDoc(ref, {
    ...meta,
    questions,
    pageCount: pages.length,
    ownerUid,
    ownerName,
    status: 'draft',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await setDoc(doc(db, 'exams', ref.id, 'private', 'key'), { keys: stringKeys(keys) });
  for (let i = 0; i < pages.length; i++) {
    await setDoc(doc(db, 'exams', ref.id, 'pages', pad(i + 1)), { index: i + 1, data: pages[i] });
    onProgress?.(i + 1, pages.length);
  }
  return ref.id;
}

function stringKeys(keys) {
  return Object.fromEntries(Object.entries(keys).map(([k, v]) => [String(k), v]));
}

export async function listMyExams(uid) {
  const snap = await getDocs(query(collection(db, 'exams'), where('ownerUid', '==', uid)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

export async function getExam(id) {
  const snap = await getDoc(doc(db, 'exams', id));
  return snap.exists() ? { id, ...snap.data() } : null;
}

export function updateExam(id, patch) {
  return updateDoc(doc(db, 'exams', id), { ...patch, updatedAt: serverTimestamp() });
}

/** 평가(문항)를 실시간으로 — 시험 중에 선생님이 문제를 고치면 학생 화면에 바로 반영 */
export function watchExam(id, cb, onError) {
  return onSnapshot(doc(db, 'exams', id), (snap) => cb(snap.exists() ? { id, ...snap.data() } : null), onError);
}

/** 정답을 실시간으로 (제출한 학생의 결과 화면: 정답을 고치면 점수도 바로 다시 계산) */
export function watchKeys(examId, cb, onError) {
  return onSnapshot(doc(db, 'exams', examId, 'private', 'key'), (snap) => cb(snap.exists() ? snap.data().keys || {} : {}), onError);
}

export async function getKeys(examId) {
  const snap = await getDoc(doc(db, 'exams', examId, 'private', 'key'));
  return snap.exists() ? snap.data().keys || {} : {};
}

export async function saveQuestionsAndKeys(examId, questions, keys) {
  await updateExam(examId, { questions });
  await setDoc(doc(db, 'exams', examId, 'private', 'key'), { keys: stringKeys(keys) });
}

export async function deleteExam(examId) {
  for (const sub of ['pages', 'submissions', 'submitters', 'private']) {
    const snap = await getDocs(collection(db, 'exams', examId, sub));
    for (const d of snap.docs) await deleteDoc(d.ref);
  }
  await deleteDoc(doc(db, 'exams', examId));
}

export function watchSubmissions(examId, cb, onError) {
  return onSnapshot(
    collection(db, 'exams', examId, 'submissions'),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  );
}

export async function listSubmissions(examId) {
  const snap = await getDocs(collection(db, 'exams', examId, 'submissions'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** 교사 판정 저장. value가 null이면 판정 취소(자동 채점으로 되돌림) */
export function setOverride(examId, studentId, no, value) {
  return updateDoc(doc(db, 'exams', examId, 'submissions', studentId), {
    [`overrides.${no}`]: value ?? deleteField(),
    reviewedAt: serverTimestamp(),
  });
}

/** 응시 기록 삭제 → 그 학생은 다시 응시할 수 있다 */
export async function deleteSubmission(examId, submission) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'exams', examId, 'submissions', submission.id));
  if (submission.uid) batch.delete(doc(db, 'exams', examId, 'submitters', submission.uid));
  await batch.commit();
}

// ─────────────── 학생 ───────────────

export function studentIdOf(p) {
  return `${p.grade}-${p.classNo}-${p.number}`;
}

/** 공용 PC에서도 학생마다 새 세션을 쓰도록 매번 새 익명 로그인 */
async function createSession(uid, p) {
  try {
    await setDoc(doc(db, 'studentSessions', uid), {
      studentId: studentIdOf(p),
      name: p.name,
      grade: Number(p.grade),
      classNo: Number(p.classNo),
      number: Number(p.number),
      at: serverTimestamp(),
    });
  } catch (e) {
    if (e.code === 'permission-denied') {
      await signOut(auth);
      throw new Error('학생 명단에 없습니다. 학년·반·번호·이름을 정확히 입력했는지 확인하세요.');
    }
    throw e;
  }
}

/**
 * 학생 로그인: 공용 PC에서도 학생마다 새 세션을 쓰도록 매번 새 익명 로그인 후,
 * 학생 명단과 일치하는지 서버(보안 규칙)에서 확인하는 "학생 세션"을 만든다.
 */
export async function startStudentSession(p) {
  if (auth.currentUser) await signOut(auth);
  await setPersistence(auth, browserLocalPersistence);
  const cred = await signInAnonymously(auth);
  await createSession(cred.user.uid, p);
  return cred.user.uid;
}

export async function ensureStudentSession(p) {
  const u = auth.currentUser;
  if (u?.isAnonymous) {
    const snap = await getDoc(doc(db, 'studentSessions', u.uid)).catch(() => null);
    if (snap?.exists() && snap.data().studentId === studentIdOf(p) && snap.data().name === p.name) return u.uid;
  }
  return startStudentSession(p);
}

/** 이 학생이 제출한 모든 평가 (마감된 평가 포함) */
export async function listMyResults(p) {
  const snap = await getDocs(query(collectionGroup(db, 'submissions'), where('studentId', '==', studentIdOf(p))));
  const out = [];
  for (const d of snap.docs) {
    const examId = d.ref.parent.parent.id;
    try {
      const e = await getDoc(doc(db, 'exams', examId));
      if (e.exists()) out.push({ exam: { id: examId, ...e.data() }, submission: { id: d.id, ...d.data() } });
    } catch {
      /* 지워진 평가 등은 건너뜀 */
    }
  }
  return out;
}

// ─────────────── 학생 명단 (교사) ───────────────

export async function listRoster() {
  const snap = await getDocs(collection(db, 'roster'));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.grade - b.grade || a.classNo - b.classNo || a.number - b.number);
}

export async function saveRosterEntry(entry, oldId) {
  const e = { grade: Number(entry.grade), classNo: Number(entry.classNo), number: Number(entry.number), name: String(entry.name).trim() };
  const id = studentIdOf(e);
  const batch = writeBatch(db);
  if (oldId && oldId !== id) batch.delete(doc(db, 'roster', oldId));
  batch.set(doc(db, 'roster', id), e);
  await batch.commit();
  return { id, ...e };
}

export function deleteRosterEntry(id) {
  return deleteDoc(doc(db, 'roster', id));
}

/** 여러 명 한꺼번에 저장 (replace=true면 기존 명단을 지우고 새로) */
export async function saveRosterBulk(entries, replace) {
  const ids = new Set(entries.map((e) => studentIdOf(e)));
  const ops = [];
  if (replace) {
    const cur = await getDocs(collection(db, 'roster'));
    cur.docs.filter((d) => !ids.has(d.id)).forEach((d) => ops.push((b) => b.delete(d.ref)));
  }
  entries.forEach((e) =>
    ops.push((b) =>
      b.set(doc(db, 'roster', studentIdOf(e)), {
        grade: Number(e.grade), classNo: Number(e.classNo), number: Number(e.number), name: String(e.name).trim(),
      }),
    ),
  );
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(db);
    ops.slice(i, i + 400).forEach((op) => op(b));
    await b.commit();
  }
}

export async function listOpenExams(grade, classNo) {
  const snap = await getDocs(
    query(collection(db, 'exams'), where('status', '==', 'open'), where('grade', '==', Number(grade))),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((e) => !e.classes?.length || e.classes.includes(Number(classNo)))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

export async function getPages(examId) {
  const snap = await getDocs(collection(db, 'exams', examId, 'pages'));
  return snap.docs.map((d) => d.data()).sort((a, b) => a.index - b.index).map((p) => p.data);
}

/** @returns {'none'|'mine'|'taken'} */
export async function submissionState(examId, studentId) {
  try {
    const snap = await getDoc(doc(db, 'exams', examId, 'submissions', studentId));
    return snap.exists() ? 'mine' : 'none';
  } catch (e) {
    if (e.code === 'permission-denied') return 'taken';
    throw e;
  }
}

export async function submitAnswers(examId, profile, answers) {
  const uid = auth.currentUser.uid;
  const studentId = studentIdOf(profile);
  const batch = writeBatch(db);
  batch.set(doc(db, 'exams', examId, 'submissions', studentId), {
    uid,
    studentId,
    grade: Number(profile.grade),
    classNo: Number(profile.classNo),
    number: Number(profile.number),
    name: profile.name,
    answers: stringKeys(answers),
    submittedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'exams', examId, 'submitters', uid), { studentId, at: serverTimestamp() });
  try {
    await batch.commit();
  } catch (e) {
    if (e.code === 'permission-denied') {
      throw new Error('제출할 수 없습니다. 이미 응시했거나 평가가 마감되었습니다.');
    }
    throw e;
  }
  return studentId;
}

/** 내 답안을 실시간으로 받아 온다 (선생님이 검토하면 바로 반영) */
export function watchMySubmission(examId, studentId, cb, onError) {
  return onSnapshot(
    doc(db, 'exams', examId, 'submissions', studentId),
    (snap) => cb(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError,
  );
}

export async function getMySubmission(examId, studentId) {
  const snap = await getDoc(doc(db, 'exams', examId, 'submissions', studentId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
