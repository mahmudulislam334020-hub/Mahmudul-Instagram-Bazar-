import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBE08S2XRSMTxwcMU2JyiIr-O7ddrHNb9Y",
  authDomain: "mahmudul-instagram-bazar.firebaseapp.com",
  projectId: "mahmudul-instagram-bazar",
  storageBucket: "mahmudul-instagram-bazar.firebasestorage.app",
  messagingSenderId: "84930742389",
  appId: "1:84930742389:web:125cebb05366d6dadde1bc",
  measurementId: "G-7MF72269F3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore (default database)
const db = getFirestore(app);

export { db };

