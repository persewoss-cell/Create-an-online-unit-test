import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, initializeAuth, inMemoryPersistence, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const env = import.meta.env;
const useEmulator = env.VITE_USE_EMULATOR === 'true';

const config = useEmulator
  ? { apiKey: 'demo-key', authDomain: 'localhost', projectId: 'demo-unit-test', appId: 'demo' }
  : {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    };

export const firebaseReady = !!(config.apiKey && config.projectId);

export const app = firebaseReady ? initializeApp(config) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

const emulatorHost = () => env.VITE_EMULATOR_HOST || location.hostname || '127.0.0.1';

if (app && useEmulator) {
  connectAuthEmulator(auth, `http://${emulatorHost()}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, emulatorHost(), 8080);
}

let helperNo = 0;

/**
 * 관리자가 선생님 계정을 만들거나 비밀번호를 바꿀 때 쓰는 보조 로그인.
 * 관리자 로그인은 그대로 두고, 따로 떠 있는 로그인 창에서 선생님 계정으로 작업한 뒤 닫는다.
 */
export async function withHelperAuth(fn) {
  const helper = initializeApp(config, `helper-${++helperNo}`);
  const helperAuth = initializeAuth(helper, { persistence: inMemoryPersistence });
  if (useEmulator) connectAuthEmulator(helperAuth, `http://${emulatorHost()}:9099`, { disableWarnings: true });
  try {
    return await fn(helperAuth);
  } finally {
    await deleteApp(helper).catch(() => {});
  }
}
