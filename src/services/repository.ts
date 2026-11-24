import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, isFirebaseConfigured, storage, useFirebaseStorage } from '../config/firebase';
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type AuthState,
  type Product,
  type ProductAngle,
} from '../types';
import { dataUrlToBlob } from './imageUtils';
import {
  localClearAllProducts,
  localDeleteProduct,
  localGetAllProducts,
  localGetSettings,
  localReplaceProducts,
  localSaveProduct,
  localSaveSettings,
} from './indexedDbStore';

/**
 * Unified PriceLens Data Repository
 * - Primary mode: Firebase Auth + Cloud Firestore (with IndexedDB offline cache) + optional Firebase Storage.
 * - Fallback mode: Local IndexedDB when .env Firebase keys are not yet configured.
 */

const localProductListeners = new Set<(products: Product[]) => void>();
const localSettingsListeners = new Set<(settings: AppSettings) => void>();

async function emitLocalProducts(): Promise<void> {
  const products = await localGetAllProducts();
  localProductListeners.forEach((cb) => cb(products));
}

async function emitLocalSettings(): Promise<void> {
  const settings = await localGetSettings();
  localSettingsListeners.forEach((cb) => cb(settings));
}

export function subscribeAuth(onChange: (state: AuthState) => void): () => void {
  if (!isFirebaseConfigured || !auth) {
    onChange({
      mode: 'local',
      ready: true,
      uid: 'local-shop',
      email: null,
      isAnonymous: true,
      error: null,
    });
    return () => undefined;
  }

  let attemptedAnon = false;

  const unsubscribe = onAuthStateChanged(
    auth,
    async (user: User | null) => {
      if (user) {
        onChange({
          mode: 'firebase',
          ready: true,
          uid: user.uid,
          email: user.email,
          isAnonymous: user.isAnonymous,
          error: null,
        });
        return;
      }

      if (!attemptedAnon) {
        attemptedAnon = true;
        try {
          await signInAnonymously(auth!);
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : 'Enable Anonymous or Email/Password Auth in Firebase Console.';
          onChange({
            mode: 'firebase',
            ready: true,
            uid: null,
            email: null,
            isAnonymous: false,
            error: message,
          });
        }
      } else {
        onChange({
          mode: 'firebase',
          ready: true,
          uid: null,
          email: null,
          isAnonymous: false,
          error: null,
        });
      }
    },
    (err) => {
      onChange({
        mode: 'firebase',
        ready: true,
        uid: null,
        email: null,
        isAnonymous: false,
        error: err.message,
      });
    }
  );

  return unsubscribe;
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  if (!auth) throw new Error('Firebase is not configured.');
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function registerWithEmail(email: string, password: string): Promise<void> {
  if (!auth) throw new Error('Firebase is not configured.');
  await createUserWithEmailAndPassword(auth, email.trim(), password);
}

export async function signOutAccount(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
  await signInAnonymously(auth).catch(() => undefined);
}

export function subscribeProducts(
  uid: string | null,
  onUpdate: (products: Product[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!isFirebaseConfigured || !db) {
    localProductListeners.add(onUpdate);
    localGetAllProducts()
      .then(onUpdate)
      .catch((err) => onError?.(err instanceof Error ? err : new Error(String(err))));
    return () => {
      localProductListeners.delete(onUpdate);
    };
  }

  if (!uid) {
    onUpdate([]);
    return () => undefined;
  }

  const colRef = collection(db, 'shops', uid, 'products');
  const q = query(colRef, orderBy('updatedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: Product[] = snapshot.docs.map((docSnap) => docSnap.data() as Product);
      onUpdate(items);
    },
    (err) => {
      onError?.(err);
    }
  );
}

export function subscribeSettings(
  uid: string | null,
  onUpdate: (settings: AppSettings) => void
): () => void {
  if (!isFirebaseConfigured || !db) {
    localSettingsListeners.add(onUpdate);
    localGetSettings().then(onUpdate).catch(() => onUpdate(DEFAULT_SETTINGS));
    return () => {
      localSettingsListeners.delete(onUpdate);
    };
  }

  if (!uid) {
    onUpdate(DEFAULT_SETTINGS);
    return () => undefined;
  }

  const docRef = doc(db, 'shops', uid, 'meta', 'settings');
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        onUpdate({ ...DEFAULT_SETTINGS, ...(snap.data() as Partial<AppSettings>) });
      } else {
        onUpdate(DEFAULT_SETTINGS);
      }
    },
    () => {
      onUpdate(DEFAULT_SETTINGS);
    }
  );
}

