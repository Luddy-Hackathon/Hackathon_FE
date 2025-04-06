"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { AcademicCapIcon, BookOpenIcon, ClockIcon, ChartBarIcon, UserIcon, ChatBubbleLeftRightIcon, InformationCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useRecommendations } from "@/context/RecommendationsContext";
import { getCourseAvailabilityData } from "@/lib/courseAvailability";

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
  hours_required?: number;
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
  hours_required?: number;
  availability_score?: number;
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

// Utility to determine difficulty level based on hours_required
function getDifficultyLevel(hoursRequired: number | null | undefined): string {
  if (hoursRequired === null || hoursRequired === undefined) {
    return 'Intermediate'; // Default difficulty level
  }
  
  // Define hour ranges for each difficulty level
  if (hoursRequired < 4) {
    return 'Beginner';
  } else if (hoursRequired >= 4 && hoursRequired < 8) {
    return 'Intermediate';
  } else if (hoursRequired >= 8 && hoursRequired < 12) {
    return 'Advanced';
  } else {
    return 'Expert';
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
    
    // Get course IDs for availability calculation
    const courseIds = courses.map(course => course.id);
    
    // Get historical availability data
    const availabilityScores = await getCourseAvailabilityData(courseIds);
    console.log('Retrieved availability data for', Object.keys(availabilityScores).length, 'courses');
    
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
    const coursesData = courses.map(course => {
      // Determine difficulty level based on hours_required if available
      const calculatedDifficultyLevel = course.hours_required 
        ? getDifficultyLevel(course.hours_required)
        : course.difficulty_level || 'Intermediate';
      
      // Get availability score (default to 0.7 if no data)
      const availabilityScore = availabilityScores[course.id] || 0.7;
      
      return {
        id: course.id,
        title: course.title,
        subject: course.subject,
        credits: course.credits,
        difficulty_level: calculatedDifficultyLevel,
        time_slots: course.time_slots,
        prerequisites: course.prerequisites,
        career_paths: course.career_paths,
        technical_level: course.technical_level,
        hours_required: course.hours_required,
        description: course.description || `Course on ${course.subject}`,
        availability_score: availabilityScore
      };
    });
    
    // Create an optimized prompt
    const prompt = `You are a course recommendation expert with deep technical knowledge. Recommend exactly 3 courses for a student with ABSOLUTELY NO TIME CONFLICTS between them.
      
Student Profile:
${JSON.stringify(studentProfile, null, 2)}

Available Courses:
${JSON.stringify(coursesData, null, 2)}

CRITICAL REQUIREMENTS:
1. THE 3 COURSES MUST HAVE ABSOLUTELY NO TIME CONFLICTS WITH EACH OTHER. This is your top priority.
   - Carefully check each course's time_slots property before recommending
   - Verify day and time combinations don't overlap
   - If time_slots is a string like "MWF 10:00-11:15", check that other recommended courses don't have classes on the same days at overlapping times
   - If time_slots is a JSON object with "days" and "time" properties, check each day letter (M=Monday, T=Tuesday, etc.) and time range for conflicts

2. Prioritize courses that align with the student's career goal and could be REQUIRED for their career path
3. Consider course AVAILABILITY when making recommendations:
   - Higher availability_score (closer to 1.0) means easier to enroll
   - Lower availability_score (closer to 0.0) means the course tends to fill up quickly
   - Look for courses with DIVERSE occupancy rates, but PRIORITIZE LOW OCCUPANCY COURSES (high availability_score)
   - Try to include at least one course with availability_score above 0.7 (which means under 30% occupancy)
4. Consider the student's technical level and preferred subjects
5. Check for prerequisites (student should have taken them already)
6. Ensure the difficulty level is appropriate based on the hours_required value

For each recommended course, provide HIGHLY SPECIFIC technical reasons:
- List exactly what TECHNICAL SKILLS the student will learn (programming languages, frameworks, tools, concepts) not more than 2-3 words
- Explain how these skills will help in their SPECIFIC CAREER PATH not more than 2-3 words
- Describe specific PROJECTS or APPLICATIONS they could build with these skills not more than 2-3 words
- Mention how this builds on their current knowledge or technical level not more than 2-3 words
- If the course has high occupancy (availability_score below 0.3, meaning >70% full), mention that the student should register early

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

          // Calculate difficulty level based on hours_required if available
          const difficultyLevel = course.hours_required 
            ? getDifficultyLevel(course.hours_required) 
            : course.difficulty_level || 'Intermediate';
            
          // Get availability score
          const availabilityScore = availabilityScores[course.id] || 0.7;

          return {
            course_id: course.id,
            title: course.title,
            subject: course.subject || 'General',
            credits: course.credits,
            match_score: rec.match_score || 0.7,
            difficulty_level: difficultyLevel,
            time_slot: typeof course.time_slots === 'object' ? 
              JSON.stringify(course.time_slots) : course.time_slots,
            reasons: rec.reasons || ['Recommended based on your profile'],
            prerequisites: course.prerequisites || [],
            hours_required: course.hours_required,
            availability_score: availabilityScore
          };
        })
        .filter(Boolean);
    } catch (error) {
    console.error('Error getting LLM recommendations:', error);
    
    // Return basic recommendations as fallback - but ensure no time conflicts
    // and respect the hours_required field for difficulty level
    const nonConflictingCourses: Course[] = [];
    
    // Try to get course availability data
    let availabilityData: Record<number, number> = {};
    try {
      availabilityData = await getCourseAvailabilityData(courses.map(course => course.id));
    } catch (err) {
      console.error('Failed to get availability data for fallback recommendations:', err);
    }
    
    // Sort courses by relevance to career goal and availability
    const sortedCourses = [...courses].sort((a, b) => {
      // First priority: Required courses for career path
      const aIsRequired = a.career_paths && a.career_paths.includes(student.career_goal_id);
      const bIsRequired = b.career_paths && b.career_paths.includes(student.career_goal_id);
      
      if (aIsRequired && !bIsRequired) return -1;
      if (!aIsRequired && bIsRequired) return 1;
      
      // Second priority: Matched subjects to student preferences
      const aMatchesSubject = student.preferred_subjects?.includes(a.subject || '');
      const bMatchesSubject = student.preferred_subjects?.includes(b.subject || '');
      
      if (aMatchesSubject && !bMatchesSubject) return -1;
      if (!aMatchesSubject && bMatchesSubject) return 1;
      
      // Third priority: Availability score (higher is better)
      const aAvailability = availabilityData[a.id] || 0.5;
      const bAvailability = availabilityData[b.id] || 0.5;
      
      return bAvailability - aAvailability;
    });
    
    // Get up to 3 courses with no time conflicts
    for (const course of sortedCourses) {
      // Skip if we already have 3 courses
      if (nonConflictingCourses.length >= 3) break;
      
      // Check if this course conflicts with any already selected courses
      const hasConflict = nonConflictingCourses.some(selectedCourse => 
        hasTimeConflict(
          typeof course.time_slots === 'object' ? JSON.stringify(course.time_slots) : course.time_slots,
          typeof selectedCourse.time_slots === 'object' ? JSON.stringify(selectedCourse.time_slots) : selectedCourse.time_slots
        )
      );
      
      // If no conflict, add to our selection
      if (!hasConflict) {
        nonConflictingCourses.push(course);
      }
    }
    
    // If we couldn't find 3 non-conflicting courses, just take the top ones until we have 3
    if (nonConflictingCourses.length < 3) {
      for (const course of sortedCourses) {
        if (nonConflictingCourses.length >= 3) break;
        if (!nonConflictingCourses.includes(course)) {
          nonConflictingCourses.push(course);
        }
      }
    }
    
    return nonConflictingCourses
      .map(course => {
        // Generate course-specific technical reasons based on available course data
        const reasons: string[] = [];
        
        // Calculate difficulty level based on hours_required if available
        const difficultyLevel = course.hours_required 
          ? getDifficultyLevel(course.hours_required) 
          : course.difficulty_level || 'Intermediate';
        
        // Get availability score from our calculated data
        const availabilityScore = availabilityData[course.id] || 0.7;
        
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
        
        // Add difficulty-level specific reason based on hours_required
        const hourBasedReason = `This ${difficultyLevel.toLowerCase()}-level course requires about ${course.hours_required || 'variable'} hours weekly`;
        reasons.push(hourBasedReason);
        
        // Add availability-based reason if availability is low
        if (availabilityScore < 0.5) {
          reasons.push(`This course tends to fill up quickly - register early to secure your spot`);
        }
        
        return {
          course_id: course.id,
          title: course.title,
          subject: course.subject || 'General',
          credits: course.credits,
          match_score: 0.7,
          difficulty_level: difficultyLevel,
          time_slot: typeof course.time_slots === 'object' ? 
            JSON.stringify(course.time_slots) : course.time_slots,
          reasons,
          prerequisites: course.prerequisites || [],
          hours_required: course.hours_required,
          availability_score: availabilityScore
        };
      });
  }
}

// Helper function to calculate student enrollment status and credit requirements
function calculateCreditRequirements(creditsCompleted: number) {
  // Constants for credit requirements - total for graduation
  const TOTAL_CREDITS = 30;
  const SEMESTERS_REMAINING = Math.ceil((TOTAL_CREDITS - creditsCompleted) / 15); // Estimate remaining semesters
  
  // Credit requirements per semester - updated values
  const FULL_TIME_MIN_PER_SEMESTER = 9;
  const FULL_TIME_MAX_PER_SEMESTER = 12;
  const PART_TIME_MIN_PER_SEMESTER = 3;
  const PART_TIME_MAX_PER_SEMESTER = 9;
  
  // Determine if student is close to graduation
  const isNearGraduation = creditsCompleted >= 90;
  
  // Calculate remaining credits
  const remainingCredits = TOTAL_CREDITS - creditsCompleted;
  
  // If too few credits remain for full-time, recommend part-time
  const recommendedStatus = remainingCredits < FULL_TIME_MIN_PER_SEMESTER || SEMESTERS_REMAINING <= 1 ? 'part-time' : 'full-time';
  
  // Set min/max credits per semester based on recommended status
  const minCredits = recommendedStatus === 'full-time' ? FULL_TIME_MIN_PER_SEMESTER : PART_TIME_MIN_PER_SEMESTER;
  const maxCredits = recommendedStatus === 'full-time' ? FULL_TIME_MAX_PER_SEMESTER : PART_TIME_MAX_PER_SEMESTER;
  
  // Calculate optimal number of courses (assuming 3 credits per course on average)
  const avgCreditsPerCourse = 3;
  const minCourses = Math.ceil(minCredits / avgCreditsPerCourse);
  const maxCourses = Math.floor(maxCredits / avgCreditsPerCourse);
  
  // Calculate optimal courses based on remaining credits spread over estimated remaining semesters
  const creditsPerSemester = Math.ceil(remainingCredits / Math.max(1, SEMESTERS_REMAINING));
  const optimalCourses = Math.min(maxCourses, Math.max(minCourses, Math.ceil(creditsPerSemester / avgCreditsPerCourse)));
  
  return {
    remainingCredits,
    recommendedStatus,
    minCredits,
    maxCredits,
    minCourses,
    maxCourses,
    optimalCourses,
    isNearGraduation,
    semestersRemaining: SEMESTERS_REMAINING,
    totalCredits: TOTAL_CREDITS
  };
}

// Credit Status Component with improved UI
function CreditStatusCard({ student, recommendations }: { student: Student, recommendations: CourseRecommendation[] }) {
  const { 
    remainingCredits, 
    recommendedStatus, 
    minCredits, 
    maxCredits, 
    minCourses, 
    maxCourses, 
    optimalCourses,
    isNearGraduation,
    semestersRemaining,
    totalCredits
  } = calculateCreditRequirements(student.credits_completed);
  
  // Credit requirements per semester constants - needed in the component
  const FULL_TIME_MIN_PER_SEMESTER = 15;
  const FULL_TIME_MAX_PER_SEMESTER = 30;
  const PART_TIME_MIN_PER_SEMESTER = 3;
  const PART_TIME_MAX_PER_SEMESTER = 15;
  
  // Calculate total credits in current recommendations
  const recommendationCredits = recommendations.reduce((total, course) => total + course.credits, 0);
  const isWithinLimits = recommendationCredits >= minCredits && recommendationCredits <= maxCredits;
  
  // Calculate estimated graduation date
  const currentDate = new Date();
  const semestersInMonths = semestersRemaining * 4; // Approximate 4 months per semester
  const graduationDate = new Date(currentDate.setMonth(currentDate.getMonth() + semestersInMonths));
  const graduationDateString = graduationDate.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long'
  });

  // Calculate progress percentage
  const progressPercentage = Math.round((student.credits_completed / totalCredits) * 100);
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-blue-50">
        <h3 className="text-sm font-medium text-gray-700 flex items-center">
          <AcademicCapIcon className="h-4 w-4 mr-1.5 text-indigo-500" />
          Academic Progress
        </h3>
        <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          recommendedStatus === 'full-time' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
        }`}>
          {recommendedStatus === 'full-time' ? 'Full-time' : 'Part-time'}
        </div>
      </div>
      
      <div className="p-4">
        <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-3">
          <div className="w-full md:w-2/3 flex items-center">
            {/* Simple progress bar instead of circle */}
            <div className="w-full mr-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Progress: <span className="font-medium text-gray-700">{progressPercentage}%</span></span>
                <span>{student.credits_completed}/{totalCredits} credits</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${isNearGraduation ? 'bg-green-500' : 'bg-blue-500'}`}
                  style={{ width: `${progressPercentage}%` }}
                >
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {remainingCredits} credits remaining
              </div>
            </div>
          </div>
          
          <div className="w-full md:w-1/3 bg-gray-50 rounded px-3 py-2 border border-gray-100">
            <div className="text-xs text-gray-500">Est. Graduation</div>
            <div className="text-sm font-medium text-gray-700">{graduationDateString}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {semestersRemaining} {semestersRemaining === 1 ? 'semester' : 'semesters'} remaining
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-3 mb-4">
          {/* Credit Load Card */}
          <div className="bg-gray-50 rounded p-2 border border-gray-100">
            <div className="text-xs text-gray-500 mb-1">Credit Load</div>
            <div className="text-base font-medium text-gray-900">{minCredits}-{maxCredits}</div>
            <div className="text-xs text-gray-500">per semester</div>
          </div>
          
          {/* Course Load Card */}
          <div className="bg-gray-50 rounded p-2 border border-gray-100">
            <div className="text-xs text-gray-500 mb-1">Course Load</div>
            <div className="text-base font-medium text-gray-900">{minCourses}-{maxCourses}</div>
            <div className="text-xs text-gray-500">per semester</div>
          </div>
          
          {/* Current Selection Card */}
          <div className="bg-gray-50 rounded p-2 border border-gray-100">
            <div className="text-xs text-gray-500 mb-1">Current Selection</div>
            <div className={`text-base font-medium ${isWithinLimits ? 'text-gray-900' : 'text-orange-600'}`}>
              {recommendationCredits}
            </div>
            <div className={`text-xs ${isWithinLimits ? 'text-green-600' : 'text-orange-600'}`}>
              {isWithinLimits 
                ? 'Within range' 
                : recommendationCredits < minCredits 
                  ? `Below min (${minCredits})` 
                  : `Above max (${maxCredits})`}
            </div>
          </div>
        </div>
        
        <div className="bg-gray-50 rounded p-3 border border-gray-100 text-xs">
          <div className="flex items-start">
            <UserIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 mr-1.5 flex-shrink-0" />
            <div>
              <span className="font-medium text-gray-700">Advisor Note: </span>
              For {recommendedStatus} students, take <span className="font-medium">{minCourses} courses</span> ({minCredits}-{maxCredits} credits) per semester.
              {recommendedStatus === 'full-time' 
                ? ` Maintain ${FULL_TIME_MIN_PER_SEMESTER}-${FULL_TIME_MAX_PER_SEMESTER} credits to stay on track.` 
                : ` Take ${PART_TIME_MIN_PER_SEMESTER}-${PART_TIME_MAX_PER_SEMESTER} credits based on your availability.`}
              {isNearGraduation && ' Consider meeting with your advisor to plan your final semesters.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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
  const [viewingHistoryFor, setViewingHistoryFor] = useState<number | null>(null);

  // Generate course recommendations with automatic retry
  const generateRecommendations = useCallback(async (studentData: Student, coursesData: Course[], retryCount = 0, maxRetries = 3) => {
    setLoadingRecommendations(true);
    
    try {
      const newRecommendations = await getRecommendationsFromLLM(studentData, coursesData);
      
      if (newRecommendations.length > 0) {
        // Verify no time conflicts
        let hasConflicts = false;
        const conflictPairs: [string, string][] = [];
        
        // Check each pair of courses for conflicts
        for (let i = 0; i < newRecommendations.length; i++) {
          for (let j = i + 1; j < newRecommendations.length; j++) {
            const course1 = newRecommendations[i];
            const course2 = newRecommendations[j];
            
            if (hasTimeConflict(course1.time_slot, course2.time_slot)) {
              hasConflicts = true;
              conflictPairs.push([course1.title, course2.title]);
              console.error(`Time conflict detected between "${course1.title}" and "${course2.title}"`);
            }
          }
        }
        
        if (hasConflicts && retryCount < maxRetries) {
          // Log the conflict but don't show error to user, retry instead
          console.warn(`Attempt ${retryCount + 1}/${maxRetries}: Time conflicts detected in recommendations, retrying...`);
          conflictPairs.forEach(([course1, course2]) => {
            console.warn(`  - Conflict between "${course1}" and "${course2}"`);
          });
          
          // Retry with incremented retry count
          setLoadingRecommendations(false);
          return generateRecommendations(studentData, coursesData, retryCount + 1, maxRetries);
        } else if (hasConflicts) {
          // After max retries, use recommendations but don't show error to user
          console.warn(`Reached max retries (${maxRetries}). Using recommendations despite conflicts.`);
          console.log('Generated recommendations with some time conflicts that could not be resolved automatically.');
          // No error message displayed to user
          setError(null);
        } else {
          console.log('No time conflicts detected in recommendations. All good!');
          setError(null);
        }
        
        console.log('Generated new recommendations via LLM');
        setRecommendations(newRecommendations);
        const now = new Date();
        setLastUpdated(now);
        console.log('Last updated timestamp set to:', now.toLocaleString());
      }
    } catch (error) {
      console.error('Error generating recommendations:', error);
      // Instead of showing the error, retry if we haven't hit max retries
      if (retryCount < maxRetries) {
        console.warn(`Attempt ${retryCount + 1}/${maxRetries}: Error generating recommendations, retrying...`);
        setLoadingRecommendations(false);
        return generateRecommendations(studentData, coursesData, retryCount + 1, maxRetries);
      } else {
        // After max retries, just show a generic message
        setError('Unable to generate optimal recommendations. Showing best available options.');
      }
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

  // Close the enrollment history modal
  const closeEnrollmentHistory = () => {
    setViewingHistoryFor(null);
  };

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
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Your Course Recommendations</h2>
          <div className="flex items-center gap-4">
            {updateRecommendations.length > 0 && (
              <button
                onClick={handleApplyRecommendations}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Apply Chat Suggestions
              </button>
            )}
            <button
              onClick={handleRefreshRecommendations}
              disabled={loadingRecommendations}
              className="inline-flex items-center justify-center w-9 h-9 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              title="Refresh Recommendations"
            >
              <ArrowPathIcon className={`h-5 w-5 ${loadingRecommendations ? 'animate-spin' : ''}`} />
            </button>
            </div>
          </div>
        
        {lastUpdated && (
          <p className="text-sm text-gray-500 mb-4">
            Last updated: {lastUpdated.toLocaleString()}
          </p>
        )}

        <div className="grid grid-cols-1 gap-6">
          {loadingRecommendations ? (
            <div className="col-span-full flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></div>
                <p className="text-gray-600">Generating personalized recommendations...</p>
            </div>
          </div>
          ) : recommendations.length === 0 ? (
            <div className="col-span-full flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-center max-w-md p-6">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No recommendations found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  We couldn't find any course recommendations for you. Try refreshing or updating your preferences.
                </p>
                <div className="mt-6">
                  <button
                    onClick={handleRefreshRecommendations}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <ArrowPathIcon className="h-5 w-5 mr-2" />
                    Generate Recommendations
                  </button>
        </div>
            </div>
          </div>
          ) : (
            recommendations.map((course, index) => (
              <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200">
                <div className="p-6 flex flex-col md:flex-row md:items-start gap-6">
                  <div className="md:w-2/3">
                    <div className="flex items-start mb-4">
                      <div className="flex-grow">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
                          {course.title}
                        </h3>
      </div>

                      <div className="ml-4 flex-shrink-0">
                        <div className="relative w-10 h-10">
                          <svg viewBox="0 0 36 36" className="w-10 h-10">
                            {/* Background ring */}
                            <circle 
                              cx="18" 
                              cy="18" 
                              r="16" 
                              fill="none" 
                              stroke="#f1f5f9" 
                              strokeWidth="3"
                            />
                            {/* Colored progress ring */}
                            <circle 
                              cx="18" 
                              cy="18" 
                              r="16" 
                              fill="none" 
                              stroke={course.match_score >= 0.85 ? "#4ade80" : course.match_score >= 0.7 ? "#60a5fa" : "#f97316"} 
                              strokeWidth="3"
                              strokeDasharray={`${Math.round(course.match_score * 100)} 100`}
                              strokeDashoffset="25"
                              strokeLinecap="round"
                              transform="rotate(-90 18 18)"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs font-bold">{Math.round(course.match_score * 100)}%</span>
        </div>
                        </div>
                      </div>
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
                        <span>
                          {course.difficulty_level || 'Intermediate'}
                          {course.hours_required && ` (${course.hours_required} hrs/week)`}
                        </span>
                    </div>
                    <div className="flex items-center">
                      <ClockIcon className="h-4 w-4 mr-2 text-gray-400" />
                      <span>{formatTimeSlot(course.time_slot)}</span>
                    </div>
                      {course.availability_score !== undefined && (
                        <div className="flex items-center gap-2 mt-3">
                          <div className="flex-shrink-0">
                            <div className={`inline-block w-3 h-3 rounded-full ${
                              (1 - course.availability_score) * 100 <= 50 ? 'bg-green-500' : 
                              (1 - course.availability_score) * 100 <= 70 ? 'bg-yellow-500' : 
                              'bg-red-500'
                            }`}></div>
                          </div>
                          <span className={`text-xs ${
                            (1 - course.availability_score) * 100 <= 50 ? 'text-green-600' : 
                            (1 - course.availability_score) * 100 <= 70 ? 'text-yellow-600' : 
                            'text-red-600'
                          }`}>
                            {(1 - course.availability_score) * 100 <= 50 ? 'Low occupancy' : 
                            (1 - course.availability_score) * 100 <= 70 ? 'Medium occupancy' : 
                            'High occupancy'}
                          </span>
                          <span className="text-xs text-gray-500">
                            ({Math.round((1 - course.availability_score) * 100)}% predicted occupancy)
                          </span>
                          <button 
                            className="text-xs text-blue-600 hover:text-blue-800 ml-auto"
                            onClick={(e) => {
                              e.preventDefault();
                              setViewingHistoryFor(course.course_id);
                            }}
                          >
                            Details
                          </button>
                          <div className="relative ml-1 group">
                            <InformationCircleIcon className="h-4 w-4 text-gray-400 cursor-help" />
                            <div className="absolute bottom-full right-0 mb-2 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 pointer-events-none w-60">
                              Prediction based on historical enrollment patterns. Lower availability means the course typically fills up quickly.
                            </div>
                          </div>
                        </div>
                      )}
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

      {/* Credit Status Card - Now moved to the bottom */}
      {!loading && recommendations.length > 0 && student && (
        <div className="mt-10">
          <CreditStatusCard student={student} recommendations={recommendations} />
          </div>
      )}

      {/* Enrollment History Modal */}
      {viewingHistoryFor !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {(() => {
                const course = recommendations.find(c => c.course_id === viewingHistoryFor);
                if (!course) return null;
                
                const availabilityScore = course.availability_score || 0.5;
                const predictedOccupancy = Math.round((1 - availabilityScore) * 100);
                
                return (
                  <>
                    <div className="flex justify-between items-start mb-4">
                      <h2 className="text-xl font-semibold text-gray-900">Enrollment Prediction: {course.title}</h2>
                      <button 
                        onClick={closeEnrollmentHistory}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
          </div>
                    
                    <div className="mb-6">
                      <div className="mb-2 flex justify-between items-center">
                        <span className="text-sm text-gray-600">Predicted occupancy:</span>
                        <span className={`font-medium ${
                          predictedOccupancy <= 50 ? 'text-green-600' : 
                          predictedOccupancy <= 70 ? 'text-yellow-600' : 
                          'text-red-600'
                        }`}>{predictedOccupancy}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className={`h-2.5 rounded-full ${
                            predictedOccupancy <= 50 ? 'bg-green-500' : 
                            predictedOccupancy <= 70 ? 'bg-yellow-500' : 
                            'bg-red-500'
                          }`}
                          style={{ width: `${predictedOccupancy}%` }}
                        ></div>
                      </div>
                      <p className="mt-2 text-sm italic text-gray-600">
                        {predictedOccupancy <= 50 
                          ? 'This course typically has plenty of open slots.' 
                          : predictedOccupancy <= 70 
                            ? 'This course sometimes fills up, but usually not immediately.' 
                            : 'This course tends to fill up quickly after registration opens.'}
                      </p>
                    </div>
                    
                    <div className="mb-6">
                      <h3 className="font-medium mb-2 text-gray-900">What this means:</h3>
                      <ul className="list-disc pl-5 space-y-2 text-gray-700">
                        <li>{predictedOccupancy <= 50 
                              ? 'You should have no trouble getting into this course.' 
                              : predictedOccupancy <= 70 
                                ? 'Register within the first week of course registration to secure your spot.' 
                                : 'Register immediately when course registration opens.'}</li>
                        <li>{predictedOccupancy > 70 
                              ? 'Consider having a backup course in case this one fills up.' 
                              : 'This course is less likely to reach capacity immediately.'}</li>
                      </ul>
                    </div>
                    
                    <div className="mb-6">
                      <h3 className="font-medium mb-2 text-gray-900">How we calculated this:</h3>
                      <p className="text-gray-700 mb-2">
                        Our prediction is based on historical enrollment data from previous semesters, with recent 
                        semesters weighted more heavily. We analyze:
                      </p>
                      <ul className="list-disc pl-5 space-y-1 text-gray-700">
                        <li>Fill rates from previous terms</li>
                        <li>How quickly the course reached capacity</li>
                        <li>Recent enrollment trends</li>
                        <li>Course popularity relative to available slots</li>
                      </ul>
                    </div>
                    
                    <div className="text-right">
                      <button
                        onClick={closeEnrollmentHistory}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 