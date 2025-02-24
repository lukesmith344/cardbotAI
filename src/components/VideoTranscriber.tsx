'use client';
import { useState, useRef, useEffect } from 'react';
import YouTube from 'react-youtube';

interface VideoTranscriberProps {
  onClose: () => void;
  onProcess: (notes: string) => void;
  isDarkMode: boolean;
}

export default function VideoTranscriber({ onClose, onProcess, isDarkMode }: VideoTranscriberProps) {
  const [videoUrl, setVideoUrl] = useState('');
  const [title, setTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcriptionStatus, setTranscriptionStatus] = useState('');
  const [videoId, setVideoId] = useState<string | null>(null);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    try {
      if (videoUrl) {
        const url = new URL(videoUrl);
        const id = url.searchParams.get('v');
        setVideoId(id);
      }
    } catch (error) {
      setVideoId(null);
    }
  }, [videoUrl]);

  const handleTranscribe = async () => {
    if (!title.trim()) {
      alert('Please enter a title for your flashcard set');
      return;
    }

    if (!videoId) {
      alert('Please enter a valid YouTube URL');
      return;
    }

    setIsProcessing(true);
    setTranscriptionStatus('Checking for YouTube captions...');

    try {
      const response = await fetch('/api/transcribe-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoId }),
      });

      if (!response.ok) {
        throw new Error('Failed to transcribe video');
      }

      const { transcription, method } = await response.json();
      
      if (!transcription) {
        throw new Error('No transcription available for this video');
      }

      setTranscriptionStatus(`Successfully transcribed using ${method}`);
      onProcess(transcription);
    } catch (error) {
      console.error('Error transcribing video:', error);
      alert(error instanceof Error ? error.message : 'Failed to transcribe video. Please try again.');
    } finally {
      setIsProcessing(false);
      setTranscriptionStatus('');
    }
  };

  return (
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
            Transcribe Video
          </h2>
          <button 
            onClick={onClose}
            className={`p-2 rounded-full hover:bg-opacity-80 transition-colors ${
              isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Title Input */}
        <div className="mb-4">
          <label className={`block font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
            Set Title:
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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

        {/* Video URL Input */}
        <div className="mb-6">
          <label className={`block font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
            YouTube Video URL:
          </label>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="Enter YouTube video URL (e.g., https://www.youtube.com/watch?v=...)"
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

        {/* Video Preview */}
        {videoId && (
          <div className="mb-6">
            <YouTube
              videoId={videoId}
              opts={{
                height: '240',
                width: '100%',
                playerVars: {
                  controls: 1,
                }
              }}
              onReady={(event) => {
                playerRef.current = event.target;
              }}
            />
          </div>
        )}

        {/* Status Message */}
        {transcriptionStatus && (
          <div className={`mb-4 text-center ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {transcriptionStatus}
          </div>
        )}

        {/* Transcribe Button */}
        <div className="flex justify-end">
          <button
            onClick={handleTranscribe}
            disabled={!videoId || isProcessing || !title.trim()}
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
              ${(!videoId || isProcessing || !title.trim()) && 'opacity-50 cursor-not-allowed'}
            `}
          >
            {isProcessing ? 'Transcribing...' : 'Transcribe Video'}
          </button>
        </div>
      </div>
    </div>
  );
} 