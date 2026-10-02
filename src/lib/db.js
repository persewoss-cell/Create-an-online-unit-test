// Firestore 데이터 구조
//  teachers/{uid}                      선생님 프로필 {role:'teacher', school, grade, classNo, name, email}
//                                      (관리자 프로필은 관리 도구로만 생성)
//  teacherLogins/{학교_학년_반}         선생님 로그인 찾기표 → {email, uid}
//  teacherSecrets/{uid}                선생님 비밀번호 (관리자·본인만) — 관리자가 비밀번호를 바꿔 줄 때 사용
//  roster/{학교_학년-반-번호}            학생 명단 {school, grade, classNo, number, name, ownerUid}
//  studentSessions/{uid}               학생 로그인 세션 (명단과 일치해야 생성)
//  exams/{examId}                      평가 정보 + 문항(정답 제외)
//  exams/{examId}/pages/{n}            학생 화면에 보여줄 문제지 페이지 이미지
//  exams/{examId}/private/key          정답 (교사만, 또는 제출을 마친 학생만 읽기 가능)
//  exams/{examId}/submissions/{학년-반-번}  학생 답안 (한 번만 생성 가능 → 1회 응시)
//  exams/{examId}/submitters/{uid}     제출 표시 (정답 열람 권한 확인용)

import {
  collection, collectionGroup, doc, getDoc, getDocs, query, where, writeBatch, serverTimestamp, updateDoc, deleteField,
  setDoc, deleteDoc, onSnapshot, getDocFromServer, increment, arrayUnion,
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword, signOut, signInAnonymously, onAuthStateChanged, reauthenticateWithCredential,
  updatePassword, EmailAuthProvider, setPersistence, browserLocalPersistence, browserSessionPersistence,
  createUserWithEmailAndPassword, deleteUser,
} from 'firebase/auth';
import { auth, db, withHelperAuth } from '../firebase.js';
import {
  normalizeSchool, teacherLoginId, teacherAuthPassword, studentIdOf, gsidOf, DEFAULT_TEACHER_PASSWORD, LEGACY_SCHOOL,
} from './school.js';

export { studentIdOf, gsidOf };

// ─────────────── 교사 ───────────────

export function watchAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

