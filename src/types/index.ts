// User related interfaces
export interface UserProfile {
  email: string;
  username: string;
  usernameLower: string;
  firebaseUid: string;
  createdAt: Date;
  stats: {
    totalTimeStudied: number;
    totalSetsStudied: number;
    masteredTerms: number;
  };
  starredSets?: string[];
}

interface UserStats {
  totalTimeStudied: number;
  totalSetsStudied: number;
  masteredTerms: number;
}

// Flashcard related interfaces
export interface SearchableSet {
  id: string;
  title: string;
  cards: Array<{ question: string; answer: string }>;
  creatorId: string;
  creatorName: string;
  createdAt: Date;
}

export interface FlashcardSet {
  id: string;
  title: string;
  titleLower: string;
  cards: Array<{ question: string; answer: string }>;
  creatorId: string;
  creatorUsername: string;
  creatorUsernameLower: string;
  createdAt: Date;
  isPublic: boolean;
} 