import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { GoogleAuthProvider } from "firebase/auth";
import { initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from "firebase/app-check";

let appCheckInstance: AppCheck | null = null;

const required = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID"
] as const;

const env = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

function initializeTaxiAppCheck(app: ReturnType<typeof initializeApp>): AppCheck | null {
  const siteKey = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;
  if (typeof window === "undefined" || !siteKey) return null;
  if (!appCheckInstance) {
    appCheckInstance = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true
    });
  }
  return appCheckInstance;
}

export function getFirebaseClient() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Firebase is not configured. Missing: ${missing.join(", ")}`);
  }
  const app = getApps().length ? getApp() : initializeApp(env);
  const appCheck = initializeTaxiAppCheck(app);
  return {
    app,
    appCheck,
    auth: getAuth(app),
    googleProvider: new GoogleAuthProvider(),
    db: getFirestore(app),
    functions: getFunctions(app, "europe-west1")
  };
}