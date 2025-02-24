import { GoogleGenerativeAI } from "@google/generative-ai";

// Make sure the API key is being read correctly
const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('NEXT_PUBLIC_GEMINI_API_KEY is not set in environment variables');
}

const genAI = new GoogleGenerativeAI(apiKey);

export async function generateFlashcards(notes: string, numCards: number) {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  const prompt = `take these notes and generate ${numCards} flashcards. use the most important information from the notes. Format each flashcard as "Q: question \nA: answer" with a blank line between each card.\n\nNotes:\n${notes}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Parse the response into flashcard objects
    const cards = text.split('\n\n').map(card => {
      const [question, answer] = card.split('\nA: ');
      return {
        question: question.replace('Q: ', ''),
        answer: answer
      };
    });

    return cards;
  } catch (error) {
    console.error('Error generating flashcards:', error);
    throw error;
  }
} 