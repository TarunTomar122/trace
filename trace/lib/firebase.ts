import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import {
  GoogleAuthProvider,
  getAuth,
  initializeAuth,
  getReactNativePersistence,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyD4aLAfwNut7JJcP9JJe3GcodFDyblHR8o',
  authDomain: 'anybrew-7c6c1.firebaseapp.com',
  projectId: 'anybrew-7c6c1',
  storageBucket: 'anybrew-7c6c1.firebasestorage.app',
  messagingSenderId: '94335303623',
  appId: '1:94335303623:web:54883907ab41668435a3e2',
  measurementId: 'G-VFJJH46NLX',
};

const shouldInitialize = getApps().length === 0;
const app = shouldInitialize ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = shouldInitialize
  ? initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    })
  : getAuth(app);

export const googleProvider = new GoogleAuthProvider();
export const firestore = getFirestore(app);

export default app;

