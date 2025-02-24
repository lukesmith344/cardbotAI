'use client';
import { useState, useCallback } from 'react';
import Image from 'next/image';
import { createWorker } from 'tesseract.js';

interface ImageUploaderProps {
  onClose: () => void;
  onProcess: (notes: string) => void;
  isDarkMode: boolean;
}

export default function ImageUploader({ onClose, onProcess, isDarkMode }: ImageUploaderProps) {
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [title, setTitle] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string[]>([]);

  const processFiles = useCallback((files: File[]) => {
    if (files.length + images.length > 5) {
      alert('Maximum 5 images allowed');
      return;
    }

    // Filter for only image files
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    const newImages = [...images, ...imageFiles];
    setImages(newImages);

    // Generate previews
    const newPreviews = imageFiles.map(file => URL.createObjectURL(file));
    setPreviews([...previews, ...newPreviews]);
  }, [images, previews]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    setImages(newImages);
    setPreviews(newPreviews);
  };

  const handleProcess = async () => {
    if (!title.trim()) {
      alert('Please enter a title for your flashcard set');
      return;
    }

    setIsProcessing(true);
    setProcessingStatus(new Array(images.length).fill('Waiting...'));

    try {
      const worker = await createWorker('eng');
      const results = [];

      for (let i = 0; i < images.length; i++) {
        setProcessingStatus(prev => {
          const newStatus = [...prev];
          newStatus[i] = 'Starting...';
          return newStatus;
        });

        // Convert File to base64
        const reader = new FileReader();
        const base64Promise = new Promise((resolve) => {
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(images[i]);
        });
        const base64Image = await base64Promise;

        const { data: { text } } = await worker.recognize(base64Image);

        setProcessingStatus(prev => {
          const newStatus = [...prev];
          newStatus[i] = 'Complete ✓';
          return newStatus;
        });

        results.push(text);
      }

      await worker.terminate();

      const extractedText = results
        .filter(text => text.length > 0)
        .join('\n\n');

      if (!extractedText) {
        throw new Error('No text was extracted from the images');
      }

      onProcess(extractedText);
    } catch (error) {
      console.error('Error processing images:', error);
      alert(error instanceof Error ? error.message : 'Failed to process images. Please try again.');
    } finally {
      setIsProcessing(false);
      setProcessingStatus([]);
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
            Upload Images (Max 5)
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

        {/* Updated Image Upload Area */}
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            mb-4 
            p-8
            border-2 
            border-dashed 
            rounded-lg
            transition-colors
            duration-200
            ${isDragging 
              ? 'border-[#7091E6] bg-[#7091E6]/10' 
              : isDarkMode 
                ? 'border-gray-600' 
                : 'border-gray-300'
            }
          `}
        >
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            className="hidden"
            id="image-upload"
            disabled={images.length >= 5}
          />
          <label
            htmlFor="image-upload"
            className={`
              flex flex-col items-center justify-center
              cursor-pointer
              ${images.length >= 5 ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <svg 
              className={`w-12 h-12 mb-3 transition-colors ${
                isDragging ? 'text-[#7091E6]' : isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
              />
            </svg>
            <p className={`text-sm mb-1 font-medium ${
              isDragging ? 'text-[#7091E6]' : isDarkMode ? 'text-gray-300' : 'text-gray-600'
            }`}>
              {isDragging ? 'Drop images here' : 'Drag and drop images here'}
            </p>
            <p className={`text-xs ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>
              or click to select ({5 - images.length} remaining)
            </p>
          </label>
        </div>

        {/* Image Previews with Status */}
        {previews.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            {previews.map((preview, index) => (
              <div key={index} className="relative group">
                <div className="aspect-w-4 aspect-h-3 rounded-lg overflow-hidden">
                  <Image
                    src={preview}
                    alt={`Preview ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                  {isProcessing && (
                    <div className={`
                      absolute inset-0 
                      bg-black bg-opacity-50 
                      flex items-center justify-center
                      text-white text-sm
                      transition-opacity
                    `}>
                      {processingStatus[index]}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => removeImage(index)}
                  className="absolute top-2 right-2 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  disabled={isProcessing}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Process Button */}
        <div className="flex justify-end">
          <button
            onClick={handleProcess}
            disabled={images.length === 0 || isProcessing || !title.trim()}
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
              ${(images.length === 0 || isProcessing || !title.trim()) && 'opacity-50 cursor-not-allowed'}
            `}
          >
            {isProcessing ? 'Processing...' : 'Process Images'}
          </button>
        </div>
      </div>
    </div>
  );
} 