// Firebase wiring — DOCUMENTED STUB.
//
// The prototype runs entirely on localStorage (see auth.tsx) so every flow works
// without a backend. To go live, fill these env vars in vantage/.env.local and
// swap auth.tsx's localStorage calls for the Firebase calls noted there.
//
//   VITE_FIREBASE_API_KEY=
//   VITE_FIREBASE_AUTH_DOMAIN=
//   VITE_FIREBASE_PROJECT_ID=            (share the Trace project: anybrew-7c6c1)
//   VITE_FIREBASE_STORAGE_BUCKET=
//   VITE_FIREBASE_MESSAGING_SENDER_ID=
//   VITE_FIREBASE_APP_ID=
//
// Sharing Trace's Firebase project is intentional: the listener's role + interests
// already live in user_profiles/{uid}, which is exactly the personalization input.

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseReady = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
