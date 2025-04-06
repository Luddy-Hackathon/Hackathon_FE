"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { AcademicCapIcon, BookOpenIcon, ClockIcon, ChartBarIcon, UserIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import OpenAI from 'openai';
import * as tf from '@tensorflow/tfjs';

// Google AI Studio Configuration
const llmConfig = {
  baseURL: "https://generativelanguage.googleapis.com/v1beta/models",
  model: "gemini-2.0-flash", // Google's Gemini Pro model
  apiKey: "AIzaSyCr_h_JIkt4-_Aa-kOWmE0Ff1_KZ6XMsIE", // Replace with your Google AI Studio API key
  dangerouslyAllowBrowser: true
};

// Enhanced cache utilities with longer duration and better error handling
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

interface CacheItem<T> {
  data: T;
  timestamp: number;
}

const cacheUtils = {
  set<T>(key: string, data: T): void {
    try {
      const item: CacheItem<T> = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(key, JSON.stringify(item));
    } catch (error) {
      console.warn('Cache write failed:', error);
    }
  },

  get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;

      const { data, timestamp }: CacheItem<T> = JSON.parse(item);
      if (Date.now() - timestamp > CACHE_DURATION) {
        localStorage.removeItem(key);
        return null;
      }

      return data;
    } catch (error) {
      console.warn('Cache read failed:', error);
      return null;
    }
  },

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Cache remove failed:', error);
    }
  }
};

type Course = {
  id: number;
  title: string;
  subject?: string;
  credits: number;
  difficulty_level?: string;
  time_slots: string;
  prerequisites?: string[];
  career_paths?: string[];
  technical_level?: string;
};

type Student = {
  id: string;
  user_id: string;
  full_name: string;
  career_goal_id: string;
  technical_proficiency: string;
  preferred_subjects: string[];
  preferred_learning_mode: string;
  course_slot_preference: string;
  current_courses_taken: string[];
  credits_completed: number;
};

type CourseRecommendation = {
  course_id: number;
  title: string;
  subject?: string;
  credits: number;
  match_score: number;
  difficulty_level?: string;
  time_slot: string;
  reasons: string[];
  prerequisites?: string[];
};

// ML Model for Collaborative Filtering
class RecommenderModel {
  private model: tf.Sequential;

  constructor(numUsers: number, numCourses: number, embeddingDim: number = 50) {
    this.model = tf.sequential({
      layers: [
        tf.layers.embedding({
          inputDim: numUsers,
          outputDim: embeddingDim,
          inputLength: 1
        }),
        tf.layers.embedding({
          inputDim: numCourses,
          outputDim: embeddingDim,
          inputLength: 1
        }),
        tf.layers.dot({axes: 2}),
        tf.layers.dense({units: 1, activation: 'sigmoid'})
      ]
    });

    this.model.compile({
      optimizer: 'adam',
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });
  }

  async train(
    userIds: number[],
    courseIds: number[],
    ratings: number[],
    epochs: number = 10
  ) {
    const xs = [tf.tensor1d(userIds), tf.tensor1d(courseIds)];
    const ys = tf.tensor1d(ratings);

    await this.model.fit(xs, ys, {
      epochs,
      batchSize: 32,
      validationSplit: 0.2
    });
  }

  predict(userId: number, courseId: number): number {
    const prediction = this.model.predict([
      tf.tensor1d([userId]),
      tf.tensor1d([courseId])
    ]) as tf.Tensor;
    return prediction.dataSync()[0];
  }
}

function calculateMatchScore(course: Course, student: Student): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Career path alignment (30% weight)
  if (course.career_paths && course.career_paths.includes(student.career_goal_id)) {
    score += 30;
    reasons.push("Aligns with your career goals");
  }

  // Technical level match (25% weight)
  const techLevels = { "Beginner": 1, "Intermediate": 2, "Advanced": 3 };
  const courseTechLevel = course.technical_level ? techLevels[course.technical_level as keyof typeof techLevels] : 1;
  const studentTechLevel = techLevels[student.technical_proficiency as keyof typeof techLevels];
  
  if (courseTechLevel === studentTechLevel) {
    score += 25;
    reasons.push("Matches your technical proficiency");
  } else if (courseTechLevel === studentTechLevel + 1) {
    score += 15;
    reasons.push("Slightly challenging for your current level");
  }

  // Subject preference match (20% weight)
  if (course.subject && student.preferred_subjects.includes(course.subject)) {
    score += 20;
    reasons.push("Matches your subject preferences");
  }

  // Time slot preference match (15% weight)
  if (course.time_slots && course.time_slots === student.course_slot_preference) {
    score += 15;
    reasons.push("Available in your preferred time slot");
  }

  // Prerequisites check (10% weight)
  const hasPrerequisites = course.prerequisites ? 
    course.prerequisites.every(prereq => student.current_courses_taken.includes(prereq)) :
    true;
  if (hasPrerequisites) {
    score += 10;
    reasons.push("You meet all prerequisites");
  }

  return { score: score / 100, reasons };
}

