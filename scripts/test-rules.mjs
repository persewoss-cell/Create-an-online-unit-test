// Firestore 보안 규칙 점검 (에뮬레이터 필요)
//   1) npm run emulators   2) 다른 터미널에서 npm run test:rules
import { initializeApp } from 'firebase/app';
import {
  getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInAnonymously, signOut,
} from 'firebase/auth';
import {
  getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, getDocs, updateDoc, writeBatch, serverTimestamp,
  terminate, query, where, collectionGroup, deleteDoc, collection, arrayUnion,
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

const FS = `http://${HOST}:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
// 관리 도구(create-admin.mjs)가 하는 것처럼 관리자 권한으로 문서 쓰기
const adminPut = (path, fields) =>
  fetch(`${FS}/${path}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: Object.fromEntries(
        Object.entries(fields).map(([k, v]) => [k, typeof v === 'number' ? { integerValue: String(v) } : { stringValue: v }]),
      ),
    }),
  });

const stamp = Date.now();
const SCHOOL = `가나초등학교${stamp}`;
const OTHER = `다라초등학교${stamp}`;
const A = client(); // 관리자
const T = client(); // 선생님 1 (SCHOOL 5-1)
const T2 = client(); // 선생님 2 (OTHER 5-1)
const S = client();
const S2 = client();

console.log('관리자·선생님 계정');
const aUser = (await createUserWithEmailAndPassword(A.auth, 'admin@unit-test.app', 'admin1234').catch(async () => {
  const { signInWithEmailAndPassword } = await import('firebase/auth');
  return signInWithEmailAndPassword(A.auth, 'admin@unit-test.app', 'admin1234');
})).user;
await adminPut(`teachers/${aUser.uid}`, { name: '관리자', email: 'admin@unit-test.app' });

const tUser = (await createUserWithEmailAndPassword(T.auth, `t${stamp}@teachers.unit-test.app`, 'ut-0000-pw')).user;
await expectDenied('사이트에서 스스로 선생님 등록', () =>
  setDoc(doc(T.db, 'teachers', tUser.uid), { role: 'teacher', school: SCHOOL, grade: 5, classNo: 1 }));
await expectOk('관리자가 선생님 추가', async () => {
  const b = writeBatch(A.db);
  b.set(doc(A.db, 'teachers', tUser.uid), { role: 'teacher', school: SCHOOL, grade: 5, classNo: 1, name: '', email: tUser.email, loginId: `${SCHOOL}_5_1` });
  b.set(doc(A.db, 'teacherLogins', `${SCHOOL}_5_1`), { email: tUser.email, uid: tUser.uid });
  b.set(doc(A.db, 'teacherSecrets', tUser.uid), { password: '0000' });
  await b.commit();
});
const t2 = (await createUserWithEmailAndPassword(T2.auth, `t2${stamp}@teachers.unit-test.app`, 'ut-0000-pw')).user;
await expectOk('관리자가 다른 학교 선생님 추가', async () => {
  const b = writeBatch(A.db);
  b.set(doc(A.db, 'teachers', t2.uid), { role: 'teacher', school: OTHER, grade: 5, classNo: 1, name: '', email: t2.email });
  b.set(doc(A.db, 'teacherSecrets', t2.uid), { password: '0000' });
  await b.commit();
});
const anon = client();
await expectOk('로그인 전 선생님 찾기표 한 건 읽기', () => getDoc(doc(anon.db, 'teacherLogins', `${SCHOOL}_5_1`)));
await expectDenied('로그인 전 선생님 찾기표 전체 보기', () => getDocs(collection(anon.db, 'teacherLogins')));
await expectDenied('선생님이 찾기표 고치기', () => setDoc(doc(T.db, 'teacherLogins', `${SCHOOL}_5_2`), { email: 'x', uid: 'y' }));
await expectOk('선생님이 자기 비밀번호 기록 바꾸기', () => setDoc(doc(T.db, 'teacherSecrets', tUser.uid), { password: '1234' }));
await expectDenied('다른 선생님 비밀번호 보기', () => getDoc(doc(T.db, 'teacherSecrets', t2.uid)));
await expectDenied('선생님이 자기 학교 바꾸기', () => updateDoc(doc(T.db, 'teachers', tUser.uid), { school: OTHER }));
await expectDenied('선생님이 선생님 목록 보기', () => getDocs(collection(T.db, 'teachers')));
await expectOk('관리자가 선생님 목록·비밀번호 보기', async () => {
  await getDocs(collection(A.db, 'teachers'));
  await getDocs(collection(A.db, 'teacherSecrets'));
});

