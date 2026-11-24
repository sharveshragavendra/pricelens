import { DEFAULT_SETTINGS, type AppSettings, type Product } from '../types';

/**
 * Local IndexedDB fallback store used automatically when Firebase environment
 * variables have not been configured yet. Keeps PriceLens 100% functional offline.
 */

const DB_NAME = 'pricelens_local_db';
const DB_VERSION = 1;
const PRODUCTS_STORE = 'products';
const SETTINGS_STORE = 'settings';
const SETTINGS_KEY = 'app_settings';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PRODUCTS_STORE)) {
        db.createObjectStore(PRODUCTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB.'));
  });
}

export async function localGetAllProducts(): Promise<Product[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRODUCTS_STORE, 'readonly');
    const req = tx.objectStore(PRODUCTS_STORE).getAll();
    req.onsuccess = () => {
      const items = (req.result as Product[]).sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function localSaveProduct(product: Product): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRODUCTS_STORE, 'readwrite');
    tx.objectStore(PRODUCTS_STORE).put(product);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function localDeleteProduct(productId: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRODUCTS_STORE, 'readwrite');
    tx.objectStore(PRODUCTS_STORE).delete(productId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function localClearAllProducts(): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRODUCTS_STORE, 'readwrite');
    tx.objectStore(PRODUCTS_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function localReplaceProducts(products: Product[]): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRODUCTS_STORE, 'readwrite');
    const store = tx.objectStore(PRODUCTS_STORE);
    for (const product of products) {
      store.put(product);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function localGetSettings(): Promise<AppSettings> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SETTINGS_STORE, 'readonly');
    const req = tx.objectStore(SETTINGS_STORE).get(SETTINGS_KEY);
    req.onsuccess = () => {
      resolve({ ...DEFAULT_SETTINGS, ...(req.result as Partial<AppSettings> | undefined) });
    };
    req.onerror = () => reject(req.error);
  });
}

export async function localSaveSettings(settings: AppSettings): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SETTINGS_STORE, 'readwrite');
    tx.objectStore(SETTINGS_STORE).put(settings, SETTINGS_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
