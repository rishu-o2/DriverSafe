import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const configIsPresent = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId &&
  firebaseConfig.storageBucket && firebaseConfig.messagingSenderId && firebaseConfig.appId,
);
export const firebaseApp: FirebaseApp | null = !configIsPresent
  ? null
  : getApps()[0] || initializeApp(firebaseConfig);
const analyticsEnabled = import.meta.env.VITE_ENABLE_ANALYTICS === 'true';

// Analytics is opt-in and unavailable during server rendering or unsupported browsers.
export const analyticsPromise = !analyticsEnabled || !firebaseApp || typeof window === "undefined"
    ? Promise.resolve(null)
    : isSupported()
        .then((supported) => (supported ? getAnalytics(firebaseApp) : null))
        .catch(() => null);
