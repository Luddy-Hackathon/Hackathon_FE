export interface ChatMessage {
  id?: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

// In-memory storage for chat messages
const chatSessions: Record<string, ChatMessage[]> = {};

/**
 * Save a chat message to the in-memory store
 */
export function saveChatMessage(message: ChatMessage): ChatMessage {
  const timestamp = Date.now();
  const id = `msg_${timestamp}`;
  
  const newMessage: ChatMessage = {
    ...message,
    id,
    timestamp,
  };
  
  if (!chatSessions[message.sessionId]) {
    chatSessions[message.sessionId] = [];
  }
  
  chatSessions[message.sessionId].push(newMessage);
  return newMessage;
}

/**
 * Get chat history for a session
 */
export function getChatHistory(sessionId: string): ChatMessage[] {
  return chatSessions[sessionId] || [];
}

/**
 * Delete a chat session
 */
export function deleteChatSession(sessionId: string): boolean {
  if (chatSessions[sessionId]) {
    delete chatSessions[sessionId];
    return true;
  }
  return false;
} 