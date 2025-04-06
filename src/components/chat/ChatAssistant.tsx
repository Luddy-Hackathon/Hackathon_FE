"use client";

import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Loader2, Settings, Star, HelpCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Course, Student } from '@/types';
import { cn } from "@/lib/utils";

// API configuration
const API_CONFIG = {
  url: process.env.NEXT_PUBLIC_GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models',
  model: process.env.NEXT_PUBLIC_GEMINI_MODEL || 'gemini-1.5-flash',
  key: process.env.NEXT_PUBLIC_GEMINI_API_KEY
};

// Cache configuration
const CHAT_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

interface ChatCache {
  messages: Message[];
  timestamp: number;
}

// Utility functions for chat persistence
const chatStorage = {
  getKey: (studentId: string) => `chat_history_${studentId}`,
  
  save: (studentId: string, messages: Message[]) => {
    try {
      const cache: ChatCache = {
        messages,
        timestamp: Date.now()
      };
      localStorage.setItem(chatStorage.getKey(studentId), JSON.stringify(cache));
    } catch (error) {
      console.error('Failed to save chat history:', error);
    }
  },
  
  load: (studentId: string): Message[] | null => {
    try {
      const cached = localStorage.getItem(chatStorage.getKey(studentId));
      if (!cached) return null;
      
      const { messages, timestamp }: ChatCache = JSON.parse(cached);
      if (Date.now() - timestamp > CHAT_CACHE_DURATION) {
        localStorage.removeItem(chatStorage.getKey(studentId));
        return null;
      }
      
      // Convert string dates back to Date objects
      return messages.map(m => ({
        ...m,
        timestamp: new Date(m.timestamp)
      }));
    } catch (error) {
      console.error('Failed to load chat history:', error);
      return null;
    }
  }
};

// Parse LLM response to extract recommendations and metadata
function parseLLMResponse(text: string): { content: string; metadata?: Message['metadata'] } {
  try {
    // Extract JSON objects from the response
    const jsonMatches = text.match(/\{[^{}]*\}/g) || [];
    let cleanContent = text;
    let metadata: Message['metadata'] = {};

    for (const jsonStr of jsonMatches) {
      try {
        const data = JSON.parse(jsonStr);
        
        // Extract course recommendations if present
        if (data.recommendedCourses && Array.isArray(data.recommendedCourses)) {
          metadata.recommendedCourses = data.recommendedCourses;
          cleanContent = cleanContent.replace(jsonStr, '');
        }
        
        // Extract user preferences if present
        if (data.userPreferences) {
          metadata.userPreferences = data.userPreferences;
          cleanContent = cleanContent.replace(jsonStr, '');
        }
      } catch (e) {
        // Skip invalid JSON
        continue;
      }
    }

    // Clean up the content
    cleanContent = cleanContent
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    return { content: cleanContent, metadata };
  } catch (error) {
    console.error('Error parsing LLM response:', error);
    return { content: text };
  }
}

type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    recommendedCourses?: number[];
    userPreferences?: {
      subjects?: string[];
      difficulty?: string;
      timeSlots?: string[];
    };
  };
};

type APIError = {
  error?: {
    message: string;
  };
};

type ChatAssistantProps = {
  student: Student;
  courses: Course[];
  onRecommendationsUpdate?: (recommendations: number[]) => void;
  onPreferencesUpdate?: (preferences: any) => void;
};

