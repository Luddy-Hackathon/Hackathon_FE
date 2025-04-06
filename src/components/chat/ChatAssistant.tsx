"use client";

import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Loader2, Settings, Star, HelpCircle, Trash, Sparkles, CheckCircle, Share, BookText, X } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Course, Student } from '@/types';
import { cn } from "@/lib/utils";
import { useRecommendations, CourseRecommendation } from "@/context/RecommendationsContext";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { getCourseAvailabilityData } from "@/lib/courseAvailability";
import { useAuth } from "@/components/auth/AuthProvider";
import { BookOpenIcon, AcademicCapIcon, ChartBarIcon, ClockIcon } from '@heroicons/react/24/outline';
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";

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

// Update the parseLLMResponse function to better clean up LLM responses
function parseLLMResponse(text: string): { content: string; metadata?: Message['metadata'] } {
  try {
    // First, remove markdown code blocks that are empty or only contain whitespace
    text = text.replace(/```(json)?\s*```/g, '');
    
    // Then extract complete JSON blocks
    const fullJsonRegex = /\{(?:[^{}]|(?:\{(?:[^{}]|(?:\{[^{}]*\}))*\}))*\}/g;
    const jsonMatches = text.match(fullJsonRegex) || [];
    
    let cleanContent = text;
    let metadata: Message['metadata'] = {};
    let recommendedCourseIds: number[] = [];

    // Process each JSON block found in the text
    for (const jsonStr of jsonMatches) {
      try {
        const data = JSON.parse(jsonStr);
        let shouldRemoveJson = false;
        
        // Extract course recommendations if present
        if (data.recommendedCourses && Array.isArray(data.recommendedCourses)) {
          // Ensure course IDs are numbers
          recommendedCourseIds = data.recommendedCourses.map((id: any) => {
            if (typeof id === 'number') return id;
            if (typeof id === 'string' && /^\d+$/.test(id)) return parseInt(id, 10);
            return id;
          });
          
          metadata.recommendedCourses = recommendedCourseIds;
          metadata.isRecommending = true;
          shouldRemoveJson = true;
        }
        
        // Extract user preferences if present
        if (data.userPreferences) {
          metadata.userPreferences = data.userPreferences;
          shouldRemoveJson = true;
        }

        // Check if the response explicitly states it's a recommendation
        if (data.isRecommending !== undefined) {
          metadata.isRecommending = data.isRecommending;
          shouldRemoveJson = true;
        }
        
        // Remove the JSON from the content if it's not part of a code example
        if (shouldRemoveJson) {
          // Only remove if not inside code blocks
          if (!cleanContent.includes("```") || !cleanContent.includes(jsonStr + "```")) {
          cleanContent = cleanContent.replace(jsonStr, '');
          }
        }
      } catch (e) {
        // Skip invalid JSON
        console.warn('Failed to parse JSON block:', jsonStr, e);
      }
    }

    // Clean up the content
    // 1. Remove markdown code blocks with json
    cleanContent = cleanContent.replace(/```json[\s\S]*?```/g, '');
    
    // 2. Remove empty markdown code blocks
    cleanContent = cleanContent.replace(/```\s*```/g, '');
    
    // 3. Remove quotes at beginning/end
    cleanContent = cleanContent.trim();
    if ((cleanContent.startsWith('"') && cleanContent.endsWith('"')) || 
        (cleanContent.startsWith("'") && cleanContent.endsWith("'"))) {
      cleanContent = cleanContent.slice(1, -1);
    }
    
    // 4. Remove any JSON-like fragments
    cleanContent = cleanContent.replace(/\{\s*".*?"\s*:\s*.*?\}/g, '');
    cleanContent = cleanContent.replace(/\{\s*"isRecommending"\s*:\s*(true|false)\s*\}/g, '');
    
    // 5. Remove any trailing JSON format indicators like just "json" text
    cleanContent = cleanContent.replace(/\s*json\s*$/i, '');
    
    // 6. Clean up any triple backticks without content
    cleanContent = cleanContent.replace(/```\s*$/g, '');
    cleanContent = cleanContent.replace(/^\s*```/g, '');
    
    // 7. Final cleanup of multiple spaces and newlines
    cleanContent = cleanContent.replace(/\n{3,}/g, '\n\n');
    cleanContent = cleanContent.replace(/\s{2,}/g, ' ').trim();

    return { content: cleanContent, metadata };
  } catch (e) {
    console.error('Error parsing LLM response:', e);
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

// Type definition of Message
type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  status: string;
  metadata?: {
    recommendedCourses?: number[];
    recommendations?: CourseRecommendation[];
    userPreferences?: {
      subjects?: string[];
      difficulty?: string;
      timeSlots?: string[];
    };
    isRecommending?: boolean;
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
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recommended Courses</h3>
      <div className="space-y-4">
        {courses.map((course, index) => (
          <div 
            key={`${course.course_id}-${index}`} 
            className="p-2 border rounded-lg bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all duration-200"
          >
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">{course.title}</h4>
                <div className="flex items-center gap-1 mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                  <span>{course.subject || 'General'}</span>
                  <span>•</span>
                  <span>{course.difficulty_level || 'Intermediate'}</span>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onAddToDashboard(course)}
                className="ml-auto flex-shrink-0 h-6 text-[10px] px-2 py-0"
              >
                Add
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
  const { user } = useAuth();
  const [showTasks, setShowTasks] = useState(true);

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
          id: 'system',
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
          timestamp: new Date(),
          status: 'complete'
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
        id: 'assistant',
        role: 'assistant',
        content: 'I apologize, but I am not properly configured. Please contact the administrator to set up the API key.',
        timestamp: new Date(),
        status: 'complete'
      }]);
      return;
    }

    const userMessage: Message = {
      id: 'user',
      role: 'user',
      content: input,
      timestamp: new Date(),
      status: 'complete'
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Check for low occupancy request
    if (input.toLowerCase().includes('low occupancy') || 
        input.toLowerCase().includes('less crowded') ||
        input.toLowerCase().includes('available slots') ||
        input.toLowerCase().includes('easy to get') ||
        input.toLowerCase().includes('not full')) {
      
      await handleLowOccupancyRequest();
      setIsLoading(false);
      return;
    }
    
    // Check for difficulty-related queries
    if (input.toLowerCase().includes('beginner') || 
        input.toLowerCase().includes('intermediate') ||
        input.toLowerCase().includes('advanced') ||
        input.toLowerCase().includes('expert') ||
        input.toLowerCase().includes('easy course') ||
        input.toLowerCase().includes('hard course') ||
        input.toLowerCase().includes('difficult course') ||
        input.toLowerCase().includes('challenging')) {
      
      await handleDifficultyRequest(input);
      setIsLoading(false);
      return;
    }

    try {
      // Use the existing sendMessageToLLM function
      await sendMessageToLLM(input, messages);
    } catch (error) {
      console.error('Error sending message to LLM:', error);
      
      setMessages(prev => [...prev, {
        id: 'assistant',
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
        status: 'complete'
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
        id: 'system',
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
        timestamp: new Date(),
        status: 'complete'
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

Available courses with complete details: 
${JSON.stringify(courses.map(course => ({
  id: course.id,
  title: course.title,
  subject: course.subject,
  credits: course.credits,
  difficulty_level: course.difficulty_level,
  time_slots: course.time_slots,
  prerequisites: course.prerequisites,
  career_paths: course.career_paths,
  technical_level: course.technical_level,
  description: course.description,
  hours_required: course.hours_required
})), null, 2)}

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
        id: 'assistant',
        role: 'assistant',
        content: `I've generated new course recommendations based on your profile and our conversation:\n\n${content}`,
        timestamp: new Date(),
        status: 'complete',
        metadata: {
          recommendedCourses: extractedCoursesFromText
        }
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Error generating recommendations:', error);
      setMessages(prev => [...prev, {
        id: 'assistant',
        role: 'assistant',
        content: 'I apologize, but I encountered an error while generating recommendations. Please try again.',
        timestamp: new Date(),
        status: 'complete'
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
        id: 'assistant',
        role: 'assistant',
        content: 'I\'ve added these courses to your dashboard recommendations.',
        timestamp: new Date(),
        status: 'complete'
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
      
      // Apply the updates directly with the new recommendations array
      // This ensures immediate update without timing issues
      applyUpdateRecommendations(newRecommendations);
      
      console.log('Course added to dashboard:', course.title);
      
      // Add confirmation message
      setMessages(prev => [...prev, {
        id: 'assistant',
        role: 'assistant',
        content: `I've added ${course.title} to your dashboard.`,
        timestamp: new Date(),
        status: 'complete'
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
      
      // Apply the updates directly with the new recommendations array
      // This ensures immediate update without timing issues
      applyUpdateRecommendations(newRecommendations);
      
      console.log('Course swapped in dashboard:', courseToAdd.title);
      
      // Add a confirmation message to the chat
      setMessages(prev => [...prev, {
        id: 'assistant',
        role: 'assistant',
        content: `I've replaced ${recommendations.find(r => r.course_id === oldCourseId)?.title} with ${courseToAdd.title} in your dashboard.`,
        timestamp: new Date(),
        status: 'complete'
      }]);
    } else {
      console.error('Could not find course to replace in recommendations');
    }
    
    // Reset state
    setCourseToAdd(null);
  };

  // Function to handle low occupancy course requests
  const handleLowOccupancyRequest = async () => {
    // Add loading message
    const loadingMessage: Message = {
      id: 'assistant',
      role: 'assistant',
      content: 'I can help you find courses with low occupancy. Let me search for those options...',
      timestamp: new Date(),
      status: 'complete'
    };
    
    setMessages(prev => [...prev, loadingMessage]);
    
    try {
      // Get all courses
      const { data: coursesData, error: coursesError } = await supabase.from('courses').select('*');
      if (coursesError) throw coursesError;
      
      // Get student data
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', user?.id)
        .single();
      if (studentError) throw studentError;
      
      // Get availability data
      const availabilityScores = await getCourseAvailabilityData(coursesData.map(c => c.id));
      
      // Add availability scores and determine difficulty levels
      const enhancedCourses = coursesData.map(course => {
        // Get availability score (default to 0.5 if not found)
        const availScore = availabilityScores[course.id] || 0.5;
        
        // Determine difficulty level based on hours_required if available
        let difficultyLevel = course.difficulty_level || 'Intermediate';
        if ('hours_required' in course && typeof course.hours_required === 'number') {
          if (course.hours_required < 4) {
            difficultyLevel = 'Beginner';
          } else if (course.hours_required >= 4 && course.hours_required < 8) {
            difficultyLevel = 'Intermediate';
          } else if (course.hours_required >= 8 && course.hours_required < 12) {
            difficultyLevel = 'Advanced';
          } else {
            difficultyLevel = 'Expert';
          }
        }
        
        let occupancyDescription = "high occupancy";
        if (availScore <= 0.3) {
          occupancyDescription = "very low occupancy";
        } else if (availScore <= 0.5) {
          occupancyDescription = "low occupancy";
        } else if (availScore <= 0.7) {
          occupancyDescription = "medium occupancy";
        }
        
        // Create a comprehensive list of technologies and skills likely covered in the course
        // This will help the model match user queries about specific technologies
        const technicalSkills = [];
        
        // Add skills based on subject area
        if (course.subject === 'Programming') {
          technicalSkills.push('programming fundamentals', 'algorithms', 'data structures');
        } else if (course.subject === 'Web Development') {
          technicalSkills.push('HTML', 'CSS', 'JavaScript', 'web frameworks', 'responsive design');
        } else if (course.subject === 'Database') {
          technicalSkills.push('SQL', 'database design', 'data modeling', 'query optimization');
        } else if (course.subject === 'Computer Science') {
          technicalSkills.push('algorithms', 'data structures', 'discrete mathematics', 'computational theory');
        } else if (course.subject === 'Data Science') {
          technicalSkills.push('Python', 'R', 'statistical analysis', 'data visualization', 'machine learning');
        } else if (course.subject === 'Artificial Intelligence') {
          technicalSkills.push('machine learning', 'neural networks', 'NLP', 'computer vision', 'TensorFlow', 'PyTorch');
        } else if (course.subject === 'Mobile Development') {
          technicalSkills.push('iOS', 'Android', 'Swift', 'Kotlin', 'React Native', 'mobile UI design');
        } else if (course.subject === 'Cybersecurity') {
          technicalSkills.push('network security', 'encryption', 'ethical hacking', 'security principles');
        }
        
        // Add inferred skills from the title and prerequisites
        const titleLower = course.title.toLowerCase();
        if (titleLower.includes('java')) {
          technicalSkills.push('Java', 'object-oriented programming', 'Java frameworks');
        } else if (titleLower.includes('python')) {
          technicalSkills.push('Python', 'scripting', 'data analysis');
        } else if (titleLower.includes('javascript') || titleLower.includes('js')) {
          technicalSkills.push('JavaScript', 'ES6+', 'web development');
        } else if (titleLower.includes('react')) {
          technicalSkills.push('React', 'JavaScript', 'frontend development');
        } else if (titleLower.includes('node')) {
          technicalSkills.push('Node.js', 'JavaScript', 'backend development');
        } else if (titleLower.includes('data')) {
          technicalSkills.push('data analysis', 'SQL', 'statistics');
        } else if (titleLower.includes('cloud')) {
          technicalSkills.push('cloud computing', 'AWS', 'Azure', 'DevOps');
        } else if (titleLower.includes('object')) {
          technicalSkills.push('object-oriented programming', 'Java', 'C++', 'inheritance', 'polymorphism');
        }
        
        return {
          ...course,
          availability_score: availScore,
          difficulty_level: difficultyLevel,
          occupancy_percent: Math.round((1 - availScore) * 100),
          occupancy: `${Math.round((1 - availScore) * 100)}% (${occupancyDescription})`,
          description: course.description || `Course on ${course.subject || 'general topics'}.`,
          technical_skills: technicalSkills.length > 0 ? [...new Set(technicalSkills)] : undefined
        };
      });
      
      // Categorize courses by occupancy
      const veryLowOccupancy = enhancedCourses.filter(c => c.occupancy_percent <= 30);
      const lowOccupancy = enhancedCourses.filter(c => c.occupancy_percent > 30 && c.occupancy_percent <= 50);
      const mediumOccupancy = enhancedCourses.filter(c => c.occupancy_percent > 50 && c.occupancy_percent <= 70);
      
      // Prioritize student's preferred subjects
      const preferredSubjects = studentData.preferred_subjects || [];
      
      // Get candidates - prioritize low occupancy courses in preferred subjects
      let candidates = [
        ...veryLowOccupancy.filter(c => preferredSubjects.includes(c.subject)),
        ...veryLowOccupancy,
        ...lowOccupancy.filter(c => preferredSubjects.includes(c.subject)),
        ...lowOccupancy,
        ...mediumOccupancy.filter(c => preferredSubjects.includes(c.subject))
      ];
      
      // Remove duplicates
      candidates = Array.from(new Map(candidates.map(c => [c.id, c])).values());
      
      // Take top 5
      const topCandidates = candidates.slice(0, 5);
      
      // Format the courses as recommendations
      const recommendations = topCandidates.map(course => {
        const match = calculateMatchScore(course, studentData);
        
        // Generate detailed course-specific reasons if none provided
        let reasons = ['Recommended by AI Assistant'];
        if (course.subject) {
          reasons.push(`Covers key ${course.subject} concepts and skills`);
        }
        if (course.career_paths && Array.isArray(course.career_paths) && course.career_paths.length > 0) {
          reasons.push(`Relevant for ${course.career_paths[0]} career path`);
        }
        if ('hours_required' in course && typeof course.hours_required === 'number') {
          reasons.push(`Requires approximately ${course.hours_required} hours of work per week`);
        }
        
        return {
          course_id: course.id,
          title: course.title,
          subject: course.subject || 'General',
          credits: course.credits,
          match_score: match,
          difficulty_level: course.difficulty_level,
          time_slot: course.time_slots || 'Flexible',
          reasons,
          prerequisites: course.prerequisites || [],
          hours_required: ('hours_required' in course) ? course.hours_required : undefined,
          availability_score: course.availability_score,
          description: course.description || `Course on ${course.subject || 'general topics'}.`,
          technical_skills: course.technical_skills || []
        };
      });
      
      // Update the assistant message with results
      if (recommendations.length > 0) {
        const resultMessage: Message = {
          id: 'assistant',
          role: 'assistant',
          content: `I found ${recommendations.length} courses with good availability. These are sorted by occupancy rate, with preference given to your interests and career goals.`,
          timestamp: new Date(),
          status: 'complete',
          metadata: {
            recommendations
          }
        };
        
        // Replace the loading message with the results
        setMessages(prevMessages => [
          ...prevMessages.slice(0, -1),
          resultMessage
        ]);
      } else {
        // If no suitable courses found
        const noResultsMessage: Message = {
          id: 'assistant',
          role: 'assistant',
          content: "I couldn't find any courses with low occupancy rates at the moment. Would you like to see general course recommendations instead?",
          timestamp: new Date(),
          status: 'complete'
        };
        
        // Replace the loading message with no results
        setMessages(prevMessages => [
          ...prevMessages.slice(0, -1),
          noResultsMessage
        ]);
      }
    } catch (error) {
      console.error('Error finding low occupancy courses:', error);
      
      // Update with error message
      const errorMessage: Message = {
        id: 'assistant',
        role: 'assistant',
        content: "I'm having trouble finding course occupancy information at the moment. Please try again later or ask me for general course recommendations instead.",
        timestamp: new Date(),
        status: 'complete'
      };
      
      // Replace the loading message with the error
      setMessages(prevMessages => [
        ...prevMessages.slice(0, -1),
        errorMessage
      ]);
    }
  };
  
  // Calculate match score between course and student
  const calculateMatchScore = (course: any, student: any): number => {
    let score = 0.5; // Base score
    
    // Preferred subjects match
    if (student.preferred_subjects?.includes(course.subject)) {
      score += 0.2;
    }
    
    // Career path match
    if (course.career_paths?.includes(student.career_goal_id)) {
      score += 0.2;
    }
    
    // Availability bonus
    if (course.occupancy_percent <= 30) {
      score += 0.1;
    } else if (course.occupancy_percent <= 50) {
      score += 0.05;
    }
    
    // Cap at 0.95
    return Math.min(score, 0.95);
  };

  // Add a new function to handle difficulty-related queries
  const handleDifficultyRequest = async (query: string) => {
    // Determine which difficulty level is being requested
    let targetDifficulty: string | null = null;
    
    if (query.toLowerCase().includes('beginner') || query.toLowerCase().includes('easy course')) {
      targetDifficulty = 'Beginner';
    } else if (query.toLowerCase().includes('intermediate')) {
      targetDifficulty = 'Intermediate';
    } else if (query.toLowerCase().includes('advanced') || 
               query.toLowerCase().includes('hard course') || 
               query.toLowerCase().includes('difficult course')) {
      targetDifficulty = 'Advanced';
    } else if (query.toLowerCase().includes('expert') || query.toLowerCase().includes('challenging')) {
      targetDifficulty = 'Expert';
    }
    
    if (!targetDifficulty) {
      // If no specific difficulty was detected, fallback to the regular flow
      await sendMessageToLLM(query, messages);
      return;
    }
    
    // Add loading message
    const loadingMessage: Message = {
      id: 'assistant',
      role: 'assistant',
      content: `I'm finding ${targetDifficulty.toLowerCase()} level courses that match your profile...`,
      timestamp: new Date(),
      status: 'complete'
    };
    
    setMessages(prev => [...prev, loadingMessage]);
    
    try {
      // Get all courses
      const { data: coursesData, error: coursesError } = await supabase.from('courses').select('*');
      if (coursesError) throw coursesError;
      
      // Get student data
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', user?.id)
        .single();
      if (studentError) throw studentError;
      
      // Get availability data
      const availabilityScores = await getCourseAvailabilityData(coursesData.map(c => c.id));
      
      // Enhance courses with difficulty and availability data
      const enhancedCourses = coursesData.map(course => {
        // Get availability score (default to 0.5 if not found)
        const availScore = availabilityScores[course.id] || 0.5;
        
        // Determine difficulty level based on hours_required if available
        let difficultyLevel = course.difficulty_level || 'Intermediate';
        if ('hours_required' in course && typeof course.hours_required === 'number') {
          if (course.hours_required < 4) {
            difficultyLevel = 'Beginner';
          } else if (course.hours_required >= 4 && course.hours_required < 8) {
            difficultyLevel = 'Intermediate';
          } else if (course.hours_required >= 8 && course.hours_required < 12) {
            difficultyLevel = 'Advanced';
          } else {
            difficultyLevel = 'Expert';
          }
        }
        
        return {
          ...course,
          availability_score: availScore,
          difficulty_level: difficultyLevel,
          occupancy_percent: Math.round((1 - availScore) * 100)
        };
      });
      
      // Filter by target difficulty
      const matchingCourses = enhancedCourses.filter(c => c.difficulty_level === targetDifficulty);
      
      // Also consider student's preferred subjects
      const preferredSubjects = studentData.preferred_subjects || [];
      
      // Get candidates - prioritize preferred subjects
      let candidates = [
        ...matchingCourses.filter(c => preferredSubjects.includes(c.subject)),
        ...matchingCourses
      ];
      
      // Remove duplicates
      candidates = Array.from(new Map(candidates.map(c => [c.id, c])).values());
      
      // Sort by match score and take top 5
      candidates.sort((a, b) => calculateMatchScore(b, studentData) - calculateMatchScore(a, studentData));
      const topCandidates = candidates.slice(0, 5);
      
      // Format the courses as recommendations
      const recommendations = topCandidates.map(course => {
        const match = calculateMatchScore(course, studentData);
        
        // Generate detailed course-specific reasons if none provided
        let reasons = ['Recommended by AI Assistant'];
        if (course.subject) {
          reasons.push(`Covers key ${course.subject} concepts and skills`);
        }
        if (course.career_paths && Array.isArray(course.career_paths) && course.career_paths.length > 0) {
          reasons.push(`Relevant for ${course.career_paths[0]} career path`);
        }
        if ('hours_required' in course && typeof course.hours_required === 'number') {
          reasons.push(`Requires approximately ${course.hours_required} hours of work per week`);
        }
        
        return {
          course_id: course.id,
          title: course.title,
          subject: course.subject || 'General',
          credits: course.credits,
          match_score: match,
          difficulty_level: course.difficulty_level,
          time_slot: course.time_slots || 'Flexible',
          reasons,
          prerequisites: course.prerequisites || [],
          hours_required: ('hours_required' in course) ? course.hours_required : undefined,
          availability_score: course.availability_score
        };
      });
      
      // Update the assistant message with results
      if (recommendations.length > 0) {
        const resultMessage: Message = {
          id: 'assistant',
          role: 'assistant',
          content: `I found ${recommendations.length} ${targetDifficulty.toLowerCase()} level courses that might interest you. These are sorted by relevance to your profile and interests.`,
          timestamp: new Date(),
          status: 'complete',
          metadata: {
            recommendations
          }
        };
        
        // Replace the loading message with the results
        setMessages(prevMessages => [
          ...prevMessages.slice(0, -1),
          resultMessage
        ]);
      } else {
        // If no matching courses found
        const noResultsMessage: Message = {
          id: 'assistant',
          role: 'assistant',
          content: `I couldn't find any ${targetDifficulty.toLowerCase()} level courses at the moment. Would you like to see courses of a different difficulty level?`,
          timestamp: new Date(),
          status: 'complete'
        };
        
        // Replace the loading message with no results
        setMessages(prevMessages => [
          ...prevMessages.slice(0, -1),
          noResultsMessage
        ]);
      }
    } catch (error) {
      console.error('Error finding courses by difficulty:', error);
      
      // Update with error message
      const errorMessage: Message = {
        id: 'assistant',
        role: 'assistant',
        content: "I'm having trouble finding course information at the moment. Please try again later.",
        timestamp: new Date(),
        status: 'complete'
      };
      
      // Replace the loading message with the error
      setMessages(prevMessages => [
        ...prevMessages.slice(0, -1),
        errorMessage
      ]);
    }
  };

  // Update the sendMessageToLLM function to improve formatting guidance
  const sendMessageToLLM = async (userInput: string, currentMessages: Message[]) => {
    try {
      const conversationHistory = currentMessages.map(m => ({
        role: m.role,
        content: m.content
      }));

      // Get previously recommended courses with titles
      const previouslyRecommended = Array.from(recommendedCourseIds).map(id => {
        const course = courses.find(c => c.id === id);
        return course ? course.title : null;
      }).filter(Boolean);
      
      // Get availability data to enrich the prompt
      const availabilityScores = await getCourseAvailabilityData(courses.map(c => c.id));
      
      // Enrich course data with difficulty and occupancy information
      const enhancedCourses = courses.map(course => {
        // Get availability score (default to 0.5 if not found)
        const availScore = availabilityScores[course.id] || 0.5;
        const occupancyPercent = Math.round((1 - availScore) * 100);
        
        // Determine difficulty level based on hours_required if available
        let difficultyLevel = course.difficulty_level || 'Intermediate';
        if ('hours_required' in course && typeof course.hours_required === 'number') {
          if (course.hours_required < 4) {
            difficultyLevel = 'Beginner';
          } else if (course.hours_required >= 4 && course.hours_required < 8) {
            difficultyLevel = 'Intermediate';
          } else if (course.hours_required >= 8 && course.hours_required < 12) {
            difficultyLevel = 'Advanced';
          } else {
            difficultyLevel = 'Expert';
          }
        }
        
        let occupancyDescription = "high occupancy";
        if (occupancyPercent <= 30) {
          occupancyDescription = "very low occupancy";
        } else if (occupancyPercent <= 50) {
          occupancyDescription = "low occupancy";
        } else if (occupancyPercent <= 70) {
          occupancyDescription = "medium occupancy";
        }
        
        // Create a comprehensive list of technologies and skills likely covered in the course
        // This will help the model match user queries about specific technologies
        const technicalSkills = [];
        
        // Add skills based on subject area
        if (course.subject === 'Programming') {
          technicalSkills.push('programming fundamentals', 'algorithms', 'data structures');
        } else if (course.subject === 'Web Development') {
          technicalSkills.push('HTML', 'CSS', 'JavaScript', 'web frameworks', 'responsive design');
        } else if (course.subject === 'Database') {
          technicalSkills.push('SQL', 'database design', 'data modeling', 'query optimization');
        } else if (course.subject === 'Computer Science') {
          technicalSkills.push('algorithms', 'data structures', 'discrete mathematics', 'computational theory');
        } else if (course.subject === 'Data Science') {
          technicalSkills.push('Python', 'R', 'statistical analysis', 'data visualization', 'machine learning');
        } else if (course.subject === 'Artificial Intelligence') {
          technicalSkills.push('machine learning', 'neural networks', 'NLP', 'computer vision', 'TensorFlow', 'PyTorch');
        } else if (course.subject === 'Mobile Development') {
          technicalSkills.push('iOS', 'Android', 'Swift', 'Kotlin', 'React Native', 'mobile UI design');
        } else if (course.subject === 'Cybersecurity') {
          technicalSkills.push('network security', 'encryption', 'ethical hacking', 'security principles');
        }
        
        // Add inferred skills from the title and prerequisites
        const titleLower = course.title.toLowerCase();
        if (titleLower.includes('java')) {
          technicalSkills.push('Java', 'object-oriented programming', 'Java frameworks');
        } else if (titleLower.includes('python')) {
          technicalSkills.push('Python', 'scripting', 'data analysis');
        } else if (titleLower.includes('javascript') || titleLower.includes('js')) {
          technicalSkills.push('JavaScript', 'ES6+', 'web development');
        } else if (titleLower.includes('react')) {
          technicalSkills.push('React', 'JavaScript', 'frontend development');
        } else if (titleLower.includes('node')) {
          technicalSkills.push('Node.js', 'JavaScript', 'backend development');
        } else if (titleLower.includes('data')) {
          technicalSkills.push('data analysis', 'SQL', 'statistics');
        } else if (titleLower.includes('cloud')) {
          technicalSkills.push('cloud computing', 'AWS', 'Azure', 'DevOps');
        } else if (titleLower.includes('object')) {
          technicalSkills.push('object-oriented programming', 'Java', 'C++', 'inheritance', 'polymorphism');
        }
        
        return {
          id: course.id,
          title: course.title,
          subject: course.subject || 'General',
          credits: course.credits,
          difficulty: difficultyLevel,
          occupancy: `${occupancyPercent}% (${occupancyDescription})`,
          hours_per_week: 'hours_required' in course ? course.hours_required : 'varies',
          career_paths: course.career_paths || [],
          prerequisites: course.prerequisites || [],
          description: course.description || `Course on ${course.subject || 'general topics'}.`,
          technical_skills: technicalSkills.length > 0 ? [...new Set(technicalSkills)] : undefined,
          time_slot: course.time_slots || 'Flexible'
        };
      });
      
      // Detect if the query is about difficulty or occupancy
      const isDifficultyQuery = userInput.toLowerCase().includes('beginner') || 
                              userInput.toLowerCase().includes('intermediate') ||
                              userInput.toLowerCase().includes('advanced') ||
                              userInput.toLowerCase().includes('expert') ||
                              userInput.toLowerCase().includes('easy course') ||
                              userInput.toLowerCase().includes('hard course') ||
                              userInput.toLowerCase().includes('difficult') ||
                              userInput.toLowerCase().includes('challenging');
                              
      const isOccupancyQuery = userInput.toLowerCase().includes('low occupancy') || 
                             userInput.toLowerCase().includes('less crowded') ||
                             userInput.toLowerCase().includes('available slots') ||
                             userInput.toLowerCase().includes('easy to get') ||
                             userInput.toLowerCase().includes('not full');
      
      // Detect subject-specific queries by looking for technology/subject keywords
      const subjectKeywords = [
        'java', 'python', 'javascript', 'react', 'node', 'web', 'database', 'sql', 
        'machine learning', 'ai', 'artificial intelligence', 'data science', 'cybersecurity',
        'security', 'cloud', 'aws', 'azure', 'devops', 'mobile', 'ios', 'android',
        'c++', 'c#', 'ruby', 'php', 'html', 'css', 'swift', 'kotlin', 'blockchain',
        'programming', 'software', 'front-end', 'back-end', 'fullstack'
      ];
      
      const queryWords = userInput.toLowerCase().split(/\W+/);
      const detectedSubjects = subjectKeywords.filter(keyword => 
        userInput.toLowerCase().includes(keyword) || 
        queryWords.some(word => word === keyword.split(' ')[0])
      );
      
      const isSubjectQuery = detectedSubjects.length > 0;
      
      // Detect greeting or casual conversation
      const isGreeting = /^(hi|hello|hey|greetings|good (morning|afternoon|evening)|howdy)/i.test(userInput.trim());
      const isCasualQuestion = /(how are you|what'?s up|how'?s it going|how do you work)/i.test(userInput);
      
      // Add special instructions based on query type
      let specialInstructions = "";
      if (isDifficultyQuery) {
        specialInstructions = `
The user is asking about course difficulty. When responding:
- Focus on courses matching the difficulty level the user is interested in
- Explain why courses of that difficulty level would be beneficial for them
- Be brief and direct about hours required per week`;
      } else if (isOccupancyQuery) {
        specialInstructions = `
The user is asking about course occupancy/availability. When responding:
- Prioritize recommending courses with lower occupancy rates
- Be concise about occupancy percentages and their meaning
- Mention when registration timing is important`;
      } else if (isSubjectQuery) {
        const subjectList = detectedSubjects.join(', ');
        specialInstructions = `
The user is asking about courses related to ${subjectList}. When responding:
- Search course titles, descriptions, and prerequisites for relevant content
- Even if no courses have "${subjectList}" directly in the title, find courses that would teach these skills
- If looking for programming languages or technologies, find courses where these would be taught
- Be intelligent about related technologies (e.g. for Java, also consider courses teaching OOP concepts)
- Explain why each course is relevant to ${subjectList}
- ALWAYS suggest relevant courses even if they don't have the exact keyword in the title
- If no exact matches exist, suggest the closest alternatives that would help learn these skills`;
      } else if (isGreeting || isCasualQuestion) {
        specialInstructions = `
The user is making casual conversation. When responding:
- Be friendly but brief (1-2 sentences max)
- DO NOT recommend courses unless specifically asked
- Avoid excessive greetings or pleasantries
- DO NOT mention IDs or include technical metadata in your visible response`;
      }

      const response = await fetch(`${API_CONFIG.url}/${API_CONFIG.model}:generateContent?key=${API_CONFIG.key}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: "You are a course assistant for a technical university. Be conversational, natural and concise in your responses.\n\n" +
                "STUDENT CONTEXT:\n" +
                "Career Goal: " + student.career_goal_id + "\n" +
                "Technical Level: " + student.technical_proficiency + "\n" +
                "Preferred Subjects: " + student.preferred_subjects.join(', ') + "\n" +
                "Learning Mode: " + student.preferred_learning_mode + "\n" +
                "Credits: " + student.credits_completed + "\n" +
                "Current Courses: " + student.current_courses_taken.join(', ') + "\n\n" +
                
                "Previous conversation:\n" +
                conversationHistory.map(m => (m.role === 'user' ? 'Student' : 'Assistant') + ": " + m.content).join('\n') + "\n\n" +
                
                "Previously recommended: " + (previouslyRecommended.length > 0 ? previouslyRecommended.join(', ') : 'None') + "\n\n" +
                
                "IMPORTANT NOTE ABOUT TIME SLOTS: When you see time slots like 'MW 10:00-11:15', 'TR 14:30-15:45', or 'F 09:00-10:30', the letters represent days of the week where:\n" +
                "- M = Monday\n" +
                "- T = Tuesday\n" +
                "- W = Wednesday\n" +
                "- R = Thursday\n" +
                "- F = Friday\n" +
                "So 'MW' means Monday and Wednesday, 'TR' means Tuesday and Thursday.\n\n" +
                
                "Available courses with full details: \n" +
                JSON.stringify(enhancedCourses.map(c => {
                  return {
                    id: c.id,
                    title: c.title,
                    subject: c.subject,
                    credits: c.credits,
                    difficulty: c.difficulty,
                    hours_per_week: c.hours_per_week,
                    occupancy: c.occupancy,
                    prerequisites: c.prerequisites,
                    career_paths: c.career_paths,
                    description: c.description || `Course on ${c.subject}`,
                    technical_skills: c.technical_skills || [],
                    time_slot: c.time_slot
                  };
                }), null, 2) + "\n\n" +
                
                "Student: \"" + userInput + "\"\n\n" +
                
                specialInstructions + "\n\n" +
                
                "CRITICAL FORMATTING GUIDELINES:\n" +
                "1. Be natural and conversational - no need to say \"hi\" or have lengthy greetings\n" +
                "2. Keep responses SHORT and FOCUSED - 1-3 sentences when possible\n" +
                "3. NEVER include course IDs in your visible text response\n" +
                "4. When recommending courses, include this metadata AFTER your message, NOT inside code blocks:\n" +
                "   {\"recommendedCourses\": [ids], \"isRecommending\": true}\n" +
                "5. When NOT recommending specific courses, include:\n" +
                "   {\"isRecommending\": false}\n" +
                "6. DO NOT use markdown code blocks in your response\n" +
                "7. DO NOT return raw JSON in the visible part of your message\n" +
                "8. DO NOT include phrases like \"here's the metadata\" or \"here's the JSON\"\n" +
                "9. Answer ALL technical questions using the provided course data\n\n" +
                
                "Your response should simply consist of plain text followed by a single JSON object."
            }]
          }],
          generationConfig: {
            temperature: 0.6, // Slightly reduced for more focused responses
            topP: 0.92,
            topK: 40,
            maxOutputTokens: 500 // Reduced to encourage shorter responses
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
        id: 'assistant',
        role: 'assistant',
        content,
        timestamp: new Date(),
        status: 'complete',
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
    } catch (error) {
      console.error('Error sending message to LLM:', error);
      throw error;
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
              <div className="flex gap-2">
                {/* <button
                  onClick={handleGenerateRecommendations}
                  disabled={isLoading}
                  className="text-gray-500 hover:text-black dark:hover:text-white p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  title="Generate Recommendations"
                >
                  <Sparkles className="h-5 w-5" />
                </button> */}
                <button
                  onClick={handleResetChat}
                  className="text-gray-500 hover:text-black dark:hover:text-white p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  title="Reset Chat"
                >
                  <Trash className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tasks Section - Now Collapsible */}
        <div className="mt-6">
          <button 
            onClick={() => setShowTasks(!showTasks)}
            className="flex items-center justify-between w-full text-left px-3 py-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            <span className="text-sm font-medium text-black dark:text-white">Tasks I can assist you with</span>
            <svg className={`w-5 h-5 transition-transform duration-200 ${showTasks ? 'transform rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showTasks && (
            <div className="mt-2 pl-3 space-y-2 animate-fadeIn">
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
          )}
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
        {messages.filter(m => m.role !== 'system').map((message, index) => {
          // Clean message content - remove empty markdown code blocks and JSON blocks
          let cleanedContent = message.content;
          if (message.role === 'assistant') {
            // Remove empty code blocks
            cleanedContent = cleanedContent.replace(/```(json)?\s*```/g, '');
            // Remove any standalone JSON blocks
            cleanedContent = cleanedContent.replace(/\{\s*"isRecommending"\s*:\s*(true|false)\s*\}/g, '');
            cleanedContent = cleanedContent.replace(/\{\s*"recommendedCourses"\s*:\s*\[\s*\]\s*\}/g, '');
            // Trim extra whitespace
            cleanedContent = cleanedContent.trim();
          }
          
          return (
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
                {message.role === 'assistant' ? (
                  <TextGenerateEffect 
                    words={cleanedContent} 
                    className="text-[13px] leading-[1.5] whitespace-pre-wrap text-gray-800 dark:text-gray-200"
                    duration={1}
                    filter={false}
                  />
                ) : (
                  <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{cleanedContent}</p>
                )}

                {message.role === 'assistant' && message.metadata?.recommendedCourses && 
                 Array.isArray(message.metadata.recommendedCourses) && 
                 message.metadata.recommendedCourses.length > 0 && 
                 message.metadata.isRecommending && (
                  <CourseRecommendationUI
                    courses={message.metadata.recommendedCourses.map((id, idx) => {
                      const course = courses.find(c => c.id === id);
                      if (!course) {
                        console.warn(`Course with ID ${id} not found in courses array`);
                        return null;
                      }
                      
                      // Get availability data
                      const getCourseAvailability = async () => {
                        try {
                          const availData = await getCourseAvailabilityData([id]);
                          return availData[id] || 0.7;
                        } catch (error) {
                          console.error('Error fetching availability data:', error);
                          return 0.7;
                        }
                      };
                      
                      // Determine difficulty level based on hours_required if available
                      let difficultyLevel = course.difficulty_level || 'Intermediate';
                      if ('hours_required' in course && typeof course.hours_required === 'number') {
                        if (course.hours_required < 4) {
                          difficultyLevel = 'Beginner';
                        } else if (course.hours_required >= 4 && course.hours_required < 8) {
                          difficultyLevel = 'Intermediate';
                        } else if (course.hours_required >= 8 && course.hours_required < 12) {
                          difficultyLevel = 'Advanced';
                        } else {
                          difficultyLevel = 'Expert';
                        }
                      }
                      
                      // Generate detailed course-specific reasons if none provided
                      let reasons = ['Recommended by AI Assistant'];
                      if (course.subject) {
                        reasons.push(`Covers key ${course.subject} concepts and skills`);
                      }
                      if (course.career_paths && Array.isArray(course.career_paths) && course.career_paths.length > 0) {
                        reasons.push(`Relevant for ${course.career_paths[0]} career path`);
                      }
                      if ('hours_required' in course && typeof course.hours_required === 'number') {
                        reasons.push(`Requires approximately ${course.hours_required} hours of work per week`);
                      }
                      
                      return {
                        course_id: id,
                        title: course.title,
                        subject: course.subject || 'General',
                        credits: course.credits,
                        match_score: 0.85,
                        difficulty_level: difficultyLevel,
                        time_slot: course.time_slots || 'Flexible',
                        reasons: reasons,
                        prerequisites: course.prerequisites || [],
                        hours_required: ('hours_required' in course) ? course.hours_required : undefined,
                        availability_score: 0.7 // Use a fixed default value instead of state
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
          );
        })}
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