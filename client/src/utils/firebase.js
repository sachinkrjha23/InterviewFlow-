import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_APIKEY,
  authDomain: "interviewflow-40940.firebaseapp.com",
  projectId: "interviewflow-40940",
  storageBucket: "interviewflow-40940.firebasestorage.app",
  messagingSenderId: "31546325530",
  appId: "1:31546325530:web:258f446804a5c219afefa3"
};

const app = initializeApp(firebaseConfig);


const auth = getAuth(app);

const provider = new GoogleAuthProvider();

export {auth, provider}