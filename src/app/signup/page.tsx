'use client';
import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/firebase/config';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, setDoc } from 'firebase/firestore';

const Signup = () => {
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      // Create the user with email and password
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // Store additional user data in Firestore using the Firebase Auth UID as the document ID
      await setDoc(doc(db, 'users', uid), {
        email: email,
        userId: userId,
        firebaseUid: uid,
        createdAt: new Date().toISOString()
      });

      console.log('User created:', {
        uid: uid,
        email: email,
        userId: userId
      });

      router.push('/login');
    } catch (error: any) {
      console.error('Signup error:', error);
      setError(error.message || 'Failed to sign up. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex relative">
      {/* Left side - Signup section */}
      <div className="w-1/2 bg-[#7091E6] p-12 flex flex-col items-center pt-[12rem]">
        <div className="w-full max-w-md">
          <h1 className="text-5xl font-lato font-bold text-white mb-16 flex items-center gap-2 pl-16">
            cardbot AI 
            <svg 
              className="w-8 h-8 fill-white" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M13 10V3L4 14H11V21L20 10H13Z"/>
            </svg>
          </h1>

          <h2 className="text-3xl font-lato font-bold text-white mb-12 flex items-center gap-2">
            Create your account! 👋
          </h2>
          
          <form onSubmit={handleSignup} className="flex flex-col gap-12">
            {error && <p className="text-red-500 text-center bg-white px-4 py-2 rounded">{error}</p>}
            
            <input 
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#7091E6] bg-white text-black"
              required
            />
            <input 
              type="text"
              placeholder="Choose a User ID (e.g., lukes34)"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#7091E6] bg-white text-black"
              required
            />
            <input 
              type="password"
              placeholder="Choose a Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#7091E6] bg-white text-black"
              required
            />
            <button 
              type="submit"
              className="mt-8 bg-white text-[#7091E6] px-8 py-4 rounded-full font-bold hover:bg-gray-50 transition-colors"
            >
              Sign Up
            </button>
            <p className="text-white text-center">
              Already have an account? <Link href="/login" className="underline hover:opacity-80 cursor-pointer">Log In</Link>
            </p>
          </form>
        </div>
      </div>

      {/* White thorn/point */}
      <div className="absolute left-1/2 top-1/2 -translate-y-1/2 -translate-x-[20px]">
        <svg width="20" height="40" viewBox="0 0 60 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M60 0V120L0 60L60 0Z" fill="white"/>
        </svg>
      </div>

      {/* Right side */}
      <div className="w-1/2 bg-white flex items-start justify-center p-12 pt-72">
        <div className="flex flex-col items-center gap-16">
          <h2 className="text-4xl font-lato font-bold text-gray-800">
            <span className="bg-yellow-200 px-2">Instant</span> AI generated flashcards
          </h2>
          
          <div className="flex justify-between w-full max-w-[600px]">
            {/* Document icon with text */}
            <div className="flex flex-col items-center gap-4">
              <svg className="w-16 h-16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 5H6C5.44772 5 5 5.44772 5 6V18C5 18.5523 5.44772 19 6 19H18C18.5523 19 19 18.5523 19 18V6C19 5.44772 18.5523 5 18 5H16M8 5V3H16V5M8 5H16M8 10H16M8 14H13" 
                  stroke="black" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span className="text-gray-800 font-medium">Notes-to-cards</span>
            </div>

            {/* Image icon with text */}
            <div className="flex flex-col items-center gap-4">
              <svg className="w-16 h-16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="4" width="16" height="16" rx="2" stroke="black" strokeWidth="2"/>
                <circle cx="8.5" cy="8.5" r="1.5" fill="black"/>
                <path d="M5 19L8 13L11 15L15 10L19 16.5V17C19 18.1046 18.1046 19 17 19H5Z" fill="black"/>
              </svg>
              <span className="text-gray-800 font-medium">Images-to-cards</span>
            </div>

            {/* Video icon with text */}
            <div className="flex flex-col items-center gap-4">
              <svg className="w-16 h-16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="6" width="18" height="12" rx="2" stroke="black" strokeWidth="2"/>
                <path d="M10 9L15 12L10 15V9Z" fill="black"/>
              </svg>
              <span className="text-gray-800 font-medium">Videos-to-cards</span>
            </div>
          </div>

          <h3 className="text-2xl font-lato text-gray-800 text-center whitespace-nowrap">
            Generate for free <span className="text-[#7091E6] mx-3">•</span> Easy to use <span className="text-[#7091E6] mx-3">•</span> No work required
          </h3>
        </div>
      </div>
    </div>
  );
};

export default Signup; 