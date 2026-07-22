import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import defaultConfig from "../firebase-applet-config.json";

const firebaseConfig = {
  projectId: defaultConfig?.projectId || "mahmudul-instagram-bazar",
  appId: defaultConfig?.appId || "1:849380742389:web:87e06af945983873dde1bc",
  apiKey: defaultConfig?.apiKey || "AIzaSyBEO8S2XRSMTxwcMU2JyiIr-O7ddrHNb9Y",
  authDomain: defaultConfig?.authDomain || "mahmudul-instagram-bazar.firebaseapp.com",
  firestoreDatabaseId: defaultConfig?.firestoreDatabaseId || "ai-studio-accountmanager-ec6eda59-6fd3-4a88-b03d-16ce0e0e9a3c",
  storageBucket: defaultConfig?.storageBucket || "mahmudul-instagram-bazar.firebasestorage.app",
  messagingSenderId: defaultConfig?.messagingSenderId || "849380742389",
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore safely
let db: any;
try {
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
} catch (e) {
  try {
    db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId);
  } catch (err) {
    db = getFirestore(app);
  }
}

export { db };


