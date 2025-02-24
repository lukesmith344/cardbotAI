import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCJVqYCCl00QgnUTgm_AYY9zWe6RhopzLI",
  authDomain: "cardbot-ai.firebaseapp.com",
  projectId: "cardbot-ai",
  storageBucket: "cardbot-ai.appspot.com",
  messagingSenderId: "702897261286",
  appId: "1:702897261286:web:192f19026561cae6538927",
  measurementId: "G-900M784VG5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
const auth = getAuth(app);

// Initialize Firestore
const db = getFirestore(app);

export { auth, db }; 