import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let adminAuth: ReturnType<typeof getAuth> | null = null;
let adminFirestore: ReturnType<typeof getFirestore> | null = null;

try {
  if (!getApps().length) {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    
    if (serviceAccountKey) {
      console.log('Initializing Firebase Admin with service account key');
      // Option 1: Inline JSON string
      const serviceAccount = JSON.parse(serviceAccountKey);
      initializeApp({
        credential: cert(serviceAccount),
        projectId: 'anybrew-7c6c1',
      });
    } else if (serviceAccountPath) {
      console.log('Initializing Firebase Admin with service account path');
      // Option 2: Path to JSON file
      initializeApp({
        credential: cert(serviceAccountPath),
        projectId: 'anybrew-7c6c1',
      });
    } else {
      console.error('No Firebase credentials found - FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_SERVICE_ACCOUNT_PATH required');
      throw new Error('Firebase credentials not configured');
    }
  }
  
  adminAuth = getAuth();
  adminFirestore = getFirestore();
  console.log('Firebase Admin initialized successfully');
} catch (error) {
  console.error('Firebase Admin initialization error:', error);
  if (error instanceof Error) {
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
  }
  adminAuth = null;
  adminFirestore = null;
}

export { adminAuth, adminFirestore };
export const adminDb = adminFirestore; // Alias for consistency

