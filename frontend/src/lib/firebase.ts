import { getApp, getApps, initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCcNiTWOh3iH4Qh_d9An4vF7XBOcDUd-6U",
  authDomain: "driversafe-a0c87.firebaseapp.com",
  projectId: "driversafe-a0c87",
  storageBucket: "driversafe-a0c87.firebasestorage.app",
  messagingSenderId: "1019151668412",
  appId: "1:1019151668412:web:a45d341557c180fb26ecb9",
  measurementId: "G-1K0MMKEV5Q",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Analytics is unavailable during server rendering and in some browsers/privacy modes.
export const analyticsPromise =
  typeof window === "undefined"
    ? Promise.resolve(null)
    : isSupported()
        .then((supported) => (supported ? getAnalytics(firebaseApp) : null))
        .catch(() => null);
