import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { localFirestoreFromEnv } from './local-firestore';

export type FirestoreBackendMode = 'firebase' | 'local' | 'fallback';

export function firestoreBackendMode(): FirestoreBackendMode {
  const raw = (process.env.FIRESTORE_BACKEND || '').trim().toLowerCase();
  if (raw === 'local' || raw === 'fallback' || raw === 'firebase') return raw;
  return 'firebase';
}

let adminAuth: ReturnType<typeof getAuth> | null = null;
// The selector returns a Firebase- or LocalDB-backed client. Both implement
// the Firestore surface this app uses; the static type is the admin SDK's
// Firestore so all existing call sites keep their inferred types.
let adminFirestore: Firestore | null = null;
let adminStorage: ReturnType<typeof getStorage> | null = null;

try {
  if (!getApps().length) {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    if (serviceAccountKey) {
      console.log('Initializing Firebase Admin with service account key');
      // Option 1: Inline JSON string
      const serviceAccount = JSON.parse(serviceAccountKey);
      const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || 'anybrew-7c6c1.firebasestorage.app';
      initializeApp({
        credential: cert(serviceAccount),
        storageBucket,
      });
    } else if (serviceAccountPath) {
      console.log('Initializing Firebase Admin with service account path');
      // Option 2: Path to JSON file
      const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || 'anybrew-7c6c1.firebasestorage.app';
      initializeApp({
        credential: cert(serviceAccountPath),
        storageBucket,
      });
    } else {
      console.error('No Firebase credentials found - FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_SERVICE_ACCOUNT_PATH required');
      throw new Error('Firebase credentials not configured');
    }
  }

  adminAuth = getAuth();
  adminStorage = getStorage();

  const mode = firestoreBackendMode();
  const local = mode === 'firebase' ? null : localFirestoreFromEnv();
  if (mode !== 'firebase' && !local) {
    throw new Error(
      'FIRESTORE_BACKEND is set to "' + mode + '" but LOCALDB_URL / LOCALDB_API_TOKEN are not configured'
    );
  }
  if (mode === 'local') {
    adminFirestore = local as unknown as Firestore;
    console.log('Firestore backend: LocalDB');
  } else if (mode === 'fallback') {
    const primary = local!;
    const secondary = getFirestore();
    adminFirestore = withFirebaseFallback(primary, secondary) as Firestore;
    console.log('Firestore backend: LocalDB with Firebase fallback');
  } else {
    adminFirestore = getFirestore();
    console.log('Firestore backend: Firebase');
  }
  console.log('Firebase Admin initialized successfully');
} catch (error) {
  console.error('Firebase Admin initialization error:', error);
  if (error instanceof Error) {
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
  }
  adminAuth = null;
  adminFirestore = null;
  adminStorage = null;
}

