'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { doc, getDoc, updateDoc, increment, arrayUnion, setDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import confetti from 'canvas-confetti';
import { generateFlashcards } from '@/lib/gemini';
import { updateUserStats } from '@/firebase/flashcards';

interface Flashcard {
  question: string;
  answer: string;
  originalIndex: number;
}

interface FlashcardViewerProps {
  cards: Flashcard[];
  onClose: () => void;
  isDarkMode: boolean;
  setId: string;
  userId: string;
}

// Update the animation variants
const cardVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30
    }
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30
    }
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30
    }
  })
};

const flipVariants = {
  front: {
    rotateY: 0,
    opacity: 1,
    transition: {
      type: "tween",
      duration: 0.4,
      ease: "easeInOut"
    }
  },
  back: {
    rotateY: 180,
    opacity: 0,
    transition: {
      type: "tween",
      duration: 0.4,
      ease: "easeInOut"
    }
  }
};

export default function FlashcardViewer({ cards, onClose, isDarkMode, setId, userId }: FlashcardViewerProps) {
  const [mode, setMode] = useState<'review' | 'learn'>('review');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studyStartTime, setStudyStartTime] = useState<Date>(new Date());
  
  // Learn mode state
  const [learnState, setLearnState] = useState({
    remainingCards: cards.map((_, i) => i),
    learningPile: [] as number[],
    masteredPile: [] as number[],
    showAnswer: false,
    currentCard: 0,
    currentRound: 1
  });

  // Stats tracking
  const [stats, setStats] = useState({
    mastered: 0,
    learning: 0,
    remaining: cards.length
  });

  // Add completion state and handlers
  const [isComplete, setIsComplete] = useState(false);

  // Add these states
  const [direction, setDirection] = useState(0);
  const controls = useAnimation();

  // Add new state for explanation
  const [explanation, setExplanation] = useState<string>('');
  const [isExplaining, setIsExplaining] = useState(false);

  // Handle keyboard controls
  useEffect(() => {
    const handleKeyPress = async (e: KeyboardEvent) => {
      if (mode === 'learn') {
        switch (e.key) {
          case 'ArrowRight':
            if (!isComplete) {
              handleKnowCard();
            }
            break;
          case 'ArrowLeft':
            if (!isComplete) {
              handleStillLearning();
            }
            break;
          case 'ArrowUp':
          case 'ArrowDown':
            e.preventDefault();
            setLearnState(prev => ({ ...prev, showAnswer: !prev.showAnswer }));
            break;
        }
      } else {
        switch (e.key) {
          case 'ArrowLeft':
            if (currentIndex > 0) {
              setDirection(-1);
              handlePrev();
            }
            break;
          case 'ArrowRight':
            if (currentIndex < cards.length - 1) {
              setDirection(1);
              handleNext();
            }
            break;
          case 'ArrowUp':
          case 'ArrowDown':
            e.preventDefault();
            setIsFlipped(!isFlipped);
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [mode, isFlipped, currentIndex, cards.length, isComplete]);

  // Handle "Know It" (right arrow)
  const handleKnowCard = () => {
    if (isComplete) return;

    setDirection(1);
    const currentCardIndex = learnState.remainingCards[learnState.currentCard];
    
    setLearnState(prev => {
      const newRemaining = prev.remainingCards.filter((_, i) => i !== prev.currentCard);
      
      // If this was the last card in current pile
      if (newRemaining.length === 0) {
        if (prev.learningPile.length === 0) {
          // All cards mastered
          triggerConfetti();
          setIsComplete(true);
          return {
            ...prev,
            remainingCards: [],
            masteredPile: [...prev.masteredPile, currentCardIndex],
            currentCard: 0,
            showAnswer: false
          };
        }
        
        // Move to learning pile
        return {
          ...prev,
          remainingCards: [...prev.learningPile],
          learningPile: [],
          masteredPile: [...prev.masteredPile, currentCardIndex],
          currentCard: 0,
          showAnswer: false
        };
      }

      // Continue with current pile
      return {
        ...prev,
        remainingCards: newRemaining,
        masteredPile: [...prev.masteredPile, currentCardIndex],
        currentCard: prev.currentCard >= newRemaining.length ? 0 : prev.currentCard,
        showAnswer: false
      };
    });
  };

  // Handle "Still Learning" (left arrow)
  const handleStillLearning = () => {
    if (isComplete) return;

    setDirection(-1);
    const currentCardIndex = learnState.remainingCards[learnState.currentCard];
    
    setLearnState(prev => {
      const newRemaining = prev.remainingCards.filter((_, i) => i !== prev.currentCard);
      
      // If this was the last card in current pile
      if (newRemaining.length === 0) {
        if (prev.learningPile.length > 0) {
          // Start new round with learning pile
          return {
            ...prev,
            remainingCards: [...prev.learningPile],
            learningPile: [],
            currentCard: 0,
            showAnswer: false
          };
        }
      }

      // Continue with current pile
      return {
        ...prev,
        remainingCards: newRemaining,
        learningPile: [...prev.learningPile, currentCardIndex],
        currentCard: prev.currentCard >= newRemaining.length ? 0 : prev.currentCard,
        showAnswer: false
      };
    });
  };

  // Regular review mode functions
  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setIsFlipped(false);
    }
  };

  // Update study time
  useEffect(() => {
    const updateInterval = setInterval(async () => {
      const timeSpentMinutes = Math.floor((Date.now() - studyStartTime.getTime()) / 60000);
      if (timeSpentMinutes > 0) {
        const statsRef = doc(db, 'users', userId, 'userData', 'stats');
        await setDoc(statsRef, {
          totalStudyTime: increment(1),
          lastStudied: new Date()
        }, { merge: true });
      }
    }, 60000);

    return () => clearInterval(updateInterval);
  }, [userId, studyStartTime]);

  // Add completion state and handlers
  const handleRelearn = () => {
    setLearnState({
      remainingCards: cards.map((_, i) => i),
      learningPile: [],
      masteredPile: [],
      showAnswer: false,
      currentCard: 0,
      currentRound: 1
    });
    setIsComplete(false);
  };

  const triggerConfetti = () => {
    // First burst
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF']
    });

    // Second burst after a delay
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF']
      });
    }, 200);

    // Third burst after another delay
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF']
      });
    }, 400);
  };

  // Update the renderLearnCard function
  const renderLearnCard = () => {
    if (learnState.remainingCards.length === 0 && learnState.learningPile.length === 0) {
      return null;
    }

    const currentCard = learnState.remainingCards[learnState.currentCard];
    const currentCardData = currentCard !== undefined ? cards[currentCard] : null;

    // Calculate the current card number based on total progress
    const cardsReviewed = learnState.masteredPile.length + learnState.learningPile.length;
    const currentCardNumber = cardsReviewed + learnState.currentCard + 1;

    return (
      <div className="relative">
        {/* Card counter */}
        <div className="absolute -top-6 w-full text-center">
          <span className="text-2xl font-bold text-black">
            Card {currentCardNumber} out of {cards.length}
          </span>
        </div>

        <div className="relative w-full aspect-[3/2] perspective-1000">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            {currentCardData && (
              <motion.div
                key={`card-${currentCard}-${learnState.remainingCards.length}`}
                custom={direction}
                variants={cardVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="absolute inset-0"
              >
                <motion.div
                  className={`
                    absolute inset-0
                    ${isDarkMode ? 'bg-gray-700' : 'bg-white'} 
                    rounded-xl 
                    shadow-xl 
                    p-8 
                    flex 
                    items-center 
                    justify-center
                    backface-hidden
                    cursor-pointer
                  `}
                  animate={learnState.showAnswer ? "back" : "front"}
                  variants={flipVariants}
                  onClick={() => setLearnState(prev => ({ ...prev, showAnswer: !prev.showAnswer }))}
                >
                  <div className="text-center text-4xl font-bold text-black">
                    {currentCardData?.question}
                  </div>
                </motion.div>
                <motion.div
                  className={`
                    absolute inset-0
                    ${isDarkMode ? 'bg-gray-700' : 'bg-white'} 
                    rounded-xl 
                    shadow-xl 
                    p-8 
                    flex 
                    items-center 
                    justify-center
                    backface-hidden
                    cursor-pointer
                  `}
                  animate={learnState.showAnswer ? "front" : "back"}
                  variants={flipVariants}
                  onClick={() => setLearnState(prev => ({ ...prev, showAnswer: !prev.showAnswer }))}
                  style={{ rotateY: 180 }}
                >
                  <div className="text-center text-4xl font-bold text-black">
                    {currentCardData?.answer}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  // Update the review mode card component
  const renderReviewCard = () => (
    <div className="relative">
      {/* Card counter positioned closer to card with larger text */}
      <div className="absolute -top-6 w-full text-center">
        <span className="text-2xl font-bold text-black">
          Card {currentIndex + 1} out of {cards.length}
        </span>
      </div>

      <div className="relative w-full aspect-[3/2] perspective-1000">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={cardVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="absolute inset-0"
          >
            <motion.div
              className={`
                absolute inset-0
                ${isDarkMode ? 'bg-gray-700' : 'bg-white'} 
                rounded-xl 
                shadow-xl 
                p-8 
                flex 
                items-center 
                justify-center
                cursor-pointer
                backface-hidden
              `}
              animate={isFlipped ? "back" : "front"}
              variants={flipVariants}
              onClick={() => setIsFlipped(!isFlipped)}
            >
              <div className="text-center text-4xl font-bold text-black">
                {cards[currentIndex].question}
              </div>
            </motion.div>
            <motion.div
              className={`
                absolute inset-0
                ${isDarkMode ? 'bg-gray-700' : 'bg-white'} 
                rounded-xl 
                shadow-xl 
                p-8 
                flex 
                items-center 
                justify-center
                cursor-pointer
                backface-hidden
              `}
              animate={isFlipped ? "front" : "back"}
              variants={flipVariants}
              onClick={() => setIsFlipped(!isFlipped)}
              style={{ rotateY: 180 }}
            >
              <div className="text-center text-4xl font-bold text-black">
                {cards[currentIndex].answer}
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );

  // Update the generateExplanation function
  const generateExplanation = async (question: string, answer: string) => {
    setIsExplaining(true);
    try {
      const prompt = `Provide a simple explanation of the flashcard, using an example. Make sure this isn't just repeated information from the card. If the answer for the card is 1-2 words, provide more context for the user and do not repeat the answer. Ensure that the explanation is at least one complete sentence long:\nQuestion: ${question}\nAnswer: ${answer}`;
      const explanation = await generateFlashcards(prompt, 1);
      if (explanation && explanation[0]) {
        setExplanation(explanation[0].answer);
      } else {
        throw new Error('No explanation generated');
      }
    } catch (error) {
      console.error('Error generating explanation:', error);
      setExplanation('Failed to generate explanation. Please try again.');
    } finally {
      setIsExplaining(false);
    }
  };

  // Clear explanation when card changes
  useEffect(() => {
    setExplanation('');
  }, [learnState.currentCard, currentIndex]);

  // When closing the viewer, update stats
  const handleClose = async () => {
    if (userId) {
      const studyEndTime = new Date();
      const timeStudied = Math.floor((studyEndTime.getTime() - studyStartTime.getTime()) / 60000); // Convert to minutes
      await updateUserStats(userId, timeStudied);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={(e) => {
      if (e.target === e.currentTarget) handleClose();
    }}>
      <div className={`
        w-full 
        max-w-4xl 
        rounded-2xl 
        shadow-xl 
        p-8
        ${isDarkMode ? 'bg-gray-800' : 'bg-white'}
      `}>
        {isComplete ? (
          <div className="space-y-8">
            <div className="aspect-[3/2] bg-white dark:bg-gray-700 rounded-xl shadow-xl p-8 flex flex-col items-center justify-center">
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">
                Well done! 🎉
              </h2>
              <div className="flex gap-4">
                <button
                  onClick={handleRelearn}
                  className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold"
                >
                  Re-Study
                </button>
                <button
                  onClick={handleClose}
                  className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold"
                >
                  Go Home
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
              <div className="flex gap-6">
                <button
                  onClick={() => setMode('review')}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    mode === 'review' ? 'bg-blue-500 text-white' : 'text-gray-600 dark:text-gray-300'
                  }`}
                >
                  Review
                </button>
                <button
                  onClick={() => setMode('learn')}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    mode === 'learn' ? 'bg-blue-500 text-white' : 'text-gray-600 dark:text-gray-300'
                  }`}
                >
                  Learn
                </button>
              </div>
              <button onClick={handleClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Flashcard Content */}
            {mode === 'learn' ? (
              <div className="space-y-8">
                {/* Progress tracking - improved */}
                <div className="flex justify-center gap-16 mb-4">
                  <div className="flex flex-col items-center">
                    <span className="text-xl font-bold text-green-600 dark:text-green-400">
                      {learnState.masteredPile.length}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Known
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-xl font-bold text-yellow-500 dark:text-yellow-400">
                      {learnState.learningPile.length}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Learning
                    </span>
                  </div>
                </div>
                
                {/* Progress bar */}
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full flex transition-all duration-300">
                    <div 
                      className="h-full bg-green-500 transition-all duration-300"
                      style={{ 
                        width: `${(learnState.masteredPile.length / cards.length) * 100}%` 
                      }}
                    />
                    <div 
                      className="h-full bg-yellow-400 transition-all duration-300"
                      style={{ 
                        width: `${(learnState.learningPile.length / cards.length) * 100}%` 
                      }}
                    />
                  </div>
                </div>

                {learnState.learningPile.length > 0 && (
                  <div className="text-center mt-2">
                    <span className="text-lg text-yellow-500">
                      ({learnState.learningPile.length} cards to review)
                    </span>
                  </div>
                )}

                {renderLearnCard()}
                
                {/* Updated controls */}
                <div className="flex justify-center items-center gap-8">
                  <button
                    onClick={handleStillLearning}
                    disabled={isComplete}
                    className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  >
                    <ArrowLeftIcon className="w-5 h-5" />
                    Still Learning
                  </button>
                  <button
                    onClick={() => setLearnState(prev => ({ ...prev, showAnswer: !prev.showAnswer }))}
                    disabled={isComplete}
                    className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  >
                    {learnState.showAnswer ? 'Hide Answer' : 'Show Answer'}
                  </button>
                  <button
                    onClick={handleKnowCard}
                    disabled={isComplete}
                    className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  >
                    Know It
                    <ArrowRightIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Just render the card with its counter */}
                {renderReviewCard()}
                
                {/* Controls */}
                <div className="flex justify-center items-center gap-4">
                  <button
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                    className="flex items-center gap-2 px-6 py-3 bg-gray-500 text-white rounded-lg disabled:opacity-50"
                  >
                    <ArrowLeftIcon className="w-5 h-5" />
                    Previous
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={currentIndex === cards.length - 1}
                    className="flex items-center gap-2 px-6 py-3 bg-gray-500 text-white rounded-lg disabled:opacity-50"
                  >
                    Next
                    <ArrowRightIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Add this right after the flashcard viewer div (the main white/dark box) */}
        <div className="absolute right-32 top-20 flex flex-col items-start z-10">
          <button
            onClick={() => generateExplanation(
              mode === 'learn' 
                ? cards[learnState.remainingCards[learnState.currentCard]].question 
                : cards[currentIndex].question,
              mode === 'learn'
                ? cards[learnState.remainingCards[learnState.currentCard]].answer
                : cards[currentIndex].answer
            )}
            disabled={isExplaining}
            className={`
              p-3
              rounded-full
              transition-all
              duration-200
              hover:scale-110
              ${isDarkMode 
                ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                : 'bg-white hover:bg-gray-100 text-gray-800'
              }
              shadow-lg
              ${isExplaining && 'opacity-50 cursor-not-allowed'}
            `}
            title="Get AI explanation"
          >
            <svg 
              className="w-8 h-8" 
              viewBox="0 0 24 24" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                d="M12 2C7.58172 2 4 5.58172 4 10C4 12.9087 5.4647 15.3791 7.69867 16.7285L8 17V19C8 19.5523 8.44772 20 9 20H15C15.5523 20 16 19.5523 16 19V17L16.3013 16.7285C18.5353 15.3791 20 12.9087 20 10C20 5.58172 16.4183 2 12 2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="9" cy="9" r="1.5" fill="currentColor" />
              <circle cx="15" cy="9" r="1.5" fill="currentColor" />
              <path 
                d="M9 13C9.5 14 10.3333 15 12 15C13.6667 15 14.5 14 15 13"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path 
                d="M8 21H16M12 17V21"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>

          {/* Speech bubble positioning adjusted */}
          <div className={`
            mt-4
            ml-1
            p-4
            rounded-lg
            text-sm
            w-64
            relative
            ${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-white text-gray-700'}
            shadow-lg
            animate-fadeIn
          `}>
            {/* Arrow pointing to robot */}
            <div className={`
              absolute
              -top-2
              left-4
              w-4
              h-4
              transform
              -rotate-45
              ${isDarkMode ? 'bg-gray-700' : 'bg-white'}
            `} />
            
            <p className="whitespace-pre-wrap text-center">
              {isExplaining ? (
                <span className="flex items-center justify-center gap-2">
                  Thinking
                  <span className="animate-bounce">.</span>
                  <span className="animate-bounce delay-100">.</span>
                  <span className="animate-bounce delay-200">.</span>
                </span>
              ) : explanation ? (
                explanation
              ) : (
                "Need help? I'll explain this!"
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}