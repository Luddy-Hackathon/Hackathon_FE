"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { AcademicCapIcon, BookOpenIcon, ClockIcon, ChartBarIcon, UserIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { useRecommendations } from "@/context/RecommendationsContext";

// API Config
const API_CONFIG = {
  url: process.env.NEXT_PUBLIC_GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models',
  model: process.env.NEXT_PUBLIC_GEMINI_MODEL || 'gemini-1.5-flash',
  key: process.env.NEXT_PUBLIC_GEMINI_API_KEY
};

// Types
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
  description?: string;
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

// Utility to check for time slot conflicts
function hasTimeConflict(timeSlot1: any, timeSlot2: any): boolean {
  try {
    if (!timeSlot1 || !timeSlot2) return false;
    
    // Parse time slots based on their type
    const parseTimeSlot = (slot: any): { days: string, time: string } | null => {
      if (!slot) return null;
      
      // If it's already an object with days and time
      if (typeof slot === 'object' && slot.days && slot.time) {
        return { days: slot.days, time: slot.time };
      }
      
      // If it's a string that looks like JSON
      if (typeof slot === 'string' && slot.startsWith('{')) {
        try {
          const parsed = JSON.parse(slot);
          if (parsed.days && parsed.time) {
            return { days: parsed.days, time: parsed.time };
          }
        } catch (e) {
          console.error("Error parsing time slot JSON:", e);
        }
      }
      
      // If it's a string in format "MWF 10:00-11:15"
      if (typeof slot === 'string' && /^[MTWRFSU]+ \d+:\d+-\d+:\d+$/.test(slot)) {
        const parts = slot.split(' ');
        return { days: parts[0], time: parts[1] };
      }
      
      return null;
    };
    
    const slot1 = parseTimeSlot(timeSlot1);
    const slot2 = parseTimeSlot(timeSlot2);
    
    // If either slot couldn't be parsed, assume no conflict
    if (!slot1 || !slot2) return false;
    
    // Check for day overlaps
    const days1 = slot1.days.split('');
    const days2 = slot2.days.split('');
    
    const commonDays = days1.filter(day => days2.includes(day));
    if (commonDays.length === 0) return false;
    
    // If days overlap, check times
    const [start1, end1] = slot1.time.split('-');
    const [start2, end2] = slot2.time.split('-');
    
    // Convert times to minutes for easier comparison
    const timeToMinutes = (time: string) => {
      const [hours, minutes] = time.split(':').map(num => parseInt(num));
      return hours * 60 + minutes;
    };
    
    const start1Mins = timeToMinutes(start1);
    const end1Mins = timeToMinutes(end1);
    const start2Mins = timeToMinutes(start2);
    const end2Mins = timeToMinutes(end2);
    
    // Check for time overlap
    return !(end1Mins <= start2Mins || end2Mins <= start1Mins);
  } catch (e) {
    console.error('Error comparing time slots:', e);
    return false; // Assume no conflict if we can't determine
  }
}

// Format time slot for display
function formatTimeSlot(timeSlot: any): string {
  if (!timeSlot) return 'Flexible';
  
  try {
    // Handle object format directly
    if (typeof timeSlot === 'object') {
      const { days, time } = timeSlot;
      
      const dayMap: Record<string, string> = {
        'M': 'Monday',
        'T': 'Tuesday',
        'W': 'Wednesday',
        'R': 'Thursday',
        'F': 'Friday'
      };
      
      if (days && time) {
        const formattedDays = days.split('').map((day: string) => dayMap[day] || day).join(', ');
        return `${formattedDays} ${time}`;
      }
      return JSON.stringify(timeSlot);
    }
    
    // Handle string format
    const timeSlotStr = String(timeSlot);
    if (timeSlotStr.startsWith('{')) {
      try {
        const slotData = JSON.parse(timeSlotStr);
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
      } catch (jsonError) {
        console.error('Error parsing time slot JSON:', jsonError);
        return timeSlotStr;
      }
    } else {
      return timeSlotStr;
    }
  } catch (error) {
    console.error('Error formatting time slot:', error);
    return String(timeSlot) || 'Flexible';
  }
}

