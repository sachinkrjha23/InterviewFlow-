import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_APIKEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "interviewflow-40940.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "interviewflow-40940",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "interviewflow-40940.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID || "31546325530",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:31546325530:web:258f446804a5c219afefa3",
};

const app = initializeApp(firebaseConfig);


const auth = getAuth(app);

const provider = new GoogleAuthProvider();

export {auth, provider}