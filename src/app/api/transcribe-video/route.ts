import { NextRequest, NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';

export async function POST(req: NextRequest) {
  try {
    const { videoId } = await req.json();

    if (!videoId) {
      return NextResponse.json(
        { error: 'No video ID provided' },
        { status: 400 }
      );
    }

    try {
      // Get YouTube captions
      const transcript = await YoutubeTranscript.fetchTranscript(videoId);
      const transcription = transcript
        .map(part => part.text)
        .join(' ');

      return NextResponse.json({ 
        transcription,
        method: 'YouTube Captions'
      });
    } catch (error) {
      console.error('Failed to get YouTube transcript:', error);
      throw new Error('No captions available for this video. Try a different video that has captions enabled.');
    }
  } catch (error) {
    console.error('Error transcribing video:', error);
    return NextResponse.json(
      { error: 'Failed to transcribe video: ' + (error as Error).message },
      { status: 500 }
    );
  }
} 