// Get course recommendations from LLM
async function getRecommendationsFromLLM(student: Student, courses: Course[]): Promise<CourseRecommendation[]> {
  if (!API_CONFIG.key) {
    console.error('Missing API key');
    return [];
  }

  try {
    console.log('Generating course recommendations...');
    
    // Create a concise student profile
    const studentProfile = {
      career_goal: student.career_goal_id,
      technical_level: student.technical_proficiency,
      preferred_subjects: student.preferred_subjects,
      time_slot_preference: student.course_slot_preference,
      current_courses: student.current_courses_taken,
      credits_completed: student.credits_completed
    };
    
    // Select appropriate courses for recommendation
    const coursesData = courses.map(course => ({
      id: course.id,
      title: course.title,
      subject: course.subject,
      credits: course.credits,
      difficulty_level: course.difficulty_level,
      time_slots: course.time_slots,
      prerequisites: course.prerequisites,
      career_paths: course.career_paths,
      technical_level: course.technical_level,
      description: course.description || `Course on ${course.subject}`
    }));
    
    // Create an optimized prompt
    const prompt = `You are a course recommendation expert with deep technical knowledge. Recommend exactly 3 courses for a student with NO TIME CONFLICTS between them.

Student Profile:
${JSON.stringify(studentProfile, null, 2)}

Available Courses:
${JSON.stringify(coursesData, null, 2)}

Important requirements:
1. The 3 courses MUST NOT have time conflicts with each other
2. Prioritize courses that align with the student's career goal
3. Consider the student's technical level and preferred subjects
4. Check for prerequisites (student should have taken them already)

For each recommended course, provide HIGHLY SPECIFIC technical reasons:
- List exactly what TECHNICAL SKILLS the student will learn (programming languages, frameworks, tools, concepts) not more than 4 words
- Explain how these skills will help in their SPECIFIC CAREER PATH
- Describe specific PROJECTS or APPLICATIONS they could build with these skills
- Mention how this builds on their current knowledge or technical level

Respond ONLY with a JSON object in this exact format:
{
  "recommendations": [
    {
      "course_id": 123,
      "match_score": 0.95,
      "reasons": [
        "Learn React.js, Redux, and React Hooks for building responsive single-page applications",
        "Develop skills in modern JavaScript ES6+ features needed for frontend development",
        "Build a portfolio-ready e-commerce project with authentication and payment processing"
      ]
    }
  ]
}`;

    // Call the LLM API
    const response = await fetch(`${API_CONFIG.url}/${API_CONFIG.model}:generateContent?key=${API_CONFIG.key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 1024
        }
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.candidates[0].content.parts[0].text;
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const recommendations = JSON.parse(jsonMatch[0]);
    
    // Format recommendations with course details
    return recommendations.recommendations
        .map((rec: any) => {
        const course = courses.find(c => c.id === rec.course_id);
          if (!course) return null;

          return {
            course_id: course.id,
            title: course.title,
          subject: course.subject || 'General',
            credits: course.credits,
          match_score: rec.match_score || 0.7,
          difficulty_level: course.difficulty_level || 'Intermediate',
          time_slot: typeof course.time_slots === 'object' ? 
            JSON.stringify(course.time_slots) : course.time_slots,
          reasons: rec.reasons || ['Recommended based on your profile'],
          prerequisites: course.prerequisites || []
          };
        })
        .filter(Boolean);
    } catch (error) {
    console.error('Error getting LLM recommendations:', error);
    
    // Return basic recommendations as fallback
    return courses
      .slice(0, 3)
      .map(course => {
        // Generate course-specific technical reasons based on available course data
        const reasons: string[] = [];
        
        // Map subjects to specific technical skills
        const subjectToSkills: Record<string, string[]> = {
          'Computer Science': ['Data structures', 'Algorithms', 'Problem-solving methodologies'],
          'Programming': ['Software architecture', 'Design patterns', 'Version control systems'],
          'Web Development': ['HTML5/CSS3', 'JavaScript frameworks', 'Responsive design'],
          'Data Science': ['Python libraries (Pandas, NumPy)', 'Statistical analysis', 'Data visualization'],
          'Artificial Intelligence': ['Machine learning algorithms', 'Neural networks', 'TensorFlow/PyTorch'],
          'Cybersecurity': ['Encryption techniques', 'Network security', 'Vulnerability assessment'],
          'Mobile Development': ['Native app development', 'Cross-platform frameworks', 'Mobile UI design'],
          'Database': ['SQL query optimization', 'Database design', 'NoSQL technologies']
        };
        
        // Add skill-specific reason
        if (course.subject && subjectToSkills[course.subject]) {
          const skills = subjectToSkills[course.subject];
          reasons.push(`Master ${skills[0]} and ${skills[1]} for professional ${course.subject} applications`);
        } else {
          reasons.push(`Develop technical expertise in ${course.subject || 'key technology'} fundamentals`);
        }
        
        // Add project-based reason
        const projectIdeas: Record<string, string> = {
          'Computer Science': 'algorithm visualization tools',
          'Programming': 'scalable software applications',
          'Web Development': 'dynamic web applications with APIs',
          'Data Science': 'predictive analytics dashboards',
          'Artificial Intelligence': 'machine learning models for real-world problems',
          'Cybersecurity': 'secure systems and penetration testing tools',
          'Mobile Development': 'feature-rich mobile applications',
          'Database': 'optimized database systems'
        };
        
        if (course.subject && projectIdeas[course.subject]) {
          reasons.push(`Build portfolio-quality ${projectIdeas[course.subject]} using industry standards`);
        } else {
          reasons.push(`Apply concepts through hands-on projects relevant to ${student.career_goal_id}`);
        }
        
        // Add career-focused reason
        if (course.career_paths && course.career_paths.includes(student.career_goal_id)) {
          reasons.push(`Gain essential skills required for ${student.career_goal_id} positions in top companies`);
        } else {
          reasons.push(`Develop versatile technical abilities valued across multiple tech industries`);
        }
        
        return {
          course_id: course.id,
          title: course.title,
          subject: course.subject || 'General',
          credits: course.credits,
          match_score: 0.7,
          difficulty_level: course.difficulty_level || 'Intermediate',
          time_slot: typeof course.time_slots === 'object' ? 
            JSON.stringify(course.time_slots) : course.time_slots,
          reasons,
          prerequisites: course.prerequisites || []
        };
      });
  }
}

// Main Dashboard Component
export default function Dashboard() {
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const { recommendations, setRecommendations, updateRecommendations, applyUpdateRecommendations, recommendationsLoaded } = useRecommendations();
  const [loading, setLoading] = useState(true);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Generate course recommendations
  const generateRecommendations = useCallback(async (studentData: Student, coursesData: Course[]) => {
    setLoadingRecommendations(true);
    
    try {
      const newRecommendations = await getRecommendationsFromLLM(studentData, coursesData);
      
      if (newRecommendations.length > 0) {
        // Verify no time conflicts
        const hasConflicts = newRecommendations.some((course1, i) => 
          newRecommendations.some((course2, j) => 
            i !== j && hasTimeConflict(course1.time_slot, course2.time_slot)
          )
        );
        
        if (hasConflicts) {
          console.warn('Time conflicts detected in recommendations');
        }
        
        console.log('Generated new recommendations via LLM');
    setRecommendations(newRecommendations);
        const now = new Date();
        setLastUpdated(now);
        console.log('Last updated timestamp set to:', now.toLocaleString());
      }
    } catch (error) {
      console.error('Error generating recommendations:', error);
    } finally {
      setLoadingRecommendations(false);
    }
  }, [setRecommendations]);

  // Load student and course data
  useEffect(() => {
    async function fetchData() {
      if (!user) return;

      try {
        // Get student data
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

        // Get courses data
        const { data: coursesData, error: coursesError } = await supabase
          .from('courses')
          .select('*');

        if (coursesError) throw coursesError;

        // Normalize course data
        const normalizedCourses = coursesData.map(course => ({
          ...course,
          time_slots: typeof course.time_slots === 'object' ? JSON.stringify(course.time_slots) : course.time_slots
        }));

        console.log('Loaded courses:', normalizedCourses.length);

        setStudent(studentData);
        setCourses(normalizedCourses);
        
        // Mark initial load as complete
        setInitialLoadComplete(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user]);

  // Handle recommendations after initial data load
  useEffect(() => {
    // Only run this effect after initial data load and recommendations have been loaded from storage
    if (!initialLoadComplete || !recommendationsLoaded || !student || courses.length === 0) {
      return;
    }

    console.log('Checking if recommendations needed, current count:', recommendations.length);
    
    // Generate recommendations only if we don't have any stored ones
    if (recommendations.length === 0) {
      console.log('No existing recommendations found, generating new ones...');
      generateRecommendations(student, courses);
    } else {
      console.log('Using existing recommendations from context');
      // Update the last updated timestamp if we have existing recommendations
      setLastUpdated(new Date());
    }
  }, [initialLoadComplete, recommendationsLoaded, recommendations.length, student, courses, generateRecommendations]);

  // Handle refresh recommendations
  const handleRefreshRecommendations = useCallback(() => {
    if (student && courses.length > 0) {
      // Clear any existing error
      setError(null);
      
      // Inform user that we're generating new recommendations
      console.log('Manually refreshing recommendations...');
      
      // Generate new recommendations
      generateRecommendations(student, courses);
    }
  }, [student, courses, generateRecommendations]);

  // Handle apply new recommendations from chat
  const handleApplyRecommendations = useCallback(() => {
    if (updateRecommendations.length > 0) {
      console.log('Applying updates to recommendations from chat');
      applyUpdateRecommendations();
      const now = new Date();
      setLastUpdated(now);
      console.log('Last updated timestamp set to:', now.toLocaleString());
    }
  }, [updateRecommendations, applyUpdateRecommendations]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  // No student data
  if (!student) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {student.full_name}!
        </h1>
        <p className="text-gray-600">
          Here's your personalized learning dashboard
        </p>
      </div>

      {/* Recommendations */}
      <div className="mb-12">
        <div className="flex justify-between items-center mb-6">
          <div>
          <h2 className="text-2xl font-semibold text-gray-900">
            Recommended Courses
          </h2>
            {lastUpdated && (
              <p className="text-sm text-gray-500 mt-1">
                Last refreshed: {lastUpdated.toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex space-x-4">
            <button
              onClick={handleRefreshRecommendations}
              disabled={loadingRecommendations}
              className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-md font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {loadingRecommendations ? 'Generating...' : 'Get New Recommendations'}
            </button>
          </div>
        </div>
        
        <div className="space-y-4">
          {loadingRecommendations ? (
            <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Generating recommendations...
              </h3>
              <div className="flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                <p className="text-sm text-gray-600 max-w-md mx-auto">
                  Our AI is analyzing your profile and available courses to find the best matches with no time conflicts.
                </p>
              </div>
            </div>
          ) : recommendations.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">No recommendations yet</h3>
              <p className="text-gray-600 mb-4">
                We couldn't find any suitable courses for you at the moment. Try refreshing or adjusting your preferences.
              </p>
            </div>
          ) : (
            recommendations.map((course) => (
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
                        <span>{course.difficulty_level || 'Intermediate'}</span>
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
                      {course.reasons.map((reason, index) => (
                      <li key={index} className="text-sm text-gray-600 flex items-start">
                          <svg className="h-4 w-4 mr-2 mt-0.5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            ))
          )}
        </div>
      </div>
    </div>
  );
} 