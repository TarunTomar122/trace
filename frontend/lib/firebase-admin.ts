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
      // Option 1: Inline JSON string
      const serviceAccount = JSON.parse(serviceAccountKey);
      initializeApp({
        credential: cert(serviceAccount),
        projectId: 'anybrew-7c6c1',
      });
    } else if (serviceAccountPath) {
      // Option 2: Path to JSON file
      initializeApp({
        credential: cert(serviceAccountPath),
        projectId: 'anybrew-7c6c1',
      });
    } else {
      // Option 3: Default credentials (won't work locally)
      initializeApp({
        projectId: 'anybrew-7c6c1',
      });
    }
  }
  
  adminAuth = getAuth();
  adminFirestore = getFirestore();
} catch (error) {
  console.error('Firebase Admin initialization error:', error);
  adminAuth = null;
  adminFirestore = null;
}

export { adminAuth, adminFirestore };

