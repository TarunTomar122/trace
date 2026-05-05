import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { initializeAuth, getAuth, getReactNativePersistence, Auth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyD4aLAfwNut7JJcP9JJe3GcodFDyblHR8o',
  authDomain: 'anybrew-7c6c1.firebaseapp.com',
  projectId: 'anybrew-7c6c1',
  storageBucket: 'anybrew-7c6c1.firebasestorage.app',
  messagingSenderId: '94335303623',
  appId: '1:94335303623:web:54883907ab41668435a3e2',
  measurementId: 'G-VFJJH46NLX',
};

let app: FirebaseApp;
let auth: Auth;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  const persistence = getReactNativePersistence(AsyncStorage);
  console.log('[Firebase] Initializing auth with persistence...');
  auth = initializeAuth(app, { persistence });
  console.log('[Firebase] Auth initialized.');
} else {
  app = getApps()[0];
  auth = getAuth(app);
}

// experimentalAutoDetectLongPolling lets Firebase pick WebSockets over
// long-polling when available — much more reliable on mobile WiFi.
// initializeFirestore can only be called once per app instance.
let firestore: ReturnType<typeof getFirestore>;
try {
  firestore = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  });
} catch {
  firestore = getFirestore(app);
}
export { firestore, auth, app };
