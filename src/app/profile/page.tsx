"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import CourseSearchDropdown from '@/components/CourseSearchDropdown';

type Student = {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  career_goal_id: string;
  enrollment_type: string;
  credits_completed: number;
  preferred_subjects: string[];
  course_slot_preference: string;
  preferred_learning_mode: string;
  current_courses_taken: string[];
  weekly_study_availability: Record<string, string[]>;
  skill_goals: string[];
  technical_proficiency: string;
  preferred_difficulty_level: string;
  learning_style: string;
  target_graduation_term: string;
  internship_ready: boolean;
  timezone: string;
  language_preference: string;
  accessibility_needs: string;
  extracurricular_interests: string[];
};

type Career = {
  id: string;
  title: string;
  description: string;
  required_courses: string[];
  recommended_skills: string[];
};

type Course = {
  id: string;
  title: string;
  subject: string;
  credits: number;
};

export default function Profile() {
  const [isEditing, setIsEditing] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [careers, setCareers] = useState<Career[]>([]);
  const [selectedCareer, setSelectedCareer] = useState<Career | null>(null);
  const [selectedCourses, setSelectedCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  const baseInputStyles = "block w-full rounded-xl border-0 bg-gray-50 px-4 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed";
  const baseLabelStyles = "block text-sm font-medium text-gray-900 mb-2";
  const baseSelectStyles = "block w-full rounded-xl border-0 bg-gray-50 px-4 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed";
  const baseCardStyles = "bg-white rounded-2xl shadow-sm p-8 hover:shadow-md transition-all duration-300 border border-gray-100";

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch student data
        const { data: studentData, error: studentError } = await supabase
          .from("students")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (studentError) throw studentError;
        setStudent(studentData);

        // Fetch careers
        const { data: careerData, error: careerError } = await supabase
          .from("careers")
          .select("*");

        if (careerError) throw careerError;
        setCareers(careerData);

        // Fetch courses if student has any
        if (studentData?.current_courses_taken?.length > 0) {
          const { data: coursesData, error: coursesError } = await supabase
            .from("courses")
            .select("*")
            .in("id", studentData.current_courses_taken);

          if (coursesError) throw coursesError;
          setSelectedCourses(coursesData);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  useEffect(() => {
    if (student?.career_goal_id) {
      const career = careers.find(c => c.id === student.career_goal_id);
      setSelectedCareer(career || null);
    }
  }, [student?.career_goal_id, careers]);

  const handleSave = async () => {
    if (!student) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("students")
        .update({
          ...student,
          current_courses_taken: selectedCourses.map(course => course.id),
        })
        .eq("id", student.id);

      if (error) throw error;
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Profile Not Found</h2>
          <p className="text-gray-600 mb-8">Please complete your profile setup first.</p>
          <button
            onClick={() => router.push("/profile-setup")}
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-xl shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Set Up Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-5xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-8">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-white">{student.full_name}</h1>
                <p className="mt-2 text-indigo-100">{student.email}</p>
              </div>
              <button
                onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                disabled={isSaving}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-xl shadow-sm text-indigo-600 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-indigo-600 focus:ring-white transition-all duration-200"
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : isEditing ? (
                  "Save Changes"
                ) : (
                  "Edit Profile"
                )}
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-8 py-10">
            <div className="space-y-8">
              {/* Career and Enrollment */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className={baseCardStyles}>
                  <label className={baseLabelStyles}>Career Goal</label>
                  <select
                    value={student.career_goal_id}
                    onChange={(e) => setStudent({ ...student, career_goal_id: e.target.value })}
                    disabled={!isEditing}
                    className={baseSelectStyles}
                  >
                    <option value="">Select a career goal</option>
                    {careers.map((career) => (
                      <option key={career.id} value={career.id}>
                        {career.title}
                      </option>
                    ))}
                  </select>
                  {selectedCareer && (
                    <div className="mt-4 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 p-6">
                      <h4 className="text-sm font-semibold text-gray-900">Career Details</h4>
                      <p className="mt-2 text-sm text-gray-600">{selectedCareer.description}</p>
                    </div>
                  )}
                </div>

                <div className={baseCardStyles}>
                  <label className={baseLabelStyles}>Enrollment Type</label>
                  <select
                    value={student.enrollment_type}
                    onChange={(e) => setStudent({ ...student, enrollment_type: e.target.value })}
                    disabled={!isEditing}
                    className={baseSelectStyles}
                  >
                    <option value="">Select enrollment type</option>
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                  </select>

                  <div className="mt-6">
                    <label className={baseLabelStyles}>Credits Completed</label>
                    <input
                      type="number"
                      value={student.credits_completed}
                      onChange={(e) => setStudent({ ...student, credits_completed: parseInt(e.target.value) || 0 })}
                      disabled={!isEditing}
                      min="0"
                      className={baseInputStyles}
                    />
                  </div>
                </div>
              </div>

              {/* Study Preferences */}
              <div className={baseCardStyles}>
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Study Preferences</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={baseLabelStyles}>Course Slot Preference</label>
                    <select
                      value={student.course_slot_preference}
                      onChange={(e) => setStudent({ ...student, course_slot_preference: e.target.value })}
                      disabled={!isEditing}
                      className={baseSelectStyles}
                    >
                      <option value="">Select preferred time</option>
                      <option value="Morning">Morning (8 AM - 12 PM)</option>
                      <option value="Afternoon">Afternoon (12 PM - 4 PM)</option>
                      <option value="Evening">Evening (4 PM - 8 PM)</option>
                      <option value="No Preference">No Preference</option>
                    </select>
                  </div>

                  <div>
                    <label className={baseLabelStyles}>Learning Mode</label>
                    <select
                      value={student.preferred_learning_mode}
                      onChange={(e) => setStudent({ ...student, preferred_learning_mode: e.target.value })}
                      disabled={!isEditing}
                      className={baseSelectStyles}
                    >
                      <option value="">Select learning mode</option>
                      <option value="online">Online</option>
                      <option value="in-person">In-Person</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Current Courses */}
              <div className={baseCardStyles}>
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Current Courses</h3>
                {isEditing ? (
                  <CourseSearchDropdown
                    selectedCourses={selectedCourses}
                    onCoursesChange={setSelectedCourses}
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedCourses.map((course) => (
                      <div
                        key={course.id}
                        className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                      >
                        <h4 className="font-medium text-gray-900">{course.title}</h4>
                        <p className="text-sm text-gray-500 mt-1">
                          {course.subject} • {course.credits} credits
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Technical Background */}
              <div className={baseCardStyles}>
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Technical Background</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={baseLabelStyles}>Technical Proficiency</label>
                    <select
                      value={student.technical_proficiency}
                      onChange={(e) => setStudent({ ...student, technical_proficiency: e.target.value })}
                      disabled={!isEditing}
                      className={baseSelectStyles}
                    >
                      <option value="">Select proficiency level</option>
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                    </select>
                  </div>

                  <div>
                    <label className={baseLabelStyles}>Preferred Difficulty Level</label>
                    <select
                      value={student.preferred_difficulty_level}
                      onChange={(e) => setStudent({ ...student, preferred_difficulty_level: e.target.value })}
                      disabled={!isEditing}
                      className={baseSelectStyles}
                    >
                      <option value="">Select difficulty level</option>
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div className={baseCardStyles}>
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Additional Information</h3>
                <div className="space-y-6">
                  <div>
                    <label className={baseLabelStyles}>Target Graduation Term</label>
                    <input
                      type="text"
                      value={student.target_graduation_term}
                      onChange={(e) => setStudent({ ...student, target_graduation_term: e.target.value })}
                      disabled={!isEditing}
                      placeholder="e.g., Spring 2025"
                      className={baseInputStyles}
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={student.internship_ready}
                      onChange={(e) => setStudent({ ...student, internship_ready: e.target.checked })}
                      disabled={!isEditing}
                      className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded-md transition-all duration-200"
                    />
                    <label className="ml-3 block text-sm font-medium text-gray-900">
                      Ready for Internships
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