export async function getTeacher(uid) {
  const snap = await getDoc(doc(db, 'teachers', uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

// 관리자: 고정된 관리자 계정에 비밀번호만 입력해 로그인한다.
// 관리자 계정과 teachers 문서는 Firebase 관리 도구로 미리 만들어 둔다(README 참고).
export const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'admin@unit-test.app';
const TEACHER_EMAIL_DOMAIN = 'teachers.unit-test.app';

export function isAdminUser(user = auth.currentUser) {
  return !!user && user.email === ADMIN_EMAIL;
}

async function persist(keep) {
  await setPersistence(auth, keep ? browserLocalPersistence : browserSessionPersistence);
}

/** keep=true 면 브라우저를 닫아도 로그인 유지, false 면 브라우저를 닫으면 로그아웃 */
export async function adminSignIn(password, keep = true) {
  await persist(keep);
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

/** 선생님 로그인: 학교·학년·반으로 계정을 찾아 비밀번호로 로그인 */
export async function teacherSignIn({ school, grade, classNo, password }, keep = true) {
  const login = await getDoc(doc(db, 'teacherLogins', teacherLoginId({ school, grade, classNo })));
  if (!login.exists()) {
    throw new Error('등록되지 않은 선생님입니다. 학교·학년·반을 확인하거나 관리자에게 문의해 주세요.');
  }
  if (auth.currentUser) await signOut(auth);
  await persist(keep);
  const cred = await signInWithEmailAndPassword(auth, login.data().email, teacherAuthPassword(password));
  const t = await getTeacher(cred.user.uid);
  if (!t) {
    await signOut(auth);
    throw new Error('선생님 계정이 삭제되었습니다. 관리자에게 문의해 주세요.');
  }
  return t;
}

/** 선생님이 직접 비밀번호 변경 */
export async function changeTeacherPassword(teacher, current, next) {
  const user = auth.currentUser;
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(teacher.email, teacherAuthPassword(current)));
  await updatePassword(user, teacherAuthPassword(next));
  await setDoc(doc(db, 'teacherSecrets', user.uid), { password: next, at: serverTimestamp() });
}

// ─────────────── 선생님 관리 (관리자) ───────────────

function randomId(n = 12) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return [...a].map((b) => (b % 36).toString(36)).join('');
}

function teacherInfo({ school, grade, classNo, name }) {
  const info = { school: normalizeSchool(school), grade: Number(grade), classNo: Number(classNo), name: String(name || '').trim() };
  if (!info.school || !(info.grade >= 1) || !(info.classNo >= 1)) throw new Error('학교, 학년, 반을 모두 입력해 주세요.');
  return info;
}

/** 모든 선생님 (관리자) — 비밀번호 포함 */
export async function listTeachers() {
  const [snap, secrets] = await Promise.all([
    getDocs(query(collection(db, 'teachers'), where('role', '==', 'teacher'))),
    getDocs(collection(db, 'teacherSecrets')),
  ]);
  const pw = Object.fromEntries(secrets.docs.map((d) => [d.id, d.data().password]));
  return snap.docs
    .map((d) => ({ uid: d.id, ...d.data(), password: pw[d.id] ?? '' }))
    .sort((a, b) => a.school.localeCompare(b.school, 'ko') || a.grade - b.grade || a.classNo - b.classNo);
}

/** 선생님 추가 (관리자). 비밀번호는 기본 0000 */
export async function addTeacher(input) {
  const info = teacherInfo(input);
  const loginId = teacherLoginId(info);
  if ((await getDoc(doc(db, 'teacherLogins', loginId))).exists()) {
    throw new Error(`${info.school} ${info.grade}학년 ${info.classNo}반 선생님은 이미 등록되어 있습니다.`);
  }
  const email = `t${randomId()}@${TEACHER_EMAIL_DOMAIN}`;
  const password = DEFAULT_TEACHER_PASSWORD;
  const uid = await withHelperAuth(async (h) => {
    const cred = await createUserWithEmailAndPassword(h, email, teacherAuthPassword(password));
    return cred.user.uid;
  });
  const batch = writeBatch(db);
  batch.set(doc(db, 'teachers', uid), { role: 'teacher', ...info, email, loginId, createdAt: serverTimestamp() });
  batch.set(doc(db, 'teacherLogins', loginId), { email, uid });
  batch.set(doc(db, 'teacherSecrets', uid), { password, at: serverTimestamp() });
  await batch.commit();
  return { uid, role: 'teacher', ...info, email, loginId, password };
}

/** 선생님 비밀번호 바꿔 주기 (관리자) — 저장해 둔 비밀번호로 그 계정에 들어가 새 비밀번호로 바꾼다 */
export async function setTeacherPassword(teacher, next) {
  const secret = await getDoc(doc(db, 'teacherSecrets', teacher.uid));
  const current = secret.exists() ? secret.data().password : DEFAULT_TEACHER_PASSWORD;
  await withHelperAuth(async (h) => {
    const cred = await signInWithEmailAndPassword(h, teacher.email, teacherAuthPassword(current));
    await updatePassword(cred.user, teacherAuthPassword(next));
  });
  await setDoc(doc(db, 'teacherSecrets', teacher.uid), { password: next, at: serverTimestamp() });
}

/** 선생님 학교·학년·반·이름 고치기 (관리자). 학교가 바뀌면 그 선생님의 평가·명단도 새 학교로 옮긴다 */
export async function updateTeacher(teacher, input) {
  const info = teacherInfo(input);
  const loginId = teacherLoginId(info);
  if (loginId !== teacher.loginId && (await getDoc(doc(db, 'teacherLogins', loginId))).exists()) {
    throw new Error(`${info.school} ${info.grade}학년 ${info.classNo}반 선생님은 이미 등록되어 있습니다.`);
  }
  const batch = writeBatch(db);
  if (teacher.loginId && loginId !== teacher.loginId) batch.delete(doc(db, 'teacherLogins', teacher.loginId));
  batch.set(doc(db, 'teacherLogins', loginId), { email: teacher.email, uid: teacher.uid });
  batch.update(doc(db, 'teachers', teacher.uid), { ...info, loginId });
  await batch.commit();
  if (info.school !== teacher.school) await moveTeacherData(teacher.uid, { ...teacher, ...info });
  return { ...teacher, ...info, loginId };
}

/** 선생님 삭제 (관리자). 로그인 계정도 지운다. 그 선생님이 만든 평가·명단은 남는다 */
export async function removeTeacher(teacher) {
  const secret = await getDoc(doc(db, 'teacherSecrets', teacher.uid));
  if (secret.exists()) {
    await withHelperAuth(async (h) => {
      const cred = await signInWithEmailAndPassword(h, teacher.email, teacherAuthPassword(secret.data().password));
      await deleteUser(cred.user);
    }).catch(() => {}); // 로그인 계정을 못 지워도 프로필이 없으면 로그인할 수 없다
  }
  const batch = writeBatch(db);
  if (teacher.loginId) batch.delete(doc(db, 'teacherLogins', teacher.loginId));
  batch.delete(doc(db, 'teacherSecrets', teacher.uid));
  batch.delete(doc(db, 'teachers', teacher.uid));
  await batch.commit();
}

async function commitOps(ops) {
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(db);
    ops.slice(i, i + 400).forEach((op) => op(b));
    await b.commit();
  }
}

/**
 * 평가(와 그 답안)·명단을 선생님(owner)에게 옮기고 학교를 붙인다 (관리자).
 * @param {string} fromUid 원래 주인 uid (그 사람의 평가를 옮김)
 * @param {object} owner   새 주인 선생님 {uid, school, grade, classNo, name}
 * @param {{legacyRoster?:boolean}} opt  legacyRoster: 학교가 없는 예전 명단도 옮김
 */
async function moveTeacherData(fromUid, owner, opt = {}) {
  const school = owner.school;
  const exams = await getDocs(query(collection(db, 'exams'), where('ownerUid', '==', fromUid)));
  let subCount = 0;
  for (const e of exams.docs) {
    await updateDoc(e.ref, { ownerUid: owner.uid, ownerName: teacherName(owner), school, updatedAt: serverTimestamp() });
    const subs = await getDocs(collection(db, 'exams', e.id, 'submissions'));
    subCount += subs.size;
    await commitOps(
      subs.docs.map((d) => (b) => b.update(d.ref, { school, gsid: `${school}_${d.data().studentId || d.id}` })),
    );
  }
  const roster = await getDocs(collection(db, 'roster'));
  const moving = roster.docs.filter((d) => {
    const x = d.data();
    return x.ownerUid === fromUid || (opt.legacyRoster && !x.school);
  });
  await commitOps(
    moving.flatMap((d) => {
      const x = d.data();
      const e = { school, grade: Number(x.grade), classNo: Number(x.classNo), number: Number(x.number), name: x.name, ownerUid: owner.uid };
      const id = gsidOf(e);
      return id === d.id ? [(b) => b.set(d.ref, e)] : [(b) => b.set(doc(db, 'roster', id), e), (b) => b.delete(d.ref)];
    }),
  );
  return { exams: exams.size, submissions: subCount, students: moving.length };
}

/** 관리자 계정으로 만든 예전 평가·명단이 남아 있는지 (학교 구분 전 자료) */
export async function legacyDataCount(adminUid) {
  const [exams, roster] = await Promise.all([
    getDocs(query(collection(db, 'exams'), where('ownerUid', '==', adminUid))),
    getDocs(collection(db, 'roster')),
  ]);
  const students = roster.docs.map((d) => d.data()).filter((x) => !x.school);
  const classes = {};
  students.forEach((x) => {
    const k = `${x.grade}-${x.classNo}`;
    classes[k] = (classes[k] || 0) + 1;
  });
  return { exams: exams.size, students: students.length, classes };
}

/**
 * 관리자로 만든 예전 평가·명단을 한 선생님 방으로 옮긴다 (관리자).
 * 그 학교·학년·반 선생님이 없으면 기본 비밀번호(0000)로 새로 만든다.
 */
export async function moveLegacyData(adminUid, { school = LEGACY_SCHOOL, grade, classNo, name }) {
  const info = teacherInfo({ school, grade, classNo, name });
  const login = await getDoc(doc(db, 'teacherLogins', teacherLoginId(info)));
  let owner;
  let created = false;
  if (login.exists()) owner = await getTeacher(login.data().uid);
  if (!owner) {
    owner = await addTeacher(info);
    created = true;
  }
  const moved = await moveTeacherData(adminUid, owner, { legacyRoster: true });
  return { owner, created, ...moved };
}

function teacherName(t) {
  return t.school ? `${t.school} ${t.grade}-${t.classNo}${t.name ? ` ${t.name}` : ''}` : t.name || '관리자';
}

export function logout() {
  return signOut(auth);
}

// ─────────────── 평가 (교사) ───────────────

const pad = (n) => String(n).padStart(3, '0');
const PAGE_CHUNK = 900_000; // 문서 하나에 넣는 이미지 글자 수

/** 페이지 이미지 저장. 고화질 이미지는 Firestore 문서 1MB 제한보다 커서 여러 조각으로 나눠 저장한다 */
async function writePages(examId, pages, onProgress) {
  for (let i = 0; i < pages.length; i++) {
    const parts = [];
    for (let at = 0; at < pages[i].length; at += PAGE_CHUNK) parts.push(pages[i].slice(at, at + PAGE_CHUNK));
    for (let j = 0; j < parts.length; j++) {
      await setDoc(doc(db, 'exams', examId, 'pages', j ? `${pad(i + 1)}-${j}` : pad(i + 1)), {
        index: i + 1, part: j, parts: parts.length, data: parts[j],
      });
    }
    onProgress?.(i + 1, pages.length);
  }
}

/** 문제지 이미지만 새로(고화질로) 바꾼다. 문항·정답·응시 기록은 그대로 */
export async function replacePages(examId, pages, patch, onProgress) {
  const old = await getDocs(collection(db, 'exams', examId, 'pages'));
  const keep = new Set();
  await writePages(examId, pages, onProgress);
  pages.forEach((pg, i) => {
    const n = Math.ceil(pg.length / PAGE_CHUNK);
    for (let j = 0; j < n; j++) keep.add(j ? `${pad(i + 1)}-${j}` : pad(i + 1));
  });
  for (const d of old.docs) if (!keep.has(d.id)) await deleteDoc(d.ref);
  await updateExam(examId, { ...patch, pageCount: pages.length });
}

/** 평가 생성: 평가 문서 → 정답 → 페이지 이미지 순서로 저장 */
export async function createExam({ meta, questions, keys, pages, owner }, onProgress) {
  const ref = doc(collection(db, 'exams'));
  await setDoc(ref, {
    ...meta,
    questions,
    pageCount: pages.length,
    ownerUid: owner.uid,
    ownerName: teacherName(owner),
    ...(owner.school ? { school: owner.school } : {}),
    status: 'draft',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await setDoc(doc(db, 'exams', ref.id, 'private', 'key'), { keys: stringKeys(keys) });
  await writePages(ref.id, pages, onProgress);
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

/**
 * 시험 보는 학생 화면용: 실시간 연결이 끊기거나(학교 와이파이, 화면 꺼짐) 늦어도 선생님이 고친 내용이 반드시 들어오도록
 *  1) 실시간 구독 — 오류가 나면 3초 뒤 다시 연결
 *  2) 20초마다, 그리고 화면을 다시 켜거나 인터넷이 다시 연결될 때 서버에서 직접 확인
 */
export function watchExamLive(id, cb) {
  let stopped = false;
  let unsub = () => {};
  let retry = null;
  const ref = doc(db, 'exams', id);
  const emit = (snap) => !stopped && cb(snap.exists() ? { id, ...snap.data() } : null);
  const subscribe = () => {
    unsub();
    unsub = onSnapshot(ref, emit, () => {
      clearTimeout(retry);
      retry = setTimeout(() => !stopped && subscribe(), 3000);
    });
  };
  const check = () => {
    if (stopped || document.visibilityState === 'hidden') return;
    getDocFromServer(ref).then(emit).catch(() => {});
  };
  const onVisible = () => {
    if (document.visibilityState !== 'visible') return;
    check();
    subscribe(); // 화면이 꺼졌다 켜지면 연결도 새로
  };
  subscribe();
  const timer = setInterval(check, 20000);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onVisible);
  window.addEventListener('focus', check);
  return () => {
    stopped = true;
    unsub();
    clearTimeout(retry);
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', onVisible);
    window.removeEventListener('focus', check);
  };
}

/** 정답을 실시간으로 (제출한 학생의 결과 화면: 정답을 고치면 점수도 바로 다시 계산) */
export function watchKeys(examId, cb, onError) {
  return onSnapshot(doc(db, 'exams', examId, 'private', 'key'), (snap) => cb(snap.exists() ? snap.data().keys || {} : {}), onError);
}

export async function getKeys(examId) {
  const snap = await getDoc(doc(db, 'exams', examId, 'private', 'key'));
  return snap.exists() ? snap.data().keys || {} : {};
}

/**
 * 문항·정답 저장. 정답을 먼저 저장한 뒤 평가 문서에 "고친 번호"와 수정 차례(revision)를 남긴다
 * → 시험 보는 학생 화면은 revision이 바뀐 것을 보고 바로 알림을 띄운다.
 */
export async function saveQuestionsAndKeys(examId, questions, keys, changedNos = []) {
  await setDoc(doc(db, 'exams', examId, 'private', 'key'), { keys: stringKeys(keys) });
  await updateExam(examId, { questions, revision: increment(1), lastEdit: { nos: changedNos, at: Date.now() } });
}

export async function deleteExam(examId) {
  for (const sub of ['pages', 'submissions', 'submitters', 'private', 'drafts']) {
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

/** 오답만 재응시 켜기/끄기 (여러 학생 한꺼번에). 처음 점수는 바뀌지 않는다 */
export async function setRetake(examId, studentIds, on) {
  await commitOps(
    studentIds.map((sid) => (b) => b.update(doc(db, 'exams', examId, 'submissions', sid), { retake: { on: !!on } })),
  );
}

/** 학생: 오답 재응시 답안 제출 (다시 푼 기록에 한 줄 추가, 처음 답안·점수는 그대로) */
export async function submitRetake(examId, profile, answers) {
  try {
    await updateDoc(doc(db, 'exams', examId, 'submissions', studentIdOf(profile)), {
      retakes: arrayUnion({ answers: stringKeys(answers), at: Date.now() }),
    });
  } catch (e) {
    if (e.code === 'permission-denied') throw new Error('지금은 오답 재응시를 제출할 수 없어요. 선생님께 문의하세요.');
    throw e;
  }
}

/** 응시 기록 삭제 → 그 학생은 다시 응시할 수 있다 */
export async function deleteSubmission(examId, submission) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'exams', examId, 'submissions', submission.id));
  if (submission.uid) batch.delete(doc(db, 'exams', examId, 'submitters', submission.uid));
  await batch.commit();
}

// ─────────────── 학생 ───────────────

/** 공용 PC에서도 학생마다 새 세션을 쓰도록 매번 새 익명 로그인 */
async function createSession(uid, p) {
  try {
    await setDoc(doc(db, 'studentSessions', uid), {
      studentId: studentIdOf(p),
      gsid: gsidOf(p),
      school: normalizeSchool(p.school),
      name: p.name,
      grade: Number(p.grade),
      classNo: Number(p.classNo),
      number: Number(p.number),
      at: serverTimestamp(),
    });
  } catch (e) {
    if (e.code === 'permission-denied') {
      await signOut(auth);
      throw new Error('학생 명단에 없습니다. 학교 이름·학년·반·번호·이름을 정확히 입력했는지 확인하세요.');
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
    if (snap?.exists() && snap.data().gsid === gsidOf(p) && snap.data().name === p.name) return u.uid;
  }
  return startStudentSession(p);
}

/** 이 학생이 제출한 모든 평가 (마감된 평가 포함) */
export async function listMyResults(p) {
  const snap = await getDocs(query(collectionGroup(db, 'submissions'), where('gsid', '==', gsidOf(p))));
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
// owner = 명단 주인 선생님 {uid, school} (관리자가 선생님 방을 볼 때는 그 선생님)

function rosterEntry(owner, e) {
  return {
    school: owner.school,
    grade: Number(e.grade),
    classNo: Number(e.classNo),
    number: Number(e.number),
    name: String(e.name).trim(),
    ownerUid: owner.uid,
  };
}

export async function listRoster(owner) {
  const snap = await getDocs(query(collection(db, 'roster'), where('ownerUid', '==', owner.uid)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.grade - b.grade || a.classNo - b.classNo || a.number - b.number);
}

export async function saveRosterEntry(owner, entry, oldId) {
  const e = rosterEntry(owner, entry);
  const id = gsidOf(e);
  const batch = writeBatch(db);
  if (oldId && oldId !== id) batch.delete(doc(db, 'roster', oldId));
  batch.set(doc(db, 'roster', id), e);
  await batch.commit();
  return { id, ...e };
}

export function deleteRosterEntry(id) {
  return deleteDoc(doc(db, 'roster', id));
}

/** 여러 명 한꺼번에 저장 (replace=true면 이 선생님의 기존 명단을 지우고 새로) */
export async function saveRosterBulk(owner, entries, replace) {
  const rows = entries.map((e) => rosterEntry(owner, e));
  const ids = new Set(rows.map((e) => gsidOf(e)));
  const ops = [];
  if (replace) {
    const cur = await getDocs(query(collection(db, 'roster'), where('ownerUid', '==', owner.uid)));
    cur.docs.filter((d) => !ids.has(d.id)).forEach((d) => ops.push((b) => b.delete(d.ref)));
  }
  rows.forEach((e) => ops.push((b) => b.set(doc(db, 'roster', gsidOf(e)), e)));
  await commitOps(ops);
}

export async function listOpenExams(school, grade, classNo) {
  const snap = await getDocs(
    query(
      collection(db, 'exams'),
      where('status', '==', 'open'),
      where('school', '==', normalizeSchool(school)),
      where('grade', '==', Number(grade)),
    ),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((e) => !e.classes?.length || e.classes.includes(Number(classNo)))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

export async function getPages(examId) {
  const snap = await getDocs(collection(db, 'exams', examId, 'pages'));
  const byPage = new Map();
  for (const d of snap.docs) {
    const x = d.data();
    if (!byPage.has(x.index)) byPage.set(x.index, []);
    byPage.get(x.index).push(x);
  }
  return [...byPage.keys()]
    .sort((a, b) => a - b)
    .map((i) => byPage.get(i).sort((a, b) => (a.part || 0) - (b.part || 0)).map((x) => x.data).join(''));
}

// ─────────────── 풀던 답 임시 저장 (서버) ───────────────
// 다른 기기에서 다시 로그인하거나 브라우저 저장소가 지워져도 풀던 답이 남도록 한다.

export async function saveServerDraft(examId, profile, draft) {
  const studentId = studentIdOf(profile);
  await setDoc(doc(db, 'exams', examId, 'drafts', studentId), {
    studentId,
    answers: JSON.parse(JSON.stringify(draft.answers || {})),
    shapes: draft.shapes || {},
    cur: Number(draft.cur) || 0,
    at: Number(draft.at) || Date.now(),
  });
}

export async function loadServerDraft(examId, profile) {
  try {
    const snap = await getDoc(doc(db, 'exams', examId, 'drafts', studentIdOf(profile)));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

export async function deleteServerDraft(examId, profile) {
  try {
    await deleteDoc(doc(db, 'exams', examId, 'drafts', studentIdOf(profile)));
  } catch {
    /* 무시 */
  }
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
    gsid: gsidOf(profile),
    school: normalizeSchool(profile.school),
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
