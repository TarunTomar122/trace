import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

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
} else {
  app = getApps()[0];
}

auth = getAuth(app);

export const firestore = getFirestore(app);
export { auth, app };