console.log('평가');
const examId = `exam${stamp}`;
await expectDenied('다른 학교 이름으로 평가 만들기', () =>
  setDoc(doc(T.db, 'exams', `${examId}x`), { ownerUid: tUser.uid, school: OTHER, status: 'open', grade: 5, questions: [], title: 't' }));
await expectOk('평가 만들기', () =>
  setDoc(doc(T.db, 'exams', examId), { ownerUid: tUser.uid, school: SCHOOL, status: 'open', grade: 5, questions: [], title: 't' }));
await expectOk('정답 저장', () => setDoc(doc(T.db, 'exams', examId, 'private', 'key'), { keys: { 1: { choices: [3] } } }));
await expectOk('페이지 저장', () => setDoc(doc(T.db, 'exams', examId, 'pages', '001'), { index: 1, data: 'x' }));
await expectDenied('평가의 학교 바꾸기', () => updateDoc(doc(T.db, 'exams', examId), { school: OTHER }));
await expectDenied('다른 선생님의 정답 읽기', () => getDoc(doc(T2.db, 'exams', examId, 'private', 'key')));
await expectDenied('다른 선생님의 평가 수정', () => updateDoc(doc(T2.db, 'exams', examId), { title: 'hack' }));
await expectOk('관리자가 선생님 평가 보기·고치기', async () => {
  await getDoc(doc(A.db, 'exams', examId, 'private', 'key'));
  await updateDoc(doc(A.db, 'exams', examId), { title: '관리자 수정' });
});
await expectOk('관리자가 선생님 평가 목록 보기', () =>
  getDocs(query(collection(A.db, 'exams'), where('ownerUid', '==', tUser.uid))));

console.log('학생 명단');
const rosterDoc = (c, school, sid, name, ownerUid) => {
  const [grade, classNo, number] = sid.split('-').map(Number);
  return setDoc(doc(c.db, 'roster', `${school}_${sid}`), { school, grade, classNo, number, name, ownerUid });
};
await expectOk('선생님이 명단 추가', () => rosterDoc(T, SCHOOL, '5-1-3', '홍길동', tUser.uid));
await expectOk('선생님이 명단 추가 2', () => rosterDoc(T, SCHOOL, '5-1-5', '김철수', tUser.uid));
await expectDenied('다른 학교 명단 추가', () => rosterDoc(T, OTHER, '5-1-3', '홍길동', tUser.uid));
await expectDenied('문서 ID가 다른 명단', () =>
  setDoc(doc(T.db, 'roster', `${SCHOOL}_5-1-9`), { school: SCHOOL, grade: 5, classNo: 1, number: 3, name: 'x', ownerUid: tUser.uid }));
await expectOk('다른 학교 선생님 명단 (같은 번호)', () => rosterDoc(T2, OTHER, '5-1-3', '이영희', t2.uid));
await expectDenied('다른 선생님 명단 덮어쓰기', () => rosterDoc(T2, SCHOOL, '5-1-3', '가짜', t2.uid));
await expectDenied('다른 선생님 명단 읽기', () => getDoc(doc(T2.db, 'roster', `${SCHOOL}_5-1-3`)));
await expectOk('내 명단 모아 보기', () => getDocs(query(collection(T.db, 'roster'), where('ownerUid', '==', tUser.uid))));
await expectOk('관리자가 모든 명단 보기', () => getDocs(collection(A.db, 'roster')));

const session = (c, uid, school, sid, name) => {
  const [grade, classNo, number] = sid.split('-').map(Number);
  return setDoc(doc(c.db, 'studentSessions', uid), {
    studentId: sid, gsid: `${school}_${sid}`, school, name, grade, classNo, number, at: serverTimestamp(),
  });
};

