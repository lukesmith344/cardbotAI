import { NextRequest, NextResponse } from 'next/server';
import { createWorker } from 'tesseract.js';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const images = [];
    
    // Collect all images from form data
    for (let i = 0; i < 5; i++) {
      const image = formData.get(`image${i}`);
      if (image && image instanceof Blob) {
        images.push(image);
      }
    }

    if (images.length === 0) {
      return NextResponse.json(
        { error: 'No images provided' },
        { status: 400 }
      );
    }

    // Initialize Tesseract worker
    const worker = await createWorker({
      logger: m => {
        // Log progress for debugging
        console.log(m);
      }
    });
    await worker.loadLanguage('eng');
    await worker.initialize('eng');

    // Process each image with Tesseract
    const textPromises = images.map(async (image, index) => {
      const imageUrl = URL.createObjectURL(image);
      const { data: { text } } = await worker.recognize(imageUrl);
      URL.revokeObjectURL(imageUrl);
      return { index, text };
    });

    const results = await Promise.all(textPromises);

    // Terminate worker
    await worker.terminate();

    // Combine all extracted text
    const extractedText = results
      .sort((a, b) => a.index - b.index) // Maintain original order
      .map(result => result.text)
      .filter(text => text.length > 0)
      .join('\n\n');

    if (!extractedText) {
      return NextResponse.json(
        { error: 'No text found in images' },
        { status: 400 }
      );
    }

    return NextResponse.json({ extractedText });
  } catch (error) {
    console.error('Error processing images:', error);
    return NextResponse.json(
      { error: 'Failed to process images: ' + (error as Error).message },
      { status: 500 }
    );
  }
} 