import { db } from './config';
import { collection, addDoc, query, where, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from './config';
import { User } from 'firebase/auth';

interface NewUser {
  userId: string;
  email: string;
}

export const createUser = async (userId: string, email: string, password: string) => {
  try {
    // First create the auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Then store additional user data in Firestore
    const userDoc = await addDoc(collection(db, 'users'), {
      userId: userId,
      email: email,
      firebaseUid: userCredential.user.uid,
      createdAt: new Date().toISOString()
    });

    return userDoc.id;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

export const checkUserIdExists = async (userId: string) => {
  const q = query(collection(db, 'users'), where('userId', '==', userId));
  const querySnapshot = await getDocs(q);
  return !querySnapshot.empty;
};

export const checkEmailExists = async (email: string) => {
  const q = query(collection(db, 'users'), where('email', '==', email));
  const querySnapshot = await getDocs(q);
  return !querySnapshot.empty;
};

export const ensureUserProfile = async (user: User) => {
  const userRef = doc(db, 'users', user.uid);
  const username = user.email?.split('@')[0] || 'Anonymous';
  
  await setDoc(userRef, {
    email: user.email,
    username: username,
    usernameLower: username.toLowerCase(),
    createdAt: new Date(),
    stats: {
      totalTimeStudied: 0,
      totalSetsStudied: 0,
      masteredTerms: 0
    },
    starredSets: []
  }, { merge: true });
  
  return username;
};

export const updateUserWithFirebaseUid = async (userId: string, firebaseUid: string) => {
  try {
    // Find the user document by userId
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      // Update the document with firebaseUid
      await updateDoc(doc(db, 'users', userDoc.id), {
        firebaseUid: firebaseUid
      });
      console.log('Updated user document with firebaseUid');
    }
  } catch (error) {
    console.error('Error updating user:', error);
  }
}; 