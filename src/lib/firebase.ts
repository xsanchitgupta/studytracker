import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyA7nUwj9aQpItzrLMmh65Dr0xeMEBikyp4",
  authDomain: "studysync-9572f.firebaseapp.com",
  projectId: "studysync-9572f",
  storageBucket: "studysync-9572f.firebasestorage.app",
  messagingSenderId: "231318533820",
  appId: "1:231318533820:web:98d1d2e46363f2ecb342b9",
  measurementId: "G-76XE5K1JC9"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
