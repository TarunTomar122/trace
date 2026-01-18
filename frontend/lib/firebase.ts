import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD4aLAfwNut7JJcP9JJe3GcodFDyblHR8o",
  authDomain: "anybrew-7c6c1.firebaseapp.com",
  projectId: "anybrew-7c6c1",
  storageBucket: "anybrew-7c6c1.firebasestorage.app",
  messagingSenderId: "94335303623",
  appId: "1:94335303623:web:54883907ab41668435a3e2",
  measurementId: "G-VFJJH46NLX"
};

// Initialize Firebase (prevent multiple initializations)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firebase services
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const firestore = getFirestore(app);

export default app;

