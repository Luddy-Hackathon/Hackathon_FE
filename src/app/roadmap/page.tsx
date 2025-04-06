"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Roadmap from "@/components/Roadmap";
import { RecommendationsProvider } from "@/context/RecommendationsContext";

interface StudentData {
  career_goal_id: string;
  current_courses_taken: string[];
  credits_completed: number;
}

export default function RoadmapPage() {
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const fetchStudentData = async () => {
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const { data, error } = await supabase
          .from("students")
          .select("career_goal_id, current_courses_taken, credits_completed")
          .eq("user_id", user.id)
          .single();

        if (error) throw error;
        setStudentData(data);
      } catch (error) {
        console.error("Error fetching student data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();
  }, [user, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="h-8 w-64 bg-gray-200 rounded mx-auto animate-pulse"></div>
            <div className="h-4 w-96 bg-gray-200 rounded mx-auto mt-4 animate-pulse"></div>
          </div>
          <div className="space-y-8">
            {/* Semester blocks skeleton */}
            {[1, 2, 3, 4].map((semester) => (
              <div key={semester} className="bg-white rounded-lg shadow p-6">
                <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-4"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((course) => (
                    <div key={course} className="bg-gray-50 p-4 rounded-lg">
                      <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse mb-2"></div>
                      <div className="h-3 w-1/2 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!studentData) {
    return (
      <div className="text-center p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">No Student Data Found</h2>
        <p className="text-gray-600">Please complete your profile setup first.</p>
        <button
          onClick={() => router.push("/profile-setup")}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Complete Profile Setup
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900">Your Learning Roadmap</h1>
          <p className="mt-4 text-lg text-gray-600">
            A personalized course plan to help you achieve your career goals
          </p>
        </div>
        <RecommendationsProvider>
          <Roadmap
            careerGoal={studentData.career_goal_id}
            currentCourses={studentData.current_courses_taken}
            creditsCompleted={studentData.credits_completed}
          />
        </RecommendationsProvider>
      </div>
    </div>
  );
} 