export default function ChatAssistant({ 
  student, 
  courses,
  onRecommendationsUpdate,
  onPreferencesUpdate 
}: ChatAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history on component mount
  useEffect(() => {
    if (student?.id) {
      const cachedMessages = chatStorage.load(student.id);
      if (cachedMessages) {
        setMessages(cachedMessages);
      } else {
        // Initialize with system message if no cache
        setMessages([{
          role: 'system',
          content: student ? `You are a helpful course recommendation assistant. The student's profile is:
Name: ${student.full_name}
Career Goal: ${student.career_goal_id}
Technical Proficiency: ${student.technical_proficiency}
Preferred Subjects: ${student.preferred_subjects.join(', ')}
Preferred Learning Mode: ${student.preferred_learning_mode}
Course Slot Preference: ${student.course_slot_preference}
Current Courses: ${student.current_courses_taken.join(', ')}
Credits Completed: ${student.credits_completed}

Available courses: ${courses.map(c => `${c.title} (${c.subject}, ${c.credits} credits)`).join(', ')}` : 
          'You are a helpful course recommendation assistant. Please help the user with course recommendations.',
          timestamp: new Date()
        }]);
      }
    }
  }, [student?.id, student, courses]);

  // Save chat history when messages change
  useEffect(() => {
    if (student?.id && messages.length > 0) {
      chatStorage.save(student.id, messages);
    }
  }, [messages, student?.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    // Validate API key
    if (!API_CONFIG.key) {
      console.error('Missing Gemini API key. Please set NEXT_PUBLIC_GEMINI_API_KEY in your environment variables.');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I apologize, but I am not properly configured. Please contact the administrator to set up the API key.',
        timestamp: new Date()
      }]);
      return;
    }

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch(`${API_CONFIG.url}/${API_CONFIG.model}:generateContent?key=${API_CONFIG.key}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a helpful course recommendation assistant. Continue the conversation and provide helpful responses.

Previous conversation:
${conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n')}

User's latest question: ${input}

Please:
1. Provide a natural, conversational response
2. Consider the student's profile and preferences
3. If recommending courses, include their IDs in a JSON array like this: {"recommendedCourses": [1, 2, 3]}
4. If updating preferences, include them in a JSON object like this: {"userPreferences": {"subjects": ["CS", "Math"], "difficulty": "intermediate"}}
5. Keep the response concise but informative
✅ Response Guidelines:
1.⁠ ⁠Always address the student's specific question directly.
2.⁠ ⁠When discussing courses, reference specific courses from the catalog by name.
3.⁠ ⁠When making recommendations, explain why those specific courses are suitable based on the student's profile.
4.⁠ ⁠Consider prerequisites when suggesting courses - check if the student has completed necessary prerequisites.
5.⁠ ⁠Make full use of the complete course catalog data to find the best matches.
6.⁠ ⁠If the student is asking about a specific course, provide detailed information about that course.
7.⁠ ⁠Be helpful, conversational, and provide personalized guidance based on ALL available data.
8.⁠ ⁠If the student is asking about a course that is not in the catalog, say that it is not in the catalog.
`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 1000
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null) as APIError | null;
        console.error('API Error:', errorData);
        throw new Error(errorData?.error?.message || 'Failed to get response from assistant');
      }

      const data = await response.json();
      
      if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Invalid response format from API');
      }

      const { content, metadata } = parseLLMResponse(data.candidates[0].content.parts[0].text);

      const assistantMessage: Message = {
        role: 'assistant',
        content,
        timestamp: new Date(),
        metadata
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Update recommendations and preferences if present
      if (metadata?.recommendedCourses && onRecommendationsUpdate) {
        onRecommendationsUpdate(metadata.recommendedCourses);
      }
      if (metadata?.userPreferences && onPreferencesUpdate) {
        onPreferencesUpdate(metadata.userPreferences);
      }

    } catch (error: unknown) {
      console.error('Error getting assistant response:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `I apologize, but I encountered an error: ${errorMessage}. Please try again or contact support if the issue persists.`,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetChat = () => {
    if (window.confirm('Are you sure you want to reset the chat? This will clear all messages.')) {
      if (student?.id) {
        localStorage.removeItem(chatStorage.getKey(student.id));
      }
      setMessages([{
        role: 'system',
        content: student ? `You are a helpful course recommendation assistant. The student's profile is:
Name: ${student.full_name}
Career Goal: ${student.career_goal_id}
Technical Proficiency: ${student.technical_proficiency}
Preferred Subjects: ${student.preferred_subjects.join(', ')}
Preferred Learning Mode: ${student.preferred_learning_mode}
Course Slot Preference: ${student.course_slot_preference}
Current Courses: ${student.current_courses_taken.join(', ')}
Credits Completed: ${student.credits_completed}

Available courses: ${courses.map(c => `${c.title} (${c.subject}, ${c.credits} credits)`).join(', ')}` : 
        'You are a helpful course recommendation assistant. Please help the user with course recommendations.',
        timestamp: new Date()
      }]);
    }
  };

  return (
    <Card className="h-full flex flex-col bg-white dark:bg-black rounded-lg overflow-hidden border-0">
      {/* Header with AI Profile */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-black dark:bg-white rounded-full flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-white dark:text-black" />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-black dark:text-white">Course Assistant</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Your AI Copilot</p>
              </div>
              <button
                onClick={handleResetChat}
                className="text-gray-500 hover:text-black dark:hover:text-white p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Reset Chat"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Tasks Section */}
        <div className="mt-6">
          <h3 className="text-sm font-medium text-black dark:text-white mb-3">Tasks I can assist you with:</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Settings className="h-4 w-4" />
              <span>Adjust current preferences</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Star className="h-4 w-4" />
              <span>Find top matching courses</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <HelpCircle className="h-4 w-4" />
              <span>Get detailed course insights</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
        {messages.filter(m => m.role !== 'system').map((message, index) => (
          <div
            key={index}
            className={cn(
              "flex",
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                "max-w-[92%] rounded-lg p-4",
                message.role === 'user'
                  ? 'bg-black text-white rounded-br-none'
                  : 'bg-white dark:bg-gray-800 text-black dark:text-white rounded-bl-none shadow-sm'
              )}
            >
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{message.content}</p>
              {message.metadata?.recommendedCourses && (
                <div className="mt-3 pt-3 border-t border-gray-700 dark:border-gray-600">
                  <p className="text-sm font-medium mb-2">Recommended Courses:</p>
                  <div className="flex flex-wrap gap-2">
                    {message.metadata.recommendedCourses.map(courseId => {
                      const course = courses.find(c => c.id === courseId);
                      return course ? (
                        <span key={courseId} className="text-sm px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-black dark:text-white rounded-full">
                          {course.title}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
              <span className="text-xs opacity-70 mt-2 block">
                {message.timestamp.toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-black">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask me anything..."
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white bg-white dark:bg-gray-900 text-black dark:text-white"
          />
          <button
            onClick={handleSend}
            disabled={isLoading}
            className={cn(
              "bg-black dark:bg-white text-white dark:text-black rounded-lg px-5 py-3 hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 flex items-center gap-2 text-[15px] font-medium transition-colors",
              isLoading && "animate-pulse"
            )}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send
          </button>
        </div>
      </div>
    </Card>
  );
} 