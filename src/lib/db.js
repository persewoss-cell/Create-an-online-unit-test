// Firestore 데이터 구조
//  teachers/{uid}                      교사 프로필 (가입 코드 확인 후 생성)
//  config/signup                       { code } 교사 가입 코드 (콘솔에서 직접 만듦, 아무도 읽을 수 없음)
//  exams/{examId}                      평가 정보 + 문항(정답 제외)
//  exams/{examId}/pages/{n}            학생 화면에 보여줄 문제지 페이지 이미지
//  exams/{examId}/private/key          정답 (교사만, 또는 제출을 마친 학생만 읽기 가능)
//  exams/{examId}/submissions/{학년-반-번}  학생 답안 (한 번만 생성 가능 → 1회 응시)
//  exams/{examId}/submitters/{uid}     제출 표시 (정답 열람 권한 확인용)

import {
  collection, doc, getDoc, getDocs, query, where, writeBatch, serverTimestamp, updateDoc, deleteField,
  setDoc, deleteDoc, onSnapshot,
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, signInAnonymously, onAuthStateChanged,
  sendPasswordResetEmail,
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

export async function teacherSignIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const t = await getTeacher(cred.user.uid);
  if (!t) {
    await signOut(auth);
    throw new Error('교사로 등록되지 않은 계정입니다. 교사 가입을 먼저 해 주세요.');
  }
  return t;
}

// 가입 처리 중에는 로그인 상태 감시를 잠시 멈춘다.
// (가입 코드가 틀린 teachers 문서 쓰기가 서버에서 거부되기 전에 로컬 캐시에 잠깐 보이기 때문)
export const signupState = { busy: false };

export async function teacherSignUp(input) {
  signupState.busy = true;
  try {
    return await doTeacherSignUp(input);
  } finally {
    signupState.busy = false;
  }
}

async function doTeacherSignUp({ name, email, password, code }) {
  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, email, password);
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') {
      // 계정은 있는데 교사 등록이 안 된 경우(가입 코드를 틀렸던 경우 등) 다시 시도할 수 있게
      cred = await signInWithEmailAndPassword(auth, email, password);
    } else throw e;
  }
  const existing = await getTeacher(cred.user.uid);
  if (existing) return existing;
  try {
    await setDoc(doc(db, 'teachers', cred.user.uid), {
      name, email, signupCode: code, createdAt: serverTimestamp(),
    });
  } catch (e) {
    await signOut(auth);
    if (e.code === 'permission-denied') throw new Error('교사 가입 코드가 올바르지 않습니다.');
    throw e;
  }
  return getTeacher(cred.user.uid);
}

export function resetPassword(email) {
  return sendPasswordResetEmail(auth, email);
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
export async function startStudentSession() {
  if (auth.currentUser) await signOut(auth);
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}

export async function ensureStudentSession() {
  if (auth.currentUser?.isAnonymous) return auth.currentUser.uid;
  return startStudentSession();
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

export async function getMySubmission(examId, studentId) {
  const snap = await getDoc(doc(db, 'exams', examId, 'submissions', studentId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