// biome-ignore lint/suspicious/noExplicitAny: structural passthrough for two Firestore flavours
function withFirebaseFallback(primary: any, secondary: any): any {
  const wrapSnapshot = (snap: any) => snap;
  return {
    collection: (path: string) => wrapCollection(primary.collection(path), secondary.collection(path)),
    collectionGroup: (id: string) => wrapQuery(primary.collectionGroup(id), secondary.collectionGroup(id)),
    // biome-ignore lint/suspicious/noExplicitAny: refs are backend-specific
    getAll: async (...refs: any[]) => {
      // Refs are bound to the primary client; on failure, re-resolve paths on Firebase.
      try {
        return await primary.getAll(...refs);
      } catch (error) {
        console.error('[firestore-fallback] getAll via LocalDB failed, retrying on Firebase:', error);
        const fbRefs = refs.map((ref) => refForPath(secondary, ref.path));
        return await secondary.getAll(...fbRefs);
      }
    },
    batch: () => wrapBatch(primary.batch(), secondary),
    runTransaction: async <T>(callback: (tx: any) => Promise<T>): Promise<T> => {
      try {
        return await primary.runTransaction(callback);
      } catch (error) {
        console.error('[firestore-fallback] transaction via LocalDB failed, retrying on Firebase:', error);
        // The callback closes over primary-bound refs; re-map them by path
        // onto Firebase refs before replaying against the admin transaction.
        return await secondary.runTransaction(async (adminTx: any) => {
          const byPath = (ref: any) => (ref?.path ? refForPath(secondary, ref.path) : ref);
          const mappedTx = {
            get: (ref: any) => adminTx.get(byPath(ref)),
            set: (ref: any, ...rest: any[]) => adminTx.set(byPath(ref), ...rest),
            update: (ref: any, ...rest: any[]) => adminTx.update(byPath(ref), ...rest),
            create: (ref: any, ...rest: any[]) => adminTx.create(byPath(ref), ...rest),
            delete: (ref: any) => adminTx.delete(byPath(ref)),
          };
          return await callback(mappedTx);
        });
      }
    },
  };

  // biome-ignore lint/suspicious/noExplicitAny: backend-specific refs
  function refForPath(client: any, path: string): any {
    const parts = path.split('/');
    let ref = client.collection(parts[0]);
    for (let i = 1; i < parts.length; i += 2) {
      ref = ref.doc(parts[i]);
      if (i + 1 < parts.length) ref = ref.collection(parts[i + 1]);
    }
    return ref;
  }

  // biome-ignore lint/suspicious/noExplicitAny: backend-specific queries
  function wrapQuery(local: any, remote: any): any {
    const wrap = (l: any, r: any): any => ({
      where: (...args: any[]) => wrap(l.where(...args), r.where(...args)),
      orderBy: (...args: any[]) => wrap(l.orderBy(...args), r.orderBy(...args)),
      limit: (...args: any[]) => wrap(l.limit(...args), r.limit(...args)),
      select: (...args: any[]) => {
        if (typeof l.select !== 'function') return wrap(l, r.select(...args));
        return wrap(l.select(...args), r.select(...args));
      },
      get: async () => {
        try {
          return await l.get();
        } catch (error) {
          console.error('[firestore-fallback] query via LocalDB failed, retrying on Firebase:', error);
          return wrapSnapshot(await r.get());
        }
      },
    });
    return wrap(local, remote);
  }

  // biome-ignore lint/suspicious/noExplicitAny: backend-specific refs
  function wrapCollection(local: any, remote: any): any {
    const base = wrapQuery(local, remote);
    return {
      ...base,
      // biome-ignore lint/suspicious/noExplicitAny: backend-specific refs
      doc: (id: string): any => wrapDoc(local.doc(id), remote.doc(id)),
      // biome-ignore lint/suspicious/noExplicitAny: backend-specific refs
      document: (id: string): any => wrapDoc(local.document(id), remote.document(id)),
      add: async (data: any) => {
        try {
          return await local.add(data);
        } catch (error) {
          console.error('[firestore-fallback] add via LocalDB failed, retrying on Firebase:', error);
          return await remote.add(data);
        }
      },
    };
  }

  // biome-ignore lint/suspicious/noExplicitAny: backend-specific refs
  function wrapDoc(local: any, remote: any): any {
    return {
      id: local.id,
      path: local.path,
      collection: (id: string) => wrapCollection(local.collection(id), remote.collection(id)),
      get: async () => {
        try {
          return await local.get();
        } catch (error) {
          console.error('[firestore-fallback] get via LocalDB failed, retrying on Firebase:', error);
          return await remote.get();
        }
      },
      set: async (...args: any[]) => {
        try {
          return await local.set(...args);
        } catch (error) {
          console.error('[firestore-fallback] set via LocalDB failed, retrying on Firebase:', error);
          return await remote.set(...args);
        }
      },
      create: async (...args: any[]) => {
        try {
          return await local.create(...args);
        } catch (error) {
          console.error('[firestore-fallback] create via LocalDB failed, retrying on Firebase:', error);
          return await remote.create(...args);
        }
      },
      update: async (...args: any[]) => {
        try {
          return await local.update(...args);
        } catch (error) {
          console.error('[firestore-fallback] update via LocalDB failed, retrying on Firebase:', error);
          return await remote.update(...args);
        }
      },
      delete: async (...args: any[]) => {
        try {
          return await local.delete(...args);
        } catch (error) {
          console.error('[firestore-fallback] delete via LocalDB failed, retrying on Firebase:', error);
          return await remote.delete(...args);
        }
      },
    };
  }

  // biome-ignore lint/suspicious/noExplicitAny: backend-specific batches
  function wrapBatch(local: any, remoteClient: any): any {
    const ops: Array<{ method: string; args: any[] }> = [];
    const queue = (method: string) =>
      // biome-ignore lint/suspicious/noExplicitAny: backend-specific refs
      (ref: any, ...args: any[]) => { ops.push({ method, args: [ref, ...args] }); return proxy; };
    const commit = async () => {
      const localBatch = local;
      for (const op of ops) (localBatch[op.method] as any)(...op.args);
      try {
        return await localBatch.commit();
      } catch (error) {
        console.error('[firestore-fallback] batch via LocalDB failed, retrying on Firebase:', error);
        const remoteBatch = remoteClient.batch();
        for (const op of ops) {
          const [ref, ...rest] = op.args;
          const fbRef = ref?.path ? refForPath(remoteClient, ref.path) : ref;
          (remoteBatch[op.method] as any)(fbRef, ...rest);
        }
        return await remoteBatch.commit();
      }
    };
    const proxy = { set: queue('set'), update: queue('update'), create: queue('create'), delete: queue('delete'), commit };
    return proxy;
  }
}

export { adminAuth, adminFirestore, adminStorage };
export const adminDb = adminFirestore; // Alias for consistency
