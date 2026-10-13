// Firebase web config. NEXT_PUBLIC_FIREBASE_* override the hosted defaults; the
// open-source export ships this file without defaults (scripts/oss/overlay).
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyD4aLAfwNut7JJcP9JJe3GcodFDyblHR8o",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "anybrew-7c6c1.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "anybrew-7c6c1",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "anybrew-7c6c1.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "94335303623",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:94335303623:web:54883907ab41668435a3e2",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-VFJJH46NLX",
};
