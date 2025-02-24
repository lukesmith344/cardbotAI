'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { auth } from '@/firebase/config';
import FlashcardViewer from '@/components/FlashcardViewer';

export default function StudyPage({ params }: { params: { setId: string } }) {
  const router = useRouter();
  const [cards, setCards] = useState<Array<{ question: string; answer: string; originalIndex: number }> | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUser(user);
      } else {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const loadSet = async () => {
      if (!user) return;
      
      try {
        const docRef = doc(db, 'users', user.uid, 'sets', params.setId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCards(data.cards.map((card: any, index: number) => ({
            ...card,
            originalIndex: index
          })));
        }
        setLoading(false);
      } catch (error) {
        console.error('Error loading set:', error);
        setLoading(false);
      }
    };
    if (user) loadSet();
  }, [params.setId, user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-600 dark:text-gray-300">
          Loading...
        </div>
      </div>
    );
  }

  if (!cards) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-xl font-semibold text-red-600 dark:text-red-400">
          Set not found
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <FlashcardViewer
        cards={cards}
        onClose={() => router.push('/dashboard')}
        isDarkMode={isDarkMode}
        setId={params.setId}
        userId={user.uid}
      />
    </div>
  );
} 