console.log('학생');
const sUser = (await signInAnonymously(S.auth)).user;
await expectDenied('명단에 없는 학생 로그인', () => session(S, sUser.uid, SCHOOL, '5-1-9', '누구'));
await expectDenied('이름이 틀린 로그인', () => session(S, sUser.uid, SCHOOL, '5-1-3', '홍길순'));
await expectDenied('학교가 틀린 로그인', () => session(S, sUser.uid, OTHER, '5-1-3', '홍길동'));
await expectDenied('학교 없이 로그인 (예전 방식)', () =>
  setDoc(doc(S.db, 'studentSessions', sUser.uid), { studentId: '5-1-3', name: '홍길동', grade: 5, classNo: 1, number: 3, at: serverTimestamp() }));
await expectDenied('학생이 명단 읽기', () => getDoc(doc(S.db, 'roster', `${SCHOOL}_5-1-3`)));
await expectDenied('세션 없이 제출', () => submit(S, sUser.uid, SCHOOL, '5-1-3'));
await expectOk('명단과 같은 학생 로그인', () => session(S, sUser.uid, SCHOOL, '5-1-3', '홍길동'));
await expectDenied('익명 사용자가 교사 등록', () =>
  setDoc(doc(S.db, 'teachers', sUser.uid), { name: 'S', createdAt: serverTimestamp() }));
await expectOk('열린 평가 읽기', () => getDoc(doc(S.db, 'exams', examId)));
await expectOk('우리 학교 열린 평가 목록', () =>
  getDocs(query(collection(S.db, 'exams'), where('status', '==', 'open'), where('school', '==', SCHOOL), where('grade', '==', 5))));
await expectOk('문제지 페이지 읽기', () => getDoc(doc(S.db, 'exams', examId, 'pages', '001')));
await expectDenied('제출 전 정답 읽기', () => getDoc(doc(S.db, 'exams', examId, 'private', 'key')));
await expectDenied('평가 수정', () => updateDoc(doc(S.db, 'exams', examId), { status: 'closed' }));

function submit(c, uid, school, sid, extra = {}, exam = examId) {
  const b = writeBatch(c.db);
  const [grade, classNo, number] = sid.split('-').map(Number);
  b.set(doc(c.db, 'exams', exam, 'submissions', sid), {
    uid, studentId: sid, gsid: `${school}_${sid}`, school, grade, classNo, number, name: '홍길동', answers: { 1: [3] },
    submittedAt: serverTimestamp(), ...extra,
  });
  b.set(doc(c.db, 'exams', exam, 'submitters', uid), { studentId: sid, at: serverTimestamp() });
  return b.commit();
}
const draft = (c, sid, extra = {}) =>
  setDoc(doc(c.db, 'exams', examId, 'drafts', sid), { studentId: sid, answers: { 1: [2] }, shapes: {}, cur: 0, at: Date.now(), ...extra });
await expectOk('풀던 답 임시 저장', () => draft(S, '5-1-3'));
await expectOk('임시 저장한 답 읽기', () => getDoc(doc(S.db, 'exams', examId, 'drafts', '5-1-3')));
await expectDenied('다른 학생 번호로 임시 저장', () => draft(S, '5-1-5'));
await expectDenied('임시 저장에 다른 칸 넣기', () => draft(S, '5-1-3', { score: 100 }));
await expectOk('선생님이 임시 저장 읽기', () => getDoc(doc(T.db, 'exams', examId, 'drafts', '5-1-3')));
await expectDenied('다른 학생 번호로 제출', () => submit(S, sUser.uid, SCHOOL, '5-1-5'));
await expectDenied('번호와 문서 ID가 다른 제출', () => submit(S, sUser.uid, SCHOOL, '5-1-3', { number: 4 }));
await expectDenied('다른 학교라고 적은 제출', () => submit(S, sUser.uid, OTHER, '5-1-3'));
await expectDenied('점수를 직접 넣은 제출', () => submit(S, sUser.uid, SCHOOL, '5-1-3', { overrides: { 1: 'correct' } }));
await expectOk('답안 제출', () => submit(S, sUser.uid, SCHOOL, '5-1-3'));
await expectOk('제출 후 정답 읽기', () => getDoc(doc(S.db, 'exams', examId, 'private', 'key')));
await expectOk('내 답안 읽기', () => getDoc(doc(S.db, 'exams', examId, 'submissions', '5-1-3')));
await expectDenied('제출한 답안 고치기', () =>
  updateDoc(doc(S.db, 'exams', examId, 'submissions', '5-1-3'), { answers: { 1: [1] } }));
