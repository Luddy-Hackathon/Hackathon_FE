"use client";

import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Loader2, Settings, Star, HelpCircle, RefreshCw, Sparkles, CheckCircle, Share, BookText, X } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Course, Student } from '@/types';
import { cn } from "@/lib/utils";
import { useRecommendations, CourseRecommendation } from "@/context/RecommendationsContext";
import { Button } from "@/components/ui/button";

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

// Improve the parsing function to better extract course recommendations
function parseLLMResponse(text: string): { content: string; metadata?: Message['metadata'] } {
  try {
    // First, try to extract a complete JSON block (handles nested objects better)
    const fullJsonRegex = /\{(?:[^{}]|(?:\{(?:[^{}]|(?:\{[^{}]*\}))*\}))*\}/g;
    const jsonMatches = text.match(fullJsonRegex) || [];
    
    let cleanContent = text;
    let metadata: Message['metadata'] = {};
    let recommendedCourseIds: number[] = [];

    // First try to extract structured JSON metadata
    for (const jsonStr of jsonMatches) {
      try {
        const data = JSON.parse(jsonStr);
        
        // Extract course recommendations if present
        if (data.recommendedCourses && Array.isArray(data.recommendedCourses)) {
          // Ensure course IDs are numbers
          recommendedCourseIds = data.recommendedCourses.map((id: any) => {
            // If it's already a number, return it directly
            if (typeof id === 'number') return id;
            // If it's a string that looks like a number, convert it
            if (typeof id === 'string' && /^\d+$/.test(id)) return parseInt(id, 10);
            // Otherwise, just return the original value
            return id;
          });
          
          metadata.recommendedCourses = recommendedCourseIds;
          
          // Be careful not to remove this JSON if it's part of a code example
          if (!cleanContent.includes("```") || !cleanContent.includes(jsonStr + "```")) {
            cleanContent = cleanContent.replace(jsonStr, '');
          }
        }
        
        // Extract user preferences if present
        if (data.userPreferences) {
          metadata.userPreferences = data.userPreferences;
          cleanContent = cleanContent.replace(jsonStr, '');
        }
      } catch (e) {
        // Skip invalid JSON
        console.warn('Failed to parse JSON block:', jsonStr, e);
        continue;
      }
    }

    // Clean up the content - remove JSON syntax, quotes around course names, and course IDs
    cleanContent = cleanContent
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .replace(/"([^"]+)"/g, '$1') // Remove quotes around words
      .replace(/\[\d+\]/g, '')     // Remove IDs like [123]
      .replace(/course #\d+/gi, '') // Remove "course #123" references
      .replace(/\(id: \d+\)/gi, '') // Remove "(id: 123)" references
      .trim();

    console.log("Extracted metadata:", metadata);
    
    return { content: cleanContent, metadata };
  } catch (error) {
    console.error('Error parsing LLM response:', error);
    return { content: text };
  }
}

