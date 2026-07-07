import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBhgo5OW1DvbfFL_cbXl5uUCBC8iQ9Xx6U",
  authDomain: "gen-lang-client-0926578750.firebaseapp.com",
  projectId: "gen-lang-client-0926578750",
  storageBucket: "gen-lang-client-0926578750.firebasestorage.app",
  messagingSenderId: "687424802426",
  appId: "1:687424802426:web:05abac5324a09567a075c3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with the custom database ID from config
const db = getFirestore(app, "ai-studio-accountmanager-ec6eda59-6fd3-4a88-b03d-16ce0e0e9a3c");

export { db };