await expectDenied('스스로 정답 판정하기', () =>
  updateDoc(doc(S.db, 'exams', examId, 'submissions', '5-1-3'), { overrides: { 1: 'correct' } }));

const s2 = (await signInAnonymously(S2.auth)).user;
await session(S2, s2.uid, SCHOOL, '5-1-5', '김철수');
await expectDenied('다른 학생 답안 읽기', () => getDoc(doc(S2.db, 'exams', examId, 'submissions', '5-1-3')));
await expectDenied('다른 학생 임시 저장 읽기', () => getDoc(doc(S2.db, 'exams', examId, 'drafts', '5-1-3')));
await expectOk('아직 없는 답안 확인', () => getDoc(doc(S2.db, 'exams', examId, 'submissions', '5-1-9')));

console.log('다른 학교 같은 번호 학생');
const S5 = client();
const s5 = (await signInAnonymously(S5.auth)).user;
await session(S5, s5.uid, OTHER, '5-1-3', '이영희');
await expectDenied('다른 학교 학생이 같은 번호 답안 읽기', () => getDoc(doc(S5.db, 'exams', examId, 'submissions', '5-1-3')));
await expectDenied('다른 학교 학생이 같은 번호 임시 저장 읽기', () => getDoc(doc(S5.db, 'exams', examId, 'drafts', '5-1-3')));
await expectDenied('다른 학교 평가에 제출', () => submit(S5, s5.uid, OTHER, '5-1-5'));
await expectDenied('다른 학교 학생이 정답 읽기', () => getDoc(doc(S5.db, 'exams', examId, 'private', 'key')));
await expectDenied('다른 학교 학생 결과 모아 보기', () =>
  getDocs(query(collectionGroup(S5.db, 'submissions'), where('gsid', '==', `${SCHOOL}_5-1-3`))));

const S4 = client();
const s4 = (await signInAnonymously(S4.auth)).user;
await session(S4, s4.uid, SCHOOL, '5-1-3', '홍길동');
await expectDenied('같은 번호로 다시 제출 (다른 기기)', () => submit(S4, s4.uid, SCHOOL, '5-1-3'));
await expectOk('다른 기기에서 풀던 답 불러오기', () => getDoc(doc(S4.db, 'exams', examId, 'drafts', '5-1-3')));
await expectOk('제출 후 임시 저장 지우기', () => deleteDoc(doc(S4.db, 'exams', examId, 'drafts', '5-1-3')));
await expectOk('다른 기기에서 내 결과 보기', () => getDoc(doc(S4.db, 'exams', examId, 'submissions', '5-1-3')));
await expectOk('다른 기기에서 정답(채점용) 읽기', () => getDoc(doc(S4.db, 'exams', examId, 'private', 'key')));
await expectOk('내 결과 모아 보기', () =>
  getDocs(query(collectionGroup(S4.db, 'submissions'), where('gsid', '==', `${SCHOOL}_5-1-3`))));
await expectDenied('남의 결과 모아 보기', () =>
  getDocs(query(collectionGroup(S4.db, 'submissions'), where('gsid', '==', `${SCHOOL}_5-1-5`))));

console.log('선생님 판정');
await expectOk('선생님이 정답 판정', () =>
  updateDoc(doc(T.db, 'exams', examId, 'submissions', '5-1-3'), { 'overrides.1': 'correct', reviewedAt: serverTimestamp() }));
await expectDenied('선생님이 학생 답안 변조', () =>
  updateDoc(doc(T.db, 'exams', examId, 'submissions', '5-1-3'), { answers: { 1: [1] } }));
await expectOk('관리자가 정답 판정', () =>
  updateDoc(doc(A.db, 'exams', examId, 'submissions', '5-1-3'), { 'overrides.1': 'wrong', reviewedAt: serverTimestamp() }));

console.log('오답 재응시');
const subRef = (c) => doc(c.db, 'exams', examId, 'submissions', '5-1-3');
const retake = (c, n) => updateDoc(subRef(c), { retakes: arrayUnion({ answers: { 1: [n] }, at: n }) });
await expectDenied('선생님이 켜기 전에 오답 재응시', () => retake(S4, 1));
await expectDenied('학생이 스스로 오답 재응시 켜기', () => updateDoc(subRef(S4), { retake: { on: true } }));
await expectOk('선생님이 오답 재응시 켜기', () => updateDoc(subRef(T), { retake: { on: true } }));
await expectOk('오답 재응시 제출', () => retake(S4, 2));
await expectOk('또 틀려서 다시 제출', () => retake(S4, 3));
await expectDenied('오답 재응시하면서 처음 답안 고치기', () =>
  updateDoc(subRef(S4), { retakes: arrayUnion({ answers: { 1: [3] }, at: 9 }), answers: { 1: [1] } }));
await expectDenied('다시 푼 기록 지우기', () => updateDoc(subRef(S4), { retakes: [] }));
await expectDenied('다시 푼 기록 바꿔치기', () =>
  updateDoc(subRef(S4), { retakes: [{ answers: { 1: [3] }, at: 1 }, { answers: { 1: [3] }, at: 2 }, { answers: { 1: [3] }, at: 3 }] }));
await expectDenied('다른 학생이 오답 재응시 제출', () => retake(S2, 4));
await expectDenied('다른 학교 같은 번호 학생이 오답 재응시 제출', () => retake(S5, 5));

console.log('예전 자료 옮기기');
const oldExam = `old${stamp}`;
await adminPut(`exams/${oldExam}`, { ownerUid: aUser.uid, status: 'closed', title: '예전' });
await adminPut(`exams/${oldExam}/submissions/5-1-3`, { uid: 'x', studentId: '5-1-3', name: '홍길동' });
await adminPut('roster/5-1-3', { grade: 5, classNo: 1, number: 3, name: '홍길동' });
await expectOk('관리자가 예전 평가를 선생님에게 넘기기', () =>
  updateDoc(doc(A.db, 'exams', oldExam), { ownerUid: tUser.uid, school: SCHOOL }));
await expectDenied('선생님이 답안에 학교 붙이기', () =>
  updateDoc(doc(T.db, 'exams', oldExam, 'submissions', '5-1-3'), { school: SCHOOL, gsid: `${SCHOOL}_5-1-3` }));
await expectOk('관리자가 예전 답안에 학교 붙이기', () =>
  updateDoc(doc(A.db, 'exams', oldExam, 'submissions', '5-1-3'), { school: SCHOOL, gsid: `${SCHOOL}_5-1-3` }));
await expectOk('관리자가 예전 명단 옮기기', async () => {
  const b = writeBatch(A.db);
  b.set(doc(A.db, 'roster', `${SCHOOL}_5-1-7`), { school: SCHOOL, grade: 5, classNo: 1, number: 7, name: '박민수', ownerUid: tUser.uid });
  b.delete(doc(A.db, 'roster', '5-1-3'));
  await b.commit();
});
await expectOk('옮긴 뒤 학생이 마감된 예전 평가 결과 보기', () => getDoc(doc(S4.db, 'exams', oldExam)));

console.log('마감');
await updateDoc(doc(T.db, 'exams', examId), { status: 'closed' });
const S3 = client();
const s3 = (await signInAnonymously(S3.auth)).user;
await expectDenied('마감된 평가 읽기 (응시 안 한 학생)', () => getDoc(doc(S3.db, 'exams', examId)));
await expectOk('마감된 평가도 응시한 학생은 결과 보기', () => getDoc(doc(S4.db, 'exams', examId)));
await expectDenied('마감된 평가에 제출', () => submit(S3, s3.uid, SCHOOL, '5-1-5'));
await expectDenied('마감된 평가에 임시 저장', () => draft(S2, '5-1-5'));
await expectOk('마감 후에도 오답 재응시 제출', () => retake(S4, 6));
await expectOk('선생님이 오답 재응시 끄기', () => updateDoc(subRef(T), { retake: { on: false } }));
await expectDenied('꺼진 뒤 오답 재응시 제출', () => retake(S4, 7));

for (const c of [A, T, T2, S, S2, S3, S4, S5, anon]) {
  await signOut(c.auth);
  await terminate(c.db);
}
console.log(failed ? `\n${failed}개 실패` : '\n모든 보안 규칙 점검 통과');
process.exit(failed ? 1 : 0);
