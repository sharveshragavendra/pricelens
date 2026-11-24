import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

function hasValidFirebaseConfig(): boolean {
  const { apiKey, authDomain, projectId, appId } = firebaseConfig;
  if (!apiKey || !authDomain || !projectId || !appId) return false;
  if (apiKey.includes('your_') || projectId.includes('your-')) return false;
  return true;
}

export const isFirebaseConfigured = hasValidFirebaseConfig();
export const useFirebaseStorage =
  isFirebaseConfigured &&
  import.meta.env.VITE_FIREBASE_USE_STORAGE === 'true' &&
  Boolean(firebaseConfig.storageBucket);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  // Enable IndexedDB offline persistence so live scanning & catalog edits work offline
  // with zero per-scan API cost and automatic background sync when online.
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
  if (useFirebaseStorage) {
    storage = getStorage(app);
  }
}

export { app, auth, db, storage };
