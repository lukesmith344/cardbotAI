import { db } from './config';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';

const updateFlashcardSets = async () => {
  const setsRef = collection(db, 'flashcardSets');
  const querySnapshot = await getDocs(setsRef);

  querySnapshot.forEach(async (doc) => {
    const data = doc.data();
    await setDoc(doc.ref, {
      ...data,
      titleLower: data.title.toLowerCase(),
      creatorUsernameLower: data.creatorUsername.toLowerCase()
    }, { merge: true });
  });
};

updateFlashcardSets(); 