// A more precise function to match course names in text with their IDs
function extractCourseRecommendationsFromText(
  text: string, 
  availableCourses: Course[], 
  explicitCourseIds: number[] = []
): number[] {
  // If we have explicit course IDs from JSON metadata, use those first
  if (explicitCourseIds.length > 0) {
    return explicitCourseIds;
  }
  
  // Try to find exact course name matches
  const courseIds: number[] = [];
  const allCourseNames = availableCourses.map(c => c.title);
  
  // Sort course names by length (longest first) to avoid matching substrings
  const sortedCourseNames = [...allCourseNames].sort((a, b) => b.length - a.length);
  
  for (const courseName of sortedCourseNames) {
    // Check if the course name appears in the text (case insensitive)
    const regex = new RegExp(`\\b${courseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(text)) {
      const course = availableCourses.find(c => c.title === courseName);
      if (course) {
        courseIds.push(course.id);
      }
    }
  }
  
  // If we found exact matches, return those
  if (courseIds.length > 0) {
    return courseIds;
  }
  
  // Fallback to the previous method
  const courseTitles = text.match(/(?:"[^"]+"|[^,\s.]+)(?=\s*(?:,|\.|$))/g)
    ?.map(title => title.replace(/"/g, '').trim())
    ?.filter(title => 
      availableCourses.some(course => 
        course.title.toLowerCase().includes(title.toLowerCase()) ||
        title.toLowerCase().includes(course.title.toLowerCase())
      )
    ) || [];
    
  return findCourseIdsByTitles(courseTitles, availableCourses);
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

// Update function to match course titles to IDs more effectively
function findCourseIdsByTitles(courseTitles: string[], availableCourses: Course[]): number[] {
  const courseIds: number[] = [];
  
  // First, try exact matches
  for (const title of courseTitles) {
    const normalizedTitle = title.toLowerCase().trim();
    const course = availableCourses.find(c => 
      c.title.toLowerCase() === normalizedTitle
    );
    
    if (course) {
      courseIds.push(course.id);
      continue;
    }
    
    // If no exact match, try partial matches
    const partialMatch = availableCourses.find(c => 
      c.title.toLowerCase().includes(normalizedTitle) ||
      normalizedTitle.includes(c.title.toLowerCase())
    );
    
    if (partialMatch) {
      courseIds.push(partialMatch.id);
    }
  }
  
  return courseIds;
}

// Function to format course data for recommendations
function formatCourseForRecommendation(courseId: number, courses: Course[], reasons: string[] = []): CourseRecommendation | null {
  try {
    const course = courses.find(c => c.id === courseId);
    if (!course) {
      console.warn(`Course with ID ${courseId} not found`);
      return null;
    }
    
    return {
      course_id: course.id,
      title: course.title || `Course ${course.id}`,
      subject: course.subject || 'General',
      credits: course.credits || 3,
      match_score: 0.85, // This would ideally be calculated
      difficulty_level: course.difficulty_level || 'Intermediate',
      time_slot: course.time_slots || 'Flexible',
      reasons: reasons.length > 0 ? reasons : ['Recommended by AI assistant'],
      prerequisites: course.prerequisites || []
    };
  } catch (error) {
    console.error('Error formatting course for recommendation:', error);
    return null;
  }
}

// Course recommendation UI that appears after LLM response
const CourseRecommendationUI = ({ 
  courses, 
  onAddToDashboard 
}: { 
  courses: CourseRecommendation[],
  onAddToDashboard: (course: CourseRecommendation) => void 
}) => {
  if (!courses || courses.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3">
      <h3 className="text-lg font-semibold">Recommended Courses</h3>
      <div className="space-y-3">
        {courses.map((course, index) => (
          <div key={`${course.course_id}-${index}`} className="p-3 border rounded-lg bg-gray-50 dark:bg-gray-900">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-medium">{course.title}</h4>
                <p className="text-sm text-gray-500">{course.subject} • {course.credits} credits</p>
                <p className="text-sm">{formatTimeSlot(course.time_slot)}</p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onAddToDashboard(course)}
              >
                Add to Dashboard
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Fix the formatTimeSlot function to handle non-string inputs
const formatTimeSlot = (timeSlot: any): string => {
  const dayMap: Record<string, string> = {
    'M': 'Monday',
    'T': 'Tuesday',
    'W': 'Wednesday',
    'R': 'Thursday',
    'F': 'Friday',
    'S': 'Saturday',
    'U': 'Sunday',
  };
  
  // Handle null, undefined or non-string values
  if (!timeSlot) return 'Flexible';
  
  // Convert timeSlot to string if it's not already
  const timeSlotStr = String(timeSlot);
  
  // Try to parse JSON if it looks like an object
  if (typeof timeSlot === 'object') {
    try {
      // If it's an object with days and time properties
      if (timeSlot.days && timeSlot.time) {
        const days = timeSlot.days.split('').map((day: string) => dayMap[day] || day).join(', ');
        return `${days} ${timeSlot.time}`;
      }
    } catch (e) {
      console.error('Error formatting time slot object:', e);
    }
  }
  
  // Parse time slot format like "MWF 10:00-11:15"
  try {
    const parts = timeSlotStr.split(' ');
    if (parts.length !== 2) return timeSlotStr;
    
    const days = parts[0].split('').map(day => dayMap[day] || day).join(', ');
    return `${days} ${parts[1]}`;
  } catch (e) {
    console.error('Error formatting time slot:', e);
    return String(timeSlot) || 'Flexible';
  }
};

// Remove the Dialog import and create a simpler internal implementation
// Swap confirmation dialog using a simpler implementation
const SimpleDialog = ({ 
  isOpen,
  onClose,
  title,
  description,
  children,
  footer
}: { 
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full mx-4 p-6 shadow-xl">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mb-6">{children}</div>
        {footer && <div className="flex justify-end">{footer}</div>}
      </div>
    </div>
  );
};

// Update the swap confirmation dialog
const SwapConfirmationDialog = ({ 
  course, 
  dashboardCourses,
  onConfirm,
  onCancel
}: { 
  course: CourseRecommendation, 
  dashboardCourses: CourseRecommendation[],
  onConfirm: (oldCourseId: number) => void,
  onCancel: () => void
}) => {
  return (
    <SimpleDialog
      isOpen={true}
      onClose={onCancel}
      title="Replace a Course"
      description="You already have 3 courses in your dashboard. Please select which course to replace."
      footer={
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      }
    >
      <div className="space-y-3">
        {dashboardCourses.map((rec, index) => (
          <div key={`${rec.course_id}-${index}`} className="p-3 border rounded-lg flex justify-between items-center">
            <div>
              <h4 className="font-medium">{rec.title}</h4>
              <p className="text-sm text-gray-500">{rec.subject} • {rec.credits} credits</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => onConfirm(rec.course_id)}>
              Replace
            </Button>
          </div>
        ))}
      </div>
    </SimpleDialog>
  );
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
  const [recommendedCourseIds, setRecommendedCourseIds] = useState<Set<number>>(new Set());
  const [appliedRecommendations, setAppliedRecommendations] = useState<Set<number>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { recommendations, setRecommendations, updateRecommendations, setUpdateRecommendations, applyUpdateRecommendations, courses: contextCourses } = useRecommendations();
  const [showSwapDialog, setShowSwapDialog] = useState(false);
  const [courseToAdd, setCourseToAdd] = useState<CourseRecommendation | null>(null);

  // Track recommended courses when messages change
  useEffect(() => {
    const courseIds = new Set<number>();
    messages.forEach(message => {
      if (message.metadata?.recommendedCourses) {
        message.metadata.recommendedCourses.forEach(id => courseIds.add(id));
      }
    });
    setRecommendedCourseIds(courseIds);
  }, [messages]);

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

      // Get previously recommended courses with titles
      const previouslyRecommended = Array.from(recommendedCourseIds).map(id => {
        const course = courses.find(c => c.id === id);
        return course ? course.title : null;
      }).filter(Boolean);

      const response = await fetch(`${API_CONFIG.url}/${API_CONFIG.model}:generateContent?key=${API_CONFIG.key}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a helpful course recommendation assistant. Provide clear, focused responses.

Previous conversation:
${conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n')}

Previously recommended courses: ${previouslyRecommended.length > 0 ? previouslyRecommended.join(', ') : 'None'}

Available courses with IDs: 
${courses.map(c => `${c.title} (ID: ${c.id})`).join(', ')}

User's latest question: ${input}

STRICT Response Guidelines:
1. Keep responses CONCISE but INFORMATIVE:
   - 3-4 sentences maximum
   - Clear, direct language
   - Include brief explanations for recommendations

2. When recommending courses:
   - Suggest 1-2 NEW courses not previously recommended
   - Explain WHY each course is recommended in one brief sentence
   - DO NOT include ANY course IDs or numbers in the response text
   - Use EXACTLY the same course title as shown in the available courses list, with no alterations
   - ALWAYS include course IDs in the JSON metadata block

3. Response structure:
   - Brief answer to the question
   - Course recommendations with brief explanations
   - ALWAYS include a JSON metadata block with recommended course IDs

4. CRITICAL: For any courses you recommend, you MUST:
   - Include their EXACT IDs in a JSON block: {"recommendedCourses": [course_ids_here]}
   - Use the EXACT same course name in your text response as listed in the available courses
   - Example: If recommending "Introduction to Python Programming", use EXACTLY that title in both your text and the metadata

5. Format for preferences:
   {"userPreferences": {"subjects": [], "difficulty": ""}}

6. NEVER mention course numbers, IDs, or use quotes around course names in your visible response
7. Do NOT use phrases like "Course #123" or "(ID: 456)" - just use the course title

Example response:
"Based on your interest in web development, I recommend Introduction to React. This course will teach you modern frontend development skills essential for your career goal. The course fits well with your current technical proficiency level."
{"recommendedCourses": [123]}`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 400
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

      // Extract course recommendations from both metadata and text
      const metadataCourseIds = metadata?.recommendedCourses || [];
      const extractedCoursesFromText = extractCourseRecommendationsFromText(content, courses, metadataCourseIds);

      // Use extracted course IDs for the assistant message
      const assistantMessage: Message = {
        role: 'assistant',
        content,
        timestamp: new Date(),
        metadata: {
          ...metadata,
          recommendedCourses: extractedCoursesFromText
        }
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Format and update recommendations
      if (extractedCoursesFromText.length > 0) {
        // Format recommended courses
        const formattedRecommendations = extractedCoursesFromText
          .map(id => formatCourseForRecommendation(id, courses))
          .filter((course): course is CourseRecommendation => course !== null);
        
        // Update the recommendations in context
        if (formattedRecommendations.length > 0) {
          setUpdateRecommendations(formattedRecommendations);
        }

        // Call the callback if provided
        const newRecommendations = extractedCoursesFromText
          .filter(id => !Array.from(recommendedCourseIds).includes(id));
        
        if (newRecommendations.length > 0 && onRecommendationsUpdate) {
          onRecommendationsUpdate(newRecommendations);
        }
      }

      // Update preferences if present
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

  const handleGenerateRecommendations = async () => {
    if (!student || !courses.length) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_CONFIG.url}/${API_CONFIG.model}:generateContent?key=${API_CONFIG.key}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a helpful course recommendation assistant. Generate new course recommendations based on the student's profile and conversation history.

Student Profile:
Name: ${student.full_name}
Career Goal: ${student.career_goal_id}
Technical Proficiency: ${student.technical_proficiency}
Preferred Subjects: ${student.preferred_subjects.join(', ')}
Preferred Learning Mode: ${student.preferred_learning_mode}
Course Slot Preference: ${student.course_slot_preference}
Current Courses: ${student.current_courses_taken.join(', ')}
Credits Completed: ${student.credits_completed}

Conversation History:
${messages.map(m => `${m.role}: ${m.content}`).join('\n')}

Previously Recommended Courses: ${Array.from(recommendedCourseIds).map(id => {
  const course = courses.find(c => c.id === id);
  return course ? course.title : null;
}).filter(Boolean).join(', ') || 'None'}

Available courses with IDs: 
${courses.map(c => `${c.title} (ID: ${c.id})`).join(', ')}

Generate new course recommendations based on the above information. Focus on courses that:
1. Align with the student's career goals and interests
2. Match their technical proficiency level
3. Fit their preferred learning mode and time slots
4. Haven't been recommended before

STRICT Response Guidelines:
1. Keep responses CONCISE but INFORMATIVE:
   - 3-4 sentences maximum
   - Clear, direct language
   - Include brief explanations for recommendations

2. When recommending courses:
   - Suggest 1-2 NEW courses not previously recommended
   - Explain WHY each course is recommended in one brief sentence
   - DO NOT include ANY course IDs or numbers in the response text
   - Use EXACTLY the same course title as shown in the available courses list, with no alterations
   - ALWAYS include course IDs in the JSON metadata block

3. Response structure:
   - Brief answer to the question
   - Course recommendations with brief explanations
   - ALWAYS include a JSON metadata block with recommended course IDs

4. CRITICAL: For any courses you recommend, you MUST:
   - Include their EXACT IDs in a JSON block: {"recommendedCourses": [course_ids_here]}
   - Use the EXACT same course name in your text response as listed in the available courses
   - Example: If recommending "Introduction to Python Programming", use EXACTLY that title in both your text and the metadata

5. Format for preferences:
   {"userPreferences": {"subjects": [], "difficulty": ""}}

6. NEVER mention course numbers, IDs, or use quotes around course names in your visible response
7. Do NOT use phrases like "Course #123" or "(ID: 456)" - just use the course title

Example response:
"Based on your interest in web development, I recommend Introduction to React. This course will teach you modern frontend development skills essential for your career goal. The course fits well with your current technical proficiency level."
{"recommendedCourses": [123]}`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 400
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate recommendations');
      }

      const data = await response.json();
      const { content, metadata } = parseLLMResponse(data.candidates[0].content.parts[0].text);

      // Extract course recommendations from both metadata and text
      const metadataCourseIds = metadata?.recommendedCourses || [];
      const extractedCoursesFromText = extractCourseRecommendationsFromText(content, courses, metadataCourseIds);

      // Log for debugging
      console.log('Recommended courses:', extractedCoursesFromText);

      // Update recommendations in dashboard
      if (extractedCoursesFromText.length > 0) {
        // Format recommended courses
        const formattedRecommendations = extractedCoursesFromText
          .map(id => formatCourseForRecommendation(
            id, 
            courses, 
            ['Generated based on your profile and preferences']
          ))
          .filter((course): course is CourseRecommendation => course !== null);
        
        // Update the recommendations in context
        if (formattedRecommendations.length > 0) {
          setUpdateRecommendations(formattedRecommendations);
        }

        // Call the callback if provided
        const newRecommendations = extractedCoursesFromText
          .filter(id => !Array.from(recommendedCourseIds).includes(id));
        
        if (newRecommendations.length > 0 && onRecommendationsUpdate) {
          onRecommendationsUpdate(newRecommendations);
        }
      }

      // Add the generated recommendations to the chat
      const assistantMessage: Message = {
        role: 'assistant',
        content: `I've generated new course recommendations based on your profile and our conversation:\n\n${content}`,
        timestamp: new Date(),
        metadata: {
          recommendedCourses: extractedCoursesFromText
        }
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Error generating recommendations:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I apologize, but I encountered an error while generating recommendations. Please try again.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyRecommendations = (message: Message) => {
    if (!message.metadata?.recommendedCourses || !onRecommendationsUpdate) return;

    const newRecommendations = message.metadata.recommendedCourses
      .filter(id => !appliedRecommendations.has(id));

    if (newRecommendations.length > 0) {
      onRecommendationsUpdate(newRecommendations);
      setAppliedRecommendations(prev => new Set([...prev, ...newRecommendations]));
      
      // Add a confirmation message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I\'ve added these courses to your dashboard recommendations.',
        timestamp: new Date()
      }]);
    }
  };

  const handleApplyRecommendationsToProfile = () => {
    if (updateRecommendations && updateRecommendations.length > 0) {
      applyUpdateRecommendations();
    }
  };

  const handleAddToDashboard = (course: CourseRecommendation) => {
    // Check if we already have 3 recommendations
    if (recommendations.length < 3) {
      // Create a new recommendations array by adding the new course
      const newRecommendations = [...recommendations, course];
      
      // Update recommendations directly - this will trigger the 
      // save to localStorage in RecommendationsContext
      setRecommendations(newRecommendations);
      
      // Also update the updateRecommendations state to keep everything in sync
      setUpdateRecommendations(newRecommendations);
      
      console.log('Course added to dashboard:', course.title);
      
      // Add confirmation message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `I've added ${course.title} to your dashboard.`,
        timestamp: new Date()
      }]);
    } else {
      // If we already have 3, show swap dialog
      setCourseToAdd(course);
      setShowSwapDialog(true);
    }
  };

  const handleConfirmSwap = (oldCourseId: number) => {
    if (!courseToAdd) return;
    
    // Close the dialog
    setShowSwapDialog(false);
    
    // Create the updated recommendations list
    const newRecommendations = [...recommendations];
    const indexToReplace = recommendations.findIndex(c => c.course_id === oldCourseId);
    if (indexToReplace !== -1) {
      // Replace the old course with the new one
      newRecommendations[indexToReplace] = courseToAdd;
      
      // Update recommendations directly - this will trigger the 
      // save to localStorage in RecommendationsContext
      setRecommendations(newRecommendations);
      
      // Also update the updateRecommendations state to keep everything in sync
      setUpdateRecommendations(newRecommendations);
      
      console.log('Course swapped in dashboard:', courseToAdd.title);
      
      // Add a confirmation message to the chat
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `I've replaced ${recommendations.find(r => r.course_id === oldCourseId)?.title} with ${courseToAdd.title} in your dashboard.`,
        timestamp: new Date()
      }]);
    } else {
      console.error('Could not find course to replace in recommendations');
    }
    
    // Reset state
    setCourseToAdd(null);
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
              <div className="flex gap-2">
                <button
                  onClick={handleGenerateRecommendations}
                  disabled={isLoading}
                  className="text-gray-500 hover:text-black dark:hover:text-white p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  title="Generate Recommendations"
                >
                  <Sparkles className="h-5 w-5" />
                </button>
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

        {/* Previously Recommended Courses */}
        {/* {recommendedCourseIds.size > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-black dark:text-white mb-2">Previously Recommended:</h3>
            <div className="flex flex-wrap gap-2">
              {Array.from(recommendedCourseIds).map(courseId => {
                const course = courses.find(c => c.id === courseId);
                return course ? (
                  <span 
                    key={courseId}
                    className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full"
                  >
                    {course.title}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        )} */}
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
              
              {message.role === 'assistant' && message.metadata?.recommendedCourses && Array.isArray(message.metadata.recommendedCourses) && message.metadata.recommendedCourses.length > 0 && (
                <CourseRecommendationUI
                  courses={message.metadata.recommendedCourses.map((id, idx) => {
                    const course = courses.find(c => c.id === id);
                    if (!course) {
                      console.warn(`Course with ID ${id} not found in courses array`);
                      return null;
                    }
                    return {
                      course_id: id,
                      title: course.title,
                      subject: course.subject || 'General',
                      credits: course.credits,
                      match_score: 0.8,
                      difficulty_level: course.difficulty_level || 'Intermediate',
                      time_slot: course.time_slots || 'Flexible',
                      reasons: ['Recommended by AI Assistant'],
                      prerequisites: course.prerequisites || []
                    };
                  }).filter(Boolean) as CourseRecommendation[]}
                  onAddToDashboard={handleAddToDashboard}
                />
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

      {showSwapDialog && courseToAdd && (
        <SwapConfirmationDialog
          course={courseToAdd}
          dashboardCourses={recommendations}
          onConfirm={handleConfirmSwap}
          onCancel={() => {
            setShowSwapDialog(false);
            setCourseToAdd(null);
          }}
        />
      )}
    </Card>
  );
} 