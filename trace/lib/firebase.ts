import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { initializeAuth, getAuth, getReactNativePersistence, Auth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBnbVmQeeFa8QXi7VoTDlsh2kvNOAmD-h4',
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
  // Use AsyncStorage persistence for session persistence across app restarts
  const persistence = getReactNativePersistence(AsyncStorage);
  console.log('[Firebase] Initializing auth with persistence...');
  auth = initializeAuth(app, {
    persistence,
  });
  console.log('[Firebase] Auth initialized.');
} else {
  app = getApps()[0];
  auth = getAuth(app);
}

export const firestore = getFirestore(app);
export { auth, app };