// Enhanced match score calculation
function calculateEnhancedMatchScore(course: Course, student: Student): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Career path alignment (30% weight)
  if (course.career_paths && course.career_paths.includes(student.career_goal_id)) {
    score += 30;
    reasons.push("Aligns with your career goals");
  }

  // Technical level match (25% weight)
  const techLevels = { "Beginner": 1, "Intermediate": 2, "Advanced": 3 };
  const courseTechLevel = course.technical_level ? techLevels[course.technical_level as keyof typeof techLevels] : 1;
  const studentTechLevel = techLevels[student.technical_proficiency as keyof typeof techLevels];
  
  if (courseTechLevel === studentTechLevel) {
    score += 25;
    reasons.push("Matches your technical proficiency");
  } else if (courseTechLevel === studentTechLevel + 1) {
    score += 15;
    reasons.push("Slightly challenging for your current level");
  }

  // Subject preference match (20% weight)
  if (course.subject && student.preferred_subjects.includes(course.subject)) {
    score += 20;
    reasons.push("Matches your subject preferences");
  }

  // Time slot preference match (15% weight)
  if (course.time_slots && course.time_slots === student.course_slot_preference) {
    score += 15;
    reasons.push("Available in your preferred time slot");
  }

  // Prerequisites check (10% weight)
  const hasPrerequisites = course.prerequisites ? 
    course.prerequisites.every(prereq => student.current_courses_taken.includes(prereq)) :
    true;
  if (hasPrerequisites) {
    score += 10;
    reasons.push("You meet all prerequisites");
  }

  // Course difficulty based on credits (bonus)
  if (course.credits <= 3 && student.credits_completed < 30) {
    score += 5;
    reasons.push("Suitable for early-stage students");
  } else if (course.credits > 3 && student.credits_completed >= 30) {
    score += 5;
    reasons.push("Appropriate for advanced students");
  }

  return { score: score / 100, reasons };
}

// Utility function to clean JSON response from LLM
function cleanJsonResponse(content: string): string {
  // Remove markdown code blocks if present
  content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  // Remove any leading/trailing whitespace
  return content.trim();
}

// Utility function for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Enhanced rate limiter with better queue management
class RateLimiter {
  private static instance: RateLimiter;
  private lastRequestTime: number = 0;
  private requestQueue: (() => Promise<void>)[] = [];
  private isProcessing: boolean = false;
  private readonly minDelay: number = 2000; // 2 seconds between requests
  private readonly maxRetries: number = 3;
  private readonly retryDelay: number = 5000; // 5 seconds between retries

