import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

let adminAuth: ReturnType<typeof getAuth> | null = null;
let adminFirestore: ReturnType<typeof getFirestore> | null = null;
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
  adminFirestore = getFirestore();
  adminStorage = getStorage();
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

export { adminAuth, adminFirestore, adminStorage };
export const adminDb = adminFirestore; // Alias for consistency
