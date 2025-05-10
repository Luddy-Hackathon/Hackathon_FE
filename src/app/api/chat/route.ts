import { NextRequest, NextResponse } from 'next/server';
import { processChatMessage } from '@/utils/main-agent';
import { getChatHistory, type ChatMessage } from '@/utils/chatHistory';

// export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      message, 
      sessionId, 
      username,
      userId,
      projectContext, 
      useAdvisorMode
    } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Get chat history if sessionId is provided
    let history: ChatMessage[] = [];
    if (sessionId) {
      history = getChatHistory(sessionId);
    }

    // Process the chat message
    const response = await processChatMessage({
      message,
      sessionId,
      username,
      userId,
      projectContext,
      history,
      useAdvisorMode
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error processing chat request:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
} 