'use client';
import { useEffect, useState, useRef } from 'react';
import { auth } from '@/firebase/config';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { generateFlashcards } from '@/lib/gemini';
import FlashcardViewer from '@/components/FlashcardViewer';
import { 
  saveFlashcardSet, 
  getUserFlashcardSets, 
  deleteFlashcardSet, 
  searchFlashcardSets 
} from '@/firebase/flashcards';
import ImageUploader from '@/components/ImageUploader';
import VideoTranscriber from '@/components/VideoTranscriber';
import { HomeIcon, BookOpenIcon, StarIcon, ChartBarIcon, SunIcon, MoonIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { collection, getDocs } from 'firebase/firestore';

// Update the interface for flashcard sets at the top of the file
interface FlashcardSet {
  id: string;
  title: string;
  cards: Array<{ question: string; answer: string }>;
  userId?: string;
  username?: string;
}

// Add these interfaces at the top of the file
interface FlashcardData {
  title: string;
  cards: Array<{ question: string; answer: string }>;
  creatorId: string;
  createdAt: any; // Firebase Timestamp
}

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showCreateOptions, setShowCreateOptions] = useState(false);
  const [showNotesInput, setShowNotesInput] = useState(false);
  const [cardCount, setCardCount] = useState(10);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [notes, setNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCards, setGeneratedCards] = useState<Array<{ question: string; answer: string; originalIndex: number }> | null>(null);
  const [userSets, setUserSets] = useState<FlashcardSet[]>([]);
  const [setTitle, setSetTitle] = useState('');
  const [showSets, setShowSets] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [showVideoTranscriber, setShowVideoTranscriber] = useState(false);
  const [currentSetId, setCurrentSetId] = useState('');
  const [showStats, setShowStats] = useState(false);
  const [starredSets, setStarredSets] = useState<Set<string>>(new Set());
  const [totalStudyTime, setTotalStudyTime] = useState(0);
  const [studiedSets, setStudiedSets] = useState(0);
  const [masteredTerms, setMasteredTerms] = useState(0);
  const [showStarredSets, setShowStarredSets] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [recentlyStudiedSets, setRecentlyStudiedSets] = useState<Array<{
    id: string;
    title: string;
    cards: any[];
    lastStudied: Date;
  }>>([]);

  // Fix 1: Add cleanup for auth state subscription
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setLoading(false);
      if (!user) {
        router.push('/login');
      } else {
        setUser(user);
      }
    });

    return () => {
      unsubscribe();
      // Reset states on unmount
      setGeneratedCards(null);
      setShowCreateOptions(false);
      setShowNotesInput(false);
      setShowSets(false);
    };
  }, [router]);

  // Fix 2: Add error boundary for click handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      try {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setShowCreateOptions(false);
        }
      } catch (error) {
        console.error('Error in click handler:', error);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fix 3: Add loading state for user sets fetch
  useEffect(() => {
    let isMounted = true;

    if (user) {
      const fetchUserSets = async () => {
        try {
          const sets = await getUserFlashcardSets(user.uid);
          if (isMounted) {
            setUserSets(sets);
          }
        } catch (error) {
          console.error('Error fetching sets:', error);
          if (isMounted) {
            // Set empty array on error to prevent undefined state
            setUserSets([]);
          }
        }
      };
      fetchUserSets();
    }

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Fix 4: Add validation and error handling for flashcard generation
  const handleGenerateFlashcards = async () => {
    if (!notes.trim() || !user || !setTitle.trim()) {
      return;
    }

    setIsGenerating(true);
    try {
      // Validate card count
      const validCardCount = Math.min(50, Math.max(1, cardCount));
      
      const flashcards = await generateFlashcards(notes, validCardCount);
      if (!flashcards || flashcards.length === 0) {
        throw new Error('No flashcards generated');
      }

      // Map flashcards to include originalIndex
      const formattedFlashcards = flashcards.map((card, index) => ({
        ...card,
        originalIndex: index
      }));

      // Remove username parameter since we're not using it anymore
      const setId = await saveFlashcardSet(
        user.uid,
        setTitle.trim(),
        formattedFlashcards
      );

      setGeneratedCards(formattedFlashcards);
      setShowNotesInput(false);
      
      // Refresh user sets only after successful save
      const updatedSets = await getUserFlashcardSets(user.uid);
      setUserSets(updatedSets);
      setCurrentSetId(setId);
      
      // Reset form
      setNotes('');
      setSetTitle('');
    } catch (error) {
      console.error('Error generating flashcards:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Fix 5: Add error handling and confirmation for delete
  const handleDeleteSet = async (setId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!user || !setId) return;
    
    // Add confirmation
    if (!window.confirm('Are you sure you want to delete this set?')) {
      return;
    }
    
    try {
      await deleteFlashcardSet(user.uid, setId);
      const updatedSets = await getUserFlashcardSets(user.uid);
      setUserSets(updatedSets);
      
      // Clear current set if it was deleted
      if (currentSetId === setId) {
        setGeneratedCards(null);
        setCurrentSetId('');
      }
    } catch (error) {
      console.error('Error deleting set:', error);
      // You might want to show an error message to the user here
    }
  };

  // Fix 6: Add validation for image processing
  const handleImageProcess = async (extractedText: string) => {
    if (!extractedText?.trim()) {
      console.error('No text extracted from image');
      return;
    }
    
    setShowImageUpload(false);
    setNotes(extractedText.trim());
    setShowNotesInput(true);
  };

  // Add this effect to load starred sets
  useEffect(() => {
    if (user) {
      const loadStarredSets = async () => {
        const docRef = doc(db, 'users', user.uid, 'userData', 'stats');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().starredSets) {
          setStarredSets(new Set(docSnap.data().starredSets));
        }
      };
      loadStarredSets();
    }
  }, [user]);

  // Add this function to handle starring sets
  const handleStarSet = async (setId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!user) return;
    
    const newStarred = new Set(starredSets);
    if (starredSets.has(setId)) {
      newStarred.delete(setId);
    } else {
      newStarred.add(setId);
    }
    setStarredSets(newStarred);

    // Save to Firebase
    const docRef = doc(db, 'users', user.uid, 'userData', 'stats');
    await setDoc(docRef, {
      starredSets: Array.from(newStarred)
    }, { merge: true });
  };

  // Add this effect to load statistics
  useEffect(() => {
    if (user) {
      const loadStats = async () => {
        const docRef = doc(db, 'users', user.uid, 'userData', 'stats');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setTotalStudyTime(data.totalStudyTime || 0);
          setStudiedSets(data.studiedSets || 0);
          setMasteredTerms(data.masteredTerms || 0);
        }
      };
      loadStats();
    }
  }, [user]);

  // Replace the FlashcardViewer modal with navigation
  const handleStudySet = (set: { id: string, cards: any[] }) => {
    setGeneratedCards(set.cards.map((card, index) => ({
      ...card,
      originalIndex: index
    })));
    setCurrentSetId(set.id);
    setShowSets(false);
    setShowStarredSets(false);
  };

  // Add the handleLogout function
  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  // Update the useEffect for loading recently studied sets
  useEffect(() => {
    if (user) {
      const loadRecentSets = async () => {
        const docRef = doc(db, 'users', user.uid, 'userData', 'stats');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().recentSets) {
          const recentSetIds = docSnap.data().recentSets;
          // Get the two most recent sets with their full data
          const recentSets = userSets
            .filter(set => recentSetIds.includes(set.id))
            .slice(0, 2)
            .map(set => ({
              ...set,
              lastStudied: new Date() // Add lastStudied field
            }));
          setRecentlyStudiedSets(recentSets);
        }
      };
      loadRecentSets();
    }
  }, [user, userSets]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#7091E6] dark:bg-[#3D52A0]">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen w-full relative transition-colors duration-300 ${isDarkMode ? 'bg-[#3D52A0]' : 'bg-[#7091E6]'}`}>
      {/* Floating Sidebar */}
      <div className={`
        fixed 
        left-6 
        top-1/2 
        -translate-y-1/2 
        flex 
        flex-col 
        gap-4 
        p-3 
        rounded-2xl 
        backdrop-blur-sm
        z-[60]
        ${isDarkMode 
          ? 'bg-gray-800/70 text-white shadow-lg shadow-gray-900/20' 
          : 'bg-white/70 text-gray-700 shadow-lg shadow-gray-200/20'
        }
      `}>
        <button 
          onClick={() => {
            setGeneratedCards(null);
            setCurrentSetId('');
            setShowSets(false);
            setShowStarredSets(false);
            setShowStats(false);
            setShowNotesInput(false);
            setShowImageUpload(false);
            setShowVideoTranscriber(false);
          }}
          className={`p-3 rounded-xl transition-all duration-200 hover:scale-110 ${
            isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100/50'
          }`}
          title="Home"
        >
          <HomeIcon className="w-6 h-6" />
        </button>

        <button 
          onClick={() => setShowStats(true)}
          className={`p-3 rounded-xl transition-all duration-200 hover:scale-110 ${
            isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100/50'
          }`}
          title="Statistics"
        >
          <ChartBarIcon className="w-6 h-6" />
        </button>

        <button 
          onClick={() => setShowStarredSets(true)}
          className={`p-3 rounded-xl transition-all duration-200 hover:scale-110 ${
            isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100/50'
          }`}
          title="Starred Sets"
        >
          <StarIcon className="w-6 h-6" />
        </button>
      </div>

      {/* Navigation Bar */}
      <nav className={`w-full h-16 shadow-md flex items-center justify-between px-8 transition-colors duration-300 ${
        isDarkMode ? 'bg-gray-800' : 'bg-white'
      }`}>
        {/* Left side - empty for balance */}
        <div className="w-24"></div>

        {/* Center - Logo */}
        <button 
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <h1 className={`text-2xl font-lato font-bold ${
            isDarkMode ? 'text-white' : 'text-gray-800'
          }`}>
            cardbot AI
          </h1>
          <svg 
            className="w-6 h-6 fill-[#7091E6]" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M13 10V3L4 14H11V21L20 10H13Z"/>
          </svg>
        </button>

        {/* Right side - Theme Toggle and Profile */}
        <div className="flex items-center gap-4 w-24 justify-end">
          {/* Theme toggle button */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {isDarkMode ? (
              <SunIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
            ) : (
              <MoonIcon className="w-6 h-6 text-gray-500" />
            )}
          </button>

          {/* Profile dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                {user?.email?.split('@')[0] || 'User'}
              </span>
              <UserCircleIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
            </button>

            {/* Dropdown menu */}
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border dark:border-gray-700 z-50">
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="px-8 py-6 mt-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
              My Library
            </h2>
          </div>

          {/* Display search results or user's sets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* Create New Set Button - Always visible */}
            <div
              onClick={() => setShowCreateOptions(true)}
              className={`
                aspect-square
                p-6
                rounded-xl
                cursor-pointer
                transition-all
                duration-200
                hover:scale-105
                flex flex-col
                items-center
                justify-center
                border-2
                border-dashed
                ${isDarkMode 
                  ? 'bg-gray-800/50 hover:bg-gray-700/50 border-gray-600' 
                  : 'bg-white/50 hover:bg-gray-50/50 border-gray-200'
                }
              `}
            >
              <div className={`text-4xl mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>+</div>
              <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Create New Set
              </p>
            </div>

            {/* Display search results or user's sets */}
            {userSets.map(set => (
              <div
                key={set.id}
                className={`
                  aspect-square
                  p-6
                  rounded-xl
                  cursor-pointer
                  transition-all
                  duration-200
                  hover:scale-105
                  relative
                  group
                  ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50'}
                `}
              >
                {/* Delete button */}
                <button
                  onClick={(e) => handleDeleteSet(set.id, e)}
                  className={`
                    absolute
                    top-4
                    right-4
                    p-2
                    rounded-full
                    opacity-0
                    group-hover:opacity-100
                    transition-all
                    duration-200
                    ${isDarkMode 
                      ? 'hover:bg-gray-600 text-gray-400 hover:text-red-400' 
                      : 'hover:bg-gray-200 text-gray-500 hover:text-red-500'
                    }
                  `}
                  title="Delete set"
                >
                  <svg 
                    className="w-5 h-5" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                    />
                  </svg>
                </button>

                <div className="h-full flex flex-col" onClick={() => handleStudySet(set)}>
                  <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                    {set.title}
                  </h3>
                  
                  {set.cards[0] && (
                    <div className={`
                      flex-1
                      p-4
                      rounded-lg
                      flex flex-col
                      justify-center
                      ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}
                    `}>
                      <p className={`text-base font-medium mb-2 line-clamp-3 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                        {set.cards[0].question}
                      </p>
                      <p className={`text-sm line-clamp-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {set.cards[0].answer}
                      </p>
                    </div>
                  )}

                  <div className="mt-4 flex justify-between items-center">
                    <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {set.cards.length} cards
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => handleStarSet(set.id, e)}
                        className={`
                          p-1.5
                          rounded-full
                          ${starredSets.has(set.id) ? 'text-yellow-400' : 'text-gray-400'}
                        `}
                      >
                        <StarIcon className={`w-4 h-4 ${starredSets.has(set.id) ? 'fill-current' : ''}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create Options Modal */}
      {showCreateOptions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className={`
            w-full 
            max-w-md 
            rounded-2xl 
            shadow-xl 
            p-8
            ${isDarkMode ? 'bg-gray-800' : 'bg-white'}
          `}>
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                Create New Set
              </h2>
              <button 
                onClick={() => setShowCreateOptions(false)}
                className={`p-2 rounded-full hover:bg-opacity-80 transition-colors ${
                  isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => {
                  setShowCreateOptions(false);
                  setShowNotesInput(true);
                }}
                className={`
                  w-full 
                  p-4 
                  rounded-xl 
                  text-left 
                  transition-colors
                  ${isDarkMode 
                    ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-800'
                  }
                `}
              >
                <div className="font-semibold mb-1">Create from Notes</div>
                <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Generate flashcards from your text notes
                </div>
              </button>

              <button
                onClick={() => {
                  setShowCreateOptions(false);
                  setShowImageUpload(true);
                }}
                className={`
                  w-full 
                  p-4 
                  rounded-xl 
                  text-left 
                  transition-colors
                  ${isDarkMode 
                    ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-800'
                  }
                `}
              >
                <div className="font-semibold mb-1">Create from Images</div>
                <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Extract text from images to create flashcards
                </div>
              </button>

              <button
                onClick={() => {
                  setShowCreateOptions(false);
                  setShowVideoTranscriber(true);
                }}
                className={`
                  w-full 
                  p-4 
                  rounded-xl 
                  text-left 
                  transition-colors
                  ${isDarkMode 
                    ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-800'
                  }
                `}
              >
                <div className="font-semibold mb-1">Create from Videos</div>
                <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Generate flashcards from video content
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes Input Modal */}
      {showNotesInput && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className={`
            w-full 
            max-w-2xl 
            rounded-lg 
            shadow-xl 
            p-6
            ${isDarkMode ? 'bg-gray-800' : 'bg-white'}
          `}>
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                Input notes here to become flashcards
              </h2>
              <button 
                onClick={() => setShowNotesInput(false)}
                className={`p-2 rounded-full hover:bg-opacity-80 transition-colors ${
                  isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Number of cards selector */}
            <div className={`mb-4 flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
              <label className="font-medium">Number of cards:</label>
              <div className="relative w-32">
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={cardCount}
                  onChange={(e) => setCardCount(Math.min(50, Math.max(0, parseInt(e.target.value) || 0)))}
                  className={`
                    w-full
                    px-3
                    pr-24
                    py-2
                    rounded-lg
                    border
                    focus:outline-none
                    focus:ring-2
                    [appearance:textfield]
                    [&::-webkit-outer-spin-button]:appearance-none
                    [&::-webkit-inner-spin-button]:appearance-none
                    ${isDarkMode 
                      ? 'bg-gray-700 text-white border-gray-600 focus:ring-[#7091E6]' 
                      : 'bg-white text-gray-800 border-gray-300 focus:ring-[#7091E6]'
                    }
                  `}
                />
                <div className={`absolute right-10 top-1/2 -translate-y-1/2 text-sm ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  / 50
                </div>
                <div className="absolute right-0 top-0 bottom-0 w-8 flex flex-col border-l">
                  <button 
                    onClick={() => setCardCount(prev => Math.min(50, prev + 1))}
                    className={`h-1/2 flex items-center justify-center hover:bg-gray-100 ${
                      isDarkMode ? 'hover:bg-gray-600' : ''
                    }`}
                  >
                    ▲
                  </button>
                  <button 
                    onClick={() => setCardCount(prev => Math.max(0, prev - 1))}
                    className={`h-1/2 flex items-center justify-center hover:bg-gray-100 ${
                      isDarkMode ? 'hover:bg-gray-600' : ''
                    }`}
                  >
                    ▼
                  </button>
                </div>
              </div>
            </div>
            
            {/* Add title input */}
            <div className="mb-4">
              <label className={`block font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                Set Title:
              </label>
              <input
                type="text"
                value={setTitle}
                onChange={(e) => setSetTitle(e.target.value)}
                placeholder="Enter a title for your flashcard set"
                className={`
                  w-full
                  px-3
                  py-2
                  rounded-lg
                  border
                  focus:outline-none
                  focus:ring-2
                  ${isDarkMode 
                    ? 'bg-gray-700 text-white border-gray-600 focus:ring-[#7091E6]' 
                    : 'bg-white text-gray-800 border-gray-300 focus:ring-[#7091E6]'
                  }
                `}
                required
              />
            </div>
            
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`
                w-full 
                h-64 
                p-4 
                rounded-lg 
                border 
                resize-none 
                focus:outline-none 
                focus:ring-2 
                ${isDarkMode 
                  ? 'bg-gray-700 text-white border-gray-600 focus:ring-[#7091E6]' 
                  : 'bg-white text-gray-800 border-gray-300 focus:ring-[#7091E6]'
                }
              `}
              placeholder="Paste or type your notes here..."
            />

            <div className="mt-6 flex justify-end">
              <button 
                onClick={handleGenerateFlashcards}
                disabled={isGenerating || !notes.trim()}
                className={`
                  px-6 
                  py-2 
                  rounded-full 
                  font-semibold 
                  transition-colors
                  ${isDarkMode 
                    ? 'bg-[#7091E6] text-white hover:bg-[#5A7AD1]' 
                    : 'bg-[#7091E6] text-white hover:bg-[#5A7AD1]'
                  }
                  ${(isGenerating || !notes.trim()) && 'opacity-50 cursor-not-allowed'}
                `}
              >
                {isGenerating ? 'Generating...' : 'Generate Flashcards'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Upload Modal */}
      {showImageUpload && (
        <ImageUploader
          onClose={() => setShowImageUpload(false)}
          onProcess={handleImageProcess}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Video Transcriber Modal */}
      {showVideoTranscriber && (
        <VideoTranscriber
          onClose={() => setShowVideoTranscriber(false)}
          onProcess={(notes) => {
            setNotes(notes);
            setShowNotesInput(true);
            setShowVideoTranscriber(false);
          }}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Statistics Modal */}
      {showStats && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className={`
            w-full 
            max-w-4xl 
            rounded-2xl 
            shadow-xl 
            p-8
            ${isDarkMode ? 'bg-gray-800' : 'bg-white'}
          `}>
            <div className="flex justify-between items-center mb-8">
              <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                Study Statistics
              </h2>
              <button 
                onClick={() => setShowStats(false)}
                className={`p-2 rounded-full hover:bg-opacity-80 transition-colors ${
                  isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className={`
                p-6 
                rounded-xl 
                ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}
              `}>
                <h3 className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Total Study Time
                </h3>
                <p className={`text-2xl font-bold mt-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                  {/* Calculate total study time */}
                  {Math.floor(totalStudyTime / 60)}h {totalStudyTime % 60}m
                </p>
              </div>

              <div className={`
                p-6 
                rounded-xl 
                ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}
              `}>
                <h3 className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Total Sets
                </h3>
                <p className={`text-2xl font-bold mt-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                  {userSets.length}
                </p>
              </div>

              <div className={`
                p-6 
                rounded-xl 
                ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}
              `}>
                <h3 className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Sets Studied
                </h3>
                <p className={`text-2xl font-bold mt-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                  {/* Calculate studied sets */}
                  {studiedSets}
                </p>
              </div>

              <div className={`
                p-6 
                rounded-xl 
                ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}
              `}>
                <h3 className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Terms Mastered
                </h3>
                <p className={`text-2xl font-bold mt-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                  {/* Calculate mastered terms */}
                  {masteredTerms}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Starred Sets Modal */}
      {showStarredSets && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className={`
            w-full 
            max-w-4xl 
            rounded-2xl 
            shadow-xl 
            p-8
            ${isDarkMode ? 'bg-gray-800' : 'bg-white'}
          `}>
            <div className="flex justify-between items-center mb-8">
              <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                Starred Sets
              </h2>
              <button 
                onClick={() => setShowStarredSets(false)}
                className={`p-2 rounded-full hover:bg-opacity-80 transition-colors ${
                  isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-2">
              {userSets
                .filter(set => starredSets.has(set.id))
                .map(set => (
                  <div
                    key={set.id}
                    className="group relative"
                  >
                    <button
                      onClick={(e) => handleDeleteSet(set.id, e)}
                      className={`
                        w-full px-4 py-3 
                        text-left 
                        rounded-lg
                        transition-colors
                        ${isDarkMode 
                          ? 'text-white hover:bg-gray-700' 
                          : 'text-gray-800 hover:bg-gray-100'
                        }
                      `}
                    >
                      {set.title}
                    </button>
                    
                    {/* Delete button */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-2">
                      <button
                        onClick={(e) => handleDeleteSet(set.id, e)}
                        className={`
                          p-2 
                          rounded-full
                          opacity-0 group-hover:opacity-100
                          transition-all
                          duration-200
                          ${isDarkMode 
                            ? 'hover:bg-gray-600 text-gray-400 hover:text-red-400' 
                            : 'hover:bg-gray-200 text-gray-500 hover:text-red-500'
                          }
                        `}
                        title="Delete set"
                      >
                        <svg 
                          className="w-5 h-5" 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Flashcard Viewer */}
      {generatedCards && (
        <FlashcardViewer 
          cards={generatedCards}
          onClose={() => setGeneratedCards(null)}
          isDarkMode={isDarkMode}
          setId={currentSetId}
          userId={user.uid}
        />
      )}

      {/* Recently Studied Sets */}
      {recentlyStudiedSets.length > 0 && (
        <div className="px-8 py-6 bg-opacity-50 backdrop-blur-sm rounded-xl">
          <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
            Recently Studied
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {recentlyStudiedSets.map(set => (
              <div
                key={set.id}
                onClick={() => handleStudySet(set)}
                className={`
                  p-6
                  rounded-xl
                  cursor-pointer
                  transition-all
                  duration-200
                  hover:scale-105
                  ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50'}
                `}
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                    {set.title}
                  </h3>
                  <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {set.cards.length} cards
                  </span>
                </div>
                
                {set.cards[0] && (
                  <div className={`
                    p-4
                    rounded-lg
                    ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}
                  `}>
                    <p className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                      {set.cards[0].question}
                    </p>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {set.cards[0].answer}
                    </p>
                  </div>
                )}
                
                <button
                  className={`
                    mt-4
                    px-4
                    py-2
                    w-full
                    text-sm
                    font-medium
                    rounded-lg
                    transition-colors
                    ${isDarkMode 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }
                  `}
                >
                  Continue Studying
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 