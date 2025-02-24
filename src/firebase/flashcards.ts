import { db } from './config';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, updateDoc, increment, arrayUnion, getDoc, setDoc } from 'firebase/firestore';

interface Flashcard {
  question: string;
  answer: string;
}

interface FlashcardSet {
  id: string;
  userId: string;
  title: string;
  cards: Flashcard[];
  starredCards?: number[];
  lastStudied?: Date;
  totalTimeSpent?: number;
  timesReviewed?: number;
  cardsReviewed?: number[];
  createdAt: string;
}

interface UserStats {
  totalStudyTime: number;
  studiedSets: number;
  masteredTerms: number;
  starredSets: string[];
  lastStudied: Date;
}

interface SearchableSet {
  id: string;
  title: string;
  cards: Flashcard[];
  creatorId: string;
  creatorName: string;
  createdAt: Date;
}

export const saveFlashcardSet = async (userId: string, title: string, cards: any[]) => {
  try {
    // Create a new document in the user's sets collection
    const setRef = doc(collection(db, 'users', userId, 'sets'));
    await setDoc(setRef, {
      title,
      cards,
      userId,
      starredCards: [],
      lastStudied: null,
      totalTimeSpent: 0,
      timesReviewed: 0,
      cardsReviewed: [],
      createdAt: new Date().toISOString()
    });
    return setRef.id;
  } catch (error) {
    console.error('Error saving flashcard set:', error);
    throw error;
  }
};

export const getUserFlashcardSets = async (userId: string): Promise<FlashcardSet[]> => {
  const q = query(collection(db, 'users', userId, 'sets'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as FlashcardSet[];
};

export const deleteFlashcardSet = async (userId: string, setId: string) => {
  try {
    await deleteDoc(doc(db, 'users', userId, 'sets', setId));
  } catch (error) {
    console.error('Error deleting flashcard set:', error);
    throw error;
  }
};

export const updateUserStats = async (userId: string, timeStudied: number, setsStudied: number = 1) => {
  const userStatsRef = doc(db, 'users', userId, 'userData', 'stats');
  const statsDoc = await getDoc(userStatsRef);
  
  const currentStats = statsDoc.exists() ? statsDoc.data() : {
    totalTimeStudied: 0,
    totalSetsStudied: 0
  };

  await setDoc(userStatsRef, {
    totalTimeStudied: currentStats.totalTimeStudied + timeStudied,
    totalSetsStudied: currentStats.totalSetsStudied + setsStudied
  }, { merge: true });
};

export const getStarredSets = async (userId: string) => {
  const docRef = doc(db, 'users', userId, 'userData', 'stats');
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data().starredSets || [];
  }
  return [];
};

export const searchFlashcardSets = async (searchQuery: string): Promise<SearchableSet[]> => {
  const setsRef = collection(db, 'flashcardSets');
  const searchLower = searchQuery.toLowerCase();
  
  try {
    // Search by title
    const titleQuery = query(setsRef,
      where('titleLower', '>=', searchLower),
      where('titleLower', '<=', searchLower + '\uf8ff'),
      limit(20)
    );

    // Search by creator username
    const usernameQuery = query(setsRef,
      where('creatorUsernameLower', '>=', searchLower),
      where('creatorUsernameLower', '<=', searchLower + '\uf8ff'),
      limit(20)
    );

    const [titleSnapshot, usernameSnapshot] = await Promise.all([
      getDocs(titleQuery),
      getDocs(usernameQuery)
    ]);

    // Combine and deduplicate results
    const results = new Map<string, SearchableSet>();
    
    [...titleSnapshot.docs, ...usernameSnapshot.docs].forEach(doc => {
      if (!results.has(doc.id)) {
        const data = doc.data();
        results.set(doc.id, {
          id: doc.id,
          title: data.title,
          cards: data.cards,
          creatorId: data.creatorId,
          creatorName: data.creatorUsername,
          createdAt: data.createdAt?.toDate() || new Date(),
        });
      }
    });

    return Array.from(results.values());
  } catch (error) {
    console.error('Error searching sets:', error);
    return [];
  }
}; 