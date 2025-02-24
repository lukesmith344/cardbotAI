import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from './config';
import { collection, query, where, getDocs } from 'firebase/firestore';

export const loginWithUserId = async (userId: string, password: string) => {
  try {
    // Query Firestore to get the user's email using their userId
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      throw new Error('User ID not found');
    }

    // Get the user's email from Firestore
    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();
    const email = userData.email;

    // Sign in with email and password
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: any) {
    console.error('Login error details:', {
      code: error.code,
      message: error.message,
      userId: userId
    });
    throw error;
  }
}; 