async function maybeUploadAnglesToStorage(
  uid: string,
  productId: string,
  angles: ProductAngle[]
): Promise<ProductAngle[]> {
  if (!useFirebaseStorage || !storage) {
    return angles;
  }

  const processed: ProductAngle[] = [];
  for (const angle of angles) {
    if (angle.thumbnail.startsWith('data:image/')) {
      try {
        const path = `shops/${uid}/products/${productId}/${angle.id}.jpg`;
        const storageRef = ref(storage, path);
        const blob = dataUrlToBlob(angle.thumbnail);
        await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
        const downloadUrl = await getDownloadURL(storageRef);
        processed.push({
          ...angle,
          thumbnail: downloadUrl,
          storagePath: path,
        });
      } catch {
        // Fallback cleanly to compressed data URL if Storage bucket rules aren't set up yet
        processed.push(angle);
      }
    } else {
      processed.push(angle);
    }
  }
  return processed;
}

export async function saveProduct(uid: string | null, product: Product): Promise<void> {
  if (!isFirebaseConfigured || !db) {
    await localSaveProduct(product);
    await emitLocalProducts();
    return;
  }
  if (!uid) throw new Error('Not signed in to Firebase.');

  const anglesWithMedia = await maybeUploadAnglesToStorage(uid, product.id, product.angles);
  const payload: Product = {
    ...product,
    angles: anglesWithMedia,
    updatedAt: Date.now(),
  };

  await setDoc(doc(db, 'shops', uid, 'products', product.id), payload);
}

export async function deleteProduct(uid: string | null, product: Product): Promise<void> {
  if (!isFirebaseConfigured || !db) {
    await localDeleteProduct(product.id);
    await emitLocalProducts();
    return;
  }
  if (!uid) throw new Error('Not signed in to Firebase.');

  await deleteDoc(doc(db, 'shops', uid, 'products', product.id));

  if (useFirebaseStorage && storage) {
    for (const angle of product.angles) {
      if (angle.storagePath) {
        deleteObject(ref(storage, angle.storagePath)).catch(() => undefined);
      }
    }
  }
}

export async function importProductsBatch(
  uid: string | null,
  products: Product[],
  replaceExisting = false
): Promise<void> {
  if (!isFirebaseConfigured || !db) {
    if (replaceExisting) {
      await localClearAllProducts();
    }
    await localReplaceProducts(products);
    await emitLocalProducts();
    return;
  }
  if (!uid) throw new Error('Not signed in to Firebase.');

  if (replaceExisting) {
    await clearAllProducts(uid);
  }

  // Firestore batches support up to 500 writes per batch; chunk safely at 200
  const chunkSize = 200;
  for (let i = 0; i < products.length; i += chunkSize) {
    const batch = writeBatch(db);
    const slice = products.slice(i, i + chunkSize);
    for (const product of slice) {
      batch.set(doc(db, 'shops', uid, 'products', product.id), product);
    }
    await batch.commit();
  }
}

export async function clearAllProducts(uid: string | null): Promise<void> {
  if (!isFirebaseConfigured || !db) {
    await localClearAllProducts();
    await emitLocalProducts();
    return;
  }
  if (!uid) throw new Error('Not signed in to Firebase.');

  const colRef = collection(db, 'shops', uid, 'products');
  const snap = await getDocs(colRef);
  const docs = snap.docs;

  for (let i = 0; i < docs.length; i += 200) {
    const batch = writeBatch(db);
    for (const d of docs.slice(i, i + 200)) {
      batch.delete(d.ref);
    }
    await batch.commit();
  }
}

export async function saveSettings(uid: string | null, settings: AppSettings): Promise<void> {
  if (!isFirebaseConfigured || !db) {
    await localSaveSettings(settings);
    await emitLocalSettings();
    return;
  }
  if (!uid) return;

  await setDoc(doc(db, 'shops', uid, 'meta', 'settings'), settings, { merge: true });
}