  private constructor() {}

  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const executeRequest = async (retryCount = 0) => {
        try {
          const now = Date.now();
          const timeSinceLastRequest = now - this.lastRequestTime;
          const delay = Math.max(0, this.minDelay - timeSinceLastRequest);

          if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          this.lastRequestTime = Date.now();
          const result = await fn();
          resolve(result);
        } catch (error: any) {
          if (error?.status === 429 && retryCount < this.maxRetries) {
            console.log(`Rate limited, retrying in ${this.retryDelay/1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, this.retryDelay));
            return executeRequest(retryCount + 1);
          }
          reject(error);
        }
      };

      this.requestQueue.push(() => executeRequest());
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) return;

    this.isProcessing = true;
    const request = this.requestQueue.shift();
    if (request) {
      await request();
    }
    this.isProcessing = false;
    this.processQueue();
  }
}

// Helper function to create the API client
async function getRecommendationsFromLLM(prompt: string): Promise<any> {
  try {
    const response = await fetch(`${llmConfig.baseURL}/${llmConfig.model}:generateContent?key=${llmConfig.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
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
      const errorData = await response.json();
      console.error('Google AI API Error:', errorData);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    const responseText = result.candidates[0].content.parts[0].text;
    
    // Extract JSON from the response text
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    return jsonMatch[0];
  } catch (error) {
    console.error('Error calling Google AI API:', error);
    throw error;
  }
}

// Move MLRecommender outside the Dashboard component
function MLRecommender({ student, courses, onRecommendationsGenerated }: {
  student: Student;
  courses: Course[];
  onRecommendationsGenerated: (recommendations: CourseRecommendation[]) => void;
}) {
  const [hasError, setHasError] = useState(false);
  const [isGeneratingRecommendations, setIsGeneratingRecommendations] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  const generateRecommendations = useCallback(async () => {
    if (hasError || isGeneratingRecommendations || hasGenerated) return;

    setIsGeneratingRecommendations(true);
    console.log('MLRecommender: Starting recommendation generation');

    try {
      // Check cache first
      const cacheKey = `recommendations-${student.id}`;
      const cached = cacheUtils.get<CourseRecommendation[]>(cacheKey);
      if (cached) {
        console.log('Using cached recommendations');
        onRecommendationsGenerated(cached);
        setHasGenerated(true);
        return;
      }

      const studentProfile = {
        career_goal: student.career_goal_id,
        tech_level: student.technical_proficiency,
        subjects: student.preferred_subjects,
        time_slot: student.course_slot_preference,
        current_courses: student.current_courses_taken,
        credits: student.credits_completed
      };

      const relevantCourses = courses
        .filter(course => {
          const hasMatchingSubject = !course.subject || student.preferred_subjects.includes(course.subject);
          const hasMatchingTimeSlot = !course.time_slots || course.time_slots === student.course_slot_preference;
          return hasMatchingSubject || hasMatchingTimeSlot;
        })
        .slice(0, 10);

      const prompt = `You are a course recommendation expert. Analyze this student profile and course data to provide 3 personalized recommendations.
      
Student Profile:
${JSON.stringify(studentProfile, null, 2)}

Available Courses:
${JSON.stringify(relevantCourses, null, 2)}

Provide recommendations in this exact JSON format (no additional text or explanation):
{
  "recommendations": [
    {
      "course_id": "string",
      "match_score": number,
      "reasons": ["string"]
    }
  ]
}`;

      const response = await getRecommendationsFromLLM(prompt);
      let llmRecommendations;
      try {
        llmRecommendations = JSON.parse(response);
      } catch (parseError) {
        console.error('MLRecommender: Error parsing LLM response:', parseError);
        throw new Error('Failed to parse LLM response');
      }

      if (!llmRecommendations.recommendations || !Array.isArray(llmRecommendations.recommendations)) {
        throw new Error('Invalid recommendations format');
      }

      const recommendations = llmRecommendations.recommendations
        .map((rec: any) => {
          const courseId = parseInt(rec.course_id, 10);
          if (isNaN(courseId)) return null;
          
          const course = courses.find(c => c.id === courseId);
          if (!course) return null;

          const baseScore = calculateMatchScore(course, student);

          return {
            course_id: course.id,
            title: course.title,
            subject: course.subject,
            credits: course.credits,
            match_score: (baseScore.score + (rec.match_score || 0)) / 2,
            difficulty_level: course.difficulty_level,
            time_slot: course.time_slots,
            reasons: [...new Set([...baseScore.reasons, ...(rec.reasons || [])])],
            prerequisites: course.prerequisites
          };
        })
        .filter(Boolean);

      // Cache the results
      cacheUtils.set(cacheKey, recommendations);
      onRecommendationsGenerated(recommendations);
      setHasGenerated(true);
    } catch (error) {
      console.error('MLRecommender: Error in recommendation generation:', error);
      setHasError(true);
      
      // Fallback to basic recommendations
      const basicRecommendations = courses.map(course => ({
        course_id: course.id,
        title: course.title,
        subject: course.subject,
        credits: course.credits,
        match_score: calculateMatchScore(course, student).score,
        difficulty_level: course.difficulty_level,
        time_slot: course.time_slots,
        reasons: calculateMatchScore(course, student).reasons,
        prerequisites: course.prerequisites
      }))
      .filter(rec => rec.match_score > 0.5)
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 3);

      onRecommendationsGenerated(basicRecommendations);
      setHasGenerated(true);
    } finally {
      setIsGeneratingRecommendations(false);
    }
  }, [student.id, courses, onRecommendationsGenerated, hasError, isGeneratingRecommendations, hasGenerated]);

  useEffect(() => {
    generateRecommendations();
  }, [generateRecommendations]);

  return null;
}

// Utility functions for historical data analysis
function calculateSuccessRate(courseId: string, historicalData: any[]): number {
  const courseData = historicalData.filter(d => d.courseId === courseId);
  if (courseData.length === 0) return 0;
  const successfulCompletions = courseData.filter(d => d.completed).length;
  return (successfulCompletions / courseData.length) * 100;
}

function calculateAverageRating(courseId: string, historicalData: any[]): number {
  const courseRatings = historicalData
    .filter(d => d.courseId === courseId)
    .map(d => d.rating);
  if (courseRatings.length === 0) return 0;
  return courseRatings.reduce((a, b) => a + b) / courseRatings.length;
}

// Move cache utilities to a custom hook
function useLocalStorage<T>(key: string, initialValue: T) {
  // Initialize state with a function to avoid executing localStorage during SSR
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that persists the new value to localStorage
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue] as const;
}

// Update the formatTimeSlot function
function formatTimeSlot(timeSlot: string | { days: string; time: string }): string {
  if (!timeSlot) return 'Flexible';
  
  try {
    // If timeSlot is already an object, use it directly
    const slotData = typeof timeSlot === 'string' ? JSON.parse(timeSlot) : timeSlot;
    const { days, time } = slotData;
    
    const dayMap: Record<string, string> = {
      'M': 'Monday',
      'T': 'Tuesday',
      'W': 'Wednesday',
      'R': 'Thursday',
      'F': 'Friday'
    };
    
    const formattedDays = days.split('').map((day: string) => dayMap[day] || day).join(', ');
    return `${formattedDays} ${time}`;
  } catch (error) {
    console.error('Error formatting time slot:', error);
    return 'Flexible';
  }
}

export default function Dashboard() {
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [recommendations, setRecommendations] = useState<CourseRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleRecommendationsGenerated = useCallback((newRecommendations: CourseRecommendation[]) => {
    setRecommendations(newRecommendations);
  }, []);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;

      try {
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (studentError) throw studentError;
        if (!studentData) {
          window.location.href = '/profile-setup';
          return;
        }

        const { data: coursesData, error: coursesError } = await supabase
          .from('courses')
          .select('*');

        if (coursesError) throw coursesError;

        // Ensure time_slots is always a string
        const transformedCourses = coursesData.map(course => ({
          ...course,
          time_slots: typeof course.time_slots === 'object' ? JSON.stringify(course.time_slots) : course.time_slots
        }));

        setStudent(studentData);
        setCourses(transformedCourses);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!student) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {student.full_name}!
        </h1>
        <p className="text-gray-600">
          Here's your personalized learning dashboard
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center">
            <AcademicCapIcon className="h-8 w-8 text-blue-500" />
            <div className="ml-4">
              <p className="text-sm text-gray-500">Credits Completed</p>
              <p className="text-2xl font-semibold">{student.credits_completed}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center">
            <BookOpenIcon className="h-8 w-8 text-green-500" />
            <div className="ml-4">
              <p className="text-sm text-gray-500">Current Courses</p>
              <p className="text-2xl font-semibold">{student.current_courses_taken.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center">
            <ClockIcon className="h-8 w-8 text-purple-500" />
            <div className="ml-4">
              <p className="text-sm text-gray-500">Preferred Time</p>
              <p className="text-2xl font-semibold">{student.course_slot_preference}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Course Recommendations */}
      <div className="mb-12">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-semibold text-gray-900">
            Recommended Courses
          </h2>
        </div>
        <div className="space-y-4">
          {recommendations.map((course) => (
          console.log(course),
            <div 
              key={course.course_id}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-all duration-300"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{course.title}</h3>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                      {Math.round(course.match_score * 100)}% match
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <BookOpenIcon className="h-4 w-4 mr-2 text-gray-400" />
                      <span>{course.subject || 'General'}</span>
                    </div>
                    <div className="flex items-center">
                      <AcademicCapIcon className="h-4 w-4 mr-2 text-gray-400" />
                      <span>{course.credits} credits</span>
                    </div>
                    <div className="flex items-center">
                      <ChartBarIcon className="h-4 w-4 mr-2 text-gray-400" />
                      <span>{course.difficulty_level || 'Not specified'}</span>
                    </div>
                    <div className="flex items-center">
                      <ClockIcon className="h-4 w-4 mr-2 text-gray-400" />
                      <span>{formatTimeSlot(course.time_slot)}</span>
                    </div>
                  </div>
                </div>

                <div className="md:w-1/3">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Why this course?</h4>
                  <ul className="space-y-1">
                    {course.reasons.slice(0, 2).map((reason, index) => (
                      <li key={index} className="text-sm text-gray-600 flex items-start">
                        <svg className="h-4 w-4 mr-2 mt-0.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="line-clamp-2">{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {course.prerequisites && course.prerequisites.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Prerequisites</h4>
                  <div className="flex flex-wrap gap-2">
                    {course.prerequisites.map((prereq, index) => (
                      <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {prereq}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link 
          href="/profile"
          className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow flex items-center"
        >
          <UserIcon className="h-8 w-8 text-gray-400" />
          <div className="ml-4">
            <h3 className="text-lg font-semibold text-gray-900">Update Profile</h3>
            <p className="text-gray-600">Modify your preferences and goals</p>
          </div>
        </Link>
        <Link 
          href="/courses"
          className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow flex items-center"
        >
          <BookOpenIcon className="h-8 w-8 text-gray-400" />
          <div className="ml-4">
            <h3 className="text-lg font-semibold text-gray-900">Browse Courses</h3>
            <p className="text-gray-600">Explore all available courses</p>
          </div>
        </Link> */}
      {/* </div> */}

      {student && courses.length > 0 && (
        <MLRecommender
          student={student}
          courses={courses}
          onRecommendationsGenerated={handleRecommendationsGenerated}
        />
      )}
    </div>
  );
} 