"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { AcademicCapIcon, BookOpenIcon, ClockIcon, ChartBarIcon, UserIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

type Course = {
  id: string;
  title: string;
  subject: string;
  credits: number;
  difficulty_level: string;
  time_slot: string;
  prerequisites: string[];
  career_paths: string[];
  technical_level: string;
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
  course_id: string;
  title: string;
  subject: string;
  credits: number;
  match_score: number;
  difficulty_level: string;
  time_slot: string;
  reasons: string[];
  prerequisites: string[];
};

function calculateMatchScore(course: Course, student: Student): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Career path alignment (30% weight)
  if (course.career_paths.includes(student.career_goal_id)) {
    score += 30;
    reasons.push("Aligns with your career goals");
  }

  // Technical level match (25% weight)
  const techLevels = { "Beginner": 1, "Intermediate": 2, "Advanced": 3 };
  const courseTechLevel = techLevels[course.technical_level as keyof typeof techLevels];
  const studentTechLevel = techLevels[student.technical_proficiency as keyof typeof techLevels];
  
  if (courseTechLevel === studentTechLevel) {
    score += 25;
    reasons.push("Matches your technical proficiency");
  } else if (courseTechLevel === studentTechLevel + 1) {
    score += 15;
    reasons.push("Slightly challenging for your current level");
  }

  // Subject preference match (20% weight)
  if (student.preferred_subjects.includes(course.subject)) {
    score += 20;
    reasons.push("Matches your subject preferences");
  }

  // Time slot preference match (15% weight)
  if (course.time_slot === student.course_slot_preference) {
    score += 15;
    reasons.push("Available in your preferred time slot");
  }

  // Prerequisites check (10% weight)
  const hasPrerequisites = course.prerequisites.every(prereq => 
    student.current_courses_taken.includes(prereq)
  );
  if (hasPrerequisites) {
    score += 10;
    reasons.push("You meet all prerequisites");
  }

  return { score: score / 100, reasons };
}

export default function Dashboard() {
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [recommendations, setRecommendations] = useState<CourseRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;

      try {
        // Fetch student data
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

        setStudent(studentData);

        // Fetch all courses
        const { data: coursesData, error: coursesError } = await supabase
          .from('courses')
          .select('*');

        if (coursesError) throw coursesError;

        // Calculate recommendations
        const recommendationsWithScores = coursesData
          .map((course: Course) => {
            const { score, reasons } = calculateMatchScore(course, studentData);
            return {
              course_id: course.id,
              title: course.title,
              subject: course.subject,
              credits: course.credits,
              match_score: score,
              difficulty_level: course.difficulty_level,
              time_slot: course.time_slot,
              reasons,
              prerequisites: course.prerequisites,
            };
          })
          .filter(rec => rec.match_score > 0.5) // Only show courses with >50% match
          .sort((a, b) => b.match_score - a.match_score) // Sort by match score
          .slice(0, 3); // Get top 3 recommendations

        setRecommendations(recommendationsWithScores);
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
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-900">
            Recommended Courses
          </h2>
          <Link 
            href="/course-recommendations"
            className="text-blue-600 hover:text-blue-700 flex items-center"
          >
            View all
            <ArrowRightIcon className="h-4 w-4 ml-1" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {recommendations.map((course) => (
            <div 
              key={course.course_id}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{course.title}</h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {Math.round(course.match_score * 100)}% match
                </span>
              </div>
              <p className="text-gray-500 text-sm mb-4">{course.subject}</p>
              <div className="flex items-center text-sm text-gray-600 mb-2">
                <ChartBarIcon className="h-4 w-4 mr-2" />
                {course.difficulty_level}
              </div>
              <div className="flex items-center text-sm text-gray-600 mb-4">
                <ClockIcon className="h-4 w-4 mr-2" />
                {course.time_slot}
              </div>
              <div className="space-y-1">
                {course.reasons.map((reason, index) => (
                  <div key={index} className="text-sm text-green-600 flex items-center">
                    <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {reason}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        </Link>
      </div>
    </div>
  );
} 