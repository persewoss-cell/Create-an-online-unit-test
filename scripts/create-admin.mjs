// 관리자 계정 만들기 / 비밀번호 다시 설정
//   실제 서버:   npx firebase login  후  node scripts/create-admin.mjs <비밀번호>
//   에뮬레이터:  node scripts/create-admin.mjs <비밀번호> --emulator
// 관리자 이메일은 사이트와 같은 값(VITE_ADMIN_EMAIL, 기본 admin@unit-test.app)을 쓴다.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const [password, flag] = process.argv.slice(2);
const emulator = flag === '--emulator';
if (!password || password.length < 6) {
  console.error('사용법: node scripts/create-admin.mjs <6자 이상 비밀번호> [--emulator]');
  process.exit(1);
}
const EMAIL = process.env.VITE_ADMIN_EMAIL || 'admin@unit-test.app';
const PROJECT = emulator ? 'demo-unit-test' : JSON.parse(readFileSync('.firebaserc', 'utf8')).projects.default;

let H;
let AUTH;
let FS;
if (emulator) {
  H = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
  AUTH = `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/${PROJECT}`;
  FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
} else {
  const lib = require.resolve('firebase-tools/package.json').replace(/package\.json$/, 'lib/');
  const auth = require(lib + 'auth');
  const { configstore } = require(lib + 'configstore');
  const tokens = configstore.get('tokens');
  if (!tokens?.refresh_token) {
    console.error('먼저 npx firebase login 으로 로그인해 주세요.');
    process.exit(1);
  }
  const { access_token } = await auth.getAccessToken(tokens.refresh_token, []);
  H = { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json', 'x-goog-user-project': PROJECT };
  AUTH = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}`;
  FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
}

async function call(url, body) {
  const r = await fetch(url, { method: 'POST', headers: H, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j.error || j));
  return j;
}

const found = await call(`${AUTH}/accounts:lookup`, { email: [EMAIL] });
let uid = found.users?.[0]?.localId;
if (uid) {
  await call(`${AUTH}/accounts:update`, { localId: uid, password });
  console.log('기존 관리자 계정의 비밀번호를 바꿨습니다.');
} else {
  uid = (await call(`${AUTH}/accounts`, { email: EMAIL, password })).localId;
  console.log('관리자 계정을 만들었습니다.');
}
const r = await fetch(`${FS}/teachers/${uid}`, {
  method: 'PATCH',
  headers: H,
  body: JSON.stringify({ fields: { name: { stringValue: '관리자' }, email: { stringValue: EMAIL } } }),
});
if (!r.ok) throw new Error(await r.text());
console.log(`완료 (${PROJECT}, ${EMAIL})`);
