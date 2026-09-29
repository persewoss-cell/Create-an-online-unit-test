// Firestore 보안 규칙 점검 (에뮬레이터 필요)
//   1) npm run emulators   2) 다른 터미널에서 npm run test:rules
import { initializeApp } from 'firebase/app';
import {
  getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInAnonymously, signOut,
} from 'firebase/auth';
import {
  getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, getDocs, updateDoc, writeBatch, serverTimestamp,
  terminate, query, where, collectionGroup,
} from 'firebase/firestore';

const PROJECT = 'demo-unit-test';
const HOST = '127.0.0.1';
let failed = 0;
let n = 0;

function client() {
  const app = initializeApp({ apiKey: 'demo', projectId: PROJECT, appId: 'x' }, `c${n++}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${HOST}:9099`, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, HOST, 8080);
  return { auth, db };
}

async function expectOk(name, fn) {
  try {
    await fn();
    console.log(`  ✔ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✘ ${name} — 허용되어야 하는데 거부됨: ${e.code || e.message}`);
  }
}
async function expectDenied(name, fn) {
  try {
    await fn();
    failed++;
    console.log(`  ✘ ${name} — 거부되어야 하는데 허용됨`);
  } catch (e) {
    if (e.code === 'permission-denied') console.log(`  ✔ ${name} (거부됨)`);
    else {
      failed++;
      console.log(`  ✘ ${name} — 예상치 못한 오류: ${e.code || e.message}`);
    }
  }
}

// 관리 도구(create-admin.mjs)가 하는 것처럼 관리자 권한으로 teachers 문서 생성
const makeTeacher = (uid) =>
  fetch(`http://${HOST}:8080/v1/projects/${PROJECT}/databases/(default)/documents/teachers/${uid}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { name: { stringValue: 'T' } } }),
  });

const stamp = Date.now();
const T = client();
const T2 = client();
const S = client();
const S2 = client();

console.log('교사');
const tUser = (await createUserWithEmailAndPassword(T.auth, `t${stamp}@x.kr`, 'secret123')).user;
await expectDenied('사이트에서 스스로 교사(관리자) 등록', () =>
  setDoc(doc(T.db, 'teachers', tUser.uid), { name: 'T', createdAt: serverTimestamp() }));
await makeTeacher(tUser.uid);

const examId = `exam${stamp}`;
await expectOk('평가 만들기', () =>
  setDoc(doc(T.db, 'exams', examId), { ownerUid: tUser.uid, status: 'open', grade: 5, questions: [], title: 't' }));
await expectOk('정답 저장', () => setDoc(doc(T.db, 'exams', examId, 'private', 'key'), { keys: { 1: { choices: [3] } } }));
await expectOk('페이지 저장', () => setDoc(doc(T.db, 'exams', examId, 'pages', '001'), { index: 1, data: 'x' }));

const t2 = (await createUserWithEmailAndPassword(T2.auth, `t2${stamp}@x.kr`, 'secret123')).user;
await makeTeacher(t2.uid);
await expectDenied('다른 교사의 정답 읽기', () => getDoc(doc(T2.db, 'exams', examId, 'private', 'key')));
await expectDenied('다른 교사의 평가 수정', () => updateDoc(doc(T2.db, 'exams', examId), { title: 'hack' }));

// 학생 명단 (관리 권한으로)
const putRoster = (sid, name) =>
  fetch(`http://${HOST}:8080/v1/projects/${PROJECT}/databases/(default)/documents/roster/${sid}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { name: { stringValue: name } } }),
  });
await putRoster('5-1-3', '홍길동');
await putRoster('5-1-5', '김철수');
const session = (c, uid, sid, name) => {
  const [grade, classNo, number] = sid.split('-').map(Number);
  return setDoc(doc(c.db, 'studentSessions', uid), { studentId: sid, name, grade, classNo, number, at: serverTimestamp() });
};

console.log('학생');
const sUser = (await signInAnonymously(S.auth)).user;
await expectDenied('명단에 없는 학생 로그인', () => session(S, sUser.uid, '5-1-9', '누구'));
await expectDenied('이름이 틀린 로그인', () => session(S, sUser.uid, '5-1-3', '홍길순'));
await expectDenied('학생이 명단 읽기', () => getDoc(doc(S.db, 'roster', '5-1-3')));
await expectDenied('세션 없이 제출', () => submit(S, sUser.uid, '5-1-3'));
await expectOk('명단과 같은 학생 로그인', () => session(S, sUser.uid, '5-1-3', '홍길동'));
await expectDenied('익명 사용자가 교사 등록', () =>
  setDoc(doc(S.db, 'teachers', sUser.uid), { name: 'S', createdAt: serverTimestamp() }));
await expectOk('열린 평가 읽기', () => getDoc(doc(S.db, 'exams', examId)));
await expectOk('문제지 페이지 읽기', () => getDoc(doc(S.db, 'exams', examId, 'pages', '001')));
await expectDenied('제출 전 정답 읽기', () => getDoc(doc(S.db, 'exams', examId, 'private', 'key')));
await expectDenied('평가 수정', () => updateDoc(doc(S.db, 'exams', examId), { status: 'closed' }));

function submit(c, uid, sid, extra = {}) {
  const b = writeBatch(c.db);
  const [grade, classNo, number] = sid.split('-').map(Number);
  b.set(doc(c.db, 'exams', examId, 'submissions', sid), {
    uid, studentId: sid, grade, classNo, number, name: '홍길동', answers: { 1: [3] }, submittedAt: serverTimestamp(), ...extra,
  });
  b.set(doc(c.db, 'exams', examId, 'submitters', uid), { studentId: sid, at: serverTimestamp() });
  return b.commit();
}
await expectDenied('다른 학생 번호로 제출', () => submit(S, sUser.uid, '5-1-5'));
await expectDenied('번호와 문서 ID가 다른 제출', () => submit(S, sUser.uid, '5-1-3', { number: 4 }));
await expectDenied('점수를 직접 넣은 제출', () => submit(S, sUser.uid, '5-1-3', { overrides: { 1: 'correct' } }));
await expectOk('답안 제출', () => submit(S, sUser.uid, '5-1-3'));
await expectOk('제출 후 정답 읽기', () => getDoc(doc(S.db, 'exams', examId, 'private', 'key')));
await expectOk('내 답안 읽기', () => getDoc(doc(S.db, 'exams', examId, 'submissions', '5-1-3')));
await expectDenied('제출한 답안 고치기', () =>
  updateDoc(doc(S.db, 'exams', examId, 'submissions', '5-1-3'), { answers: { 1: [1] } }));
await expectDenied('스스로 정답 판정하기', () =>
  updateDoc(doc(S.db, 'exams', examId, 'submissions', '5-1-3'), { overrides: { 1: 'correct' } }));

const s2 = (await signInAnonymously(S2.auth)).user;
await session(S2, s2.uid, '5-1-5', '김철수');
await expectDenied('다른 학생 답안 읽기', () => getDoc(doc(S2.db, 'exams', examId, 'submissions', '5-1-3')));
await expectOk('아직 없는 답안 확인', () => getDoc(doc(S2.db, 'exams', examId, 'submissions', '5-1-9')));
const S4 = client();
const s4 = (await signInAnonymously(S4.auth)).user;
await session(S4, s4.uid, '5-1-3', '홍길동');
await expectDenied('같은 번호로 다시 제출 (다른 기기)', () => submit(S4, s4.uid, '5-1-3'));
await expectOk('다른 기기에서 내 결과 보기', () => getDoc(doc(S4.db, 'exams', examId, 'submissions', '5-1-3')));
await expectOk('다른 기기에서 정답(채점용) 읽기', () => getDoc(doc(S4.db, 'exams', examId, 'private', 'key')));
await expectOk('내 결과 모아 보기', () =>
  getDocs(query(collectionGroup(S4.db, 'submissions'), where('studentId', '==', '5-1-3'))));
await expectDenied('남의 결과 모아 보기', () =>
  getDocs(query(collectionGroup(S4.db, 'submissions'), where('studentId', '==', '5-1-5'))));

console.log('교사 판정');
await expectOk('교사가 정답 판정', () =>
  updateDoc(doc(T.db, 'exams', examId, 'submissions', '5-1-3'), { 'overrides.1': 'correct', reviewedAt: serverTimestamp() }));
await expectDenied('교사가 학생 답안 변조', () =>
  updateDoc(doc(T.db, 'exams', examId, 'submissions', '5-1-3'), { answers: { 1: [1] } }));

console.log('마감');
await updateDoc(doc(T.db, 'exams', examId), { status: 'closed' });
const S3 = client();
const s3 = (await signInAnonymously(S3.auth)).user;
await expectDenied('마감된 평가 읽기 (응시 안 한 학생)', () => getDoc(doc(S3.db, 'exams', examId)));
await expectOk('마감된 평가도 응시한 학생은 결과 보기', () => getDoc(doc(S4.db, 'exams', examId)));
await expectDenied('마감된 평가에 제출', () => submit(S3, s3.uid, '5-1-5'));

for (const c of [T, T2, S, S2, S3, S4]) {
  await signOut(c.auth);
  await terminate(c.db);
}
console.log(failed ? `\n${failed}개 실패` : '\n모든 보안 규칙 점검 통과');
process.exit(failed ? 1 : 0);
