import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBVgl3sIuHlEgioYPWJnHnhU69_lnMz3Lw",
  authDomain: "abp-agencia-de-seguros.firebaseapp.com",
  projectId: "abp-agencia-de-seguros",
  storageBucket: "abp-agencia-de-seguros.firebasestorage.app",
  messagingSenderId: "687377228016",
  appId: "1:687377228016:web:ad08b396c5340b12836235",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
