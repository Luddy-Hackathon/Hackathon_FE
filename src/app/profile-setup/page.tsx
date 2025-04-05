"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import ProfileSetupLayout from "@/components/layout/ProfileSetupLayout";
import { supabase } from "@/lib/supabase";
import CourseSearchDropdown from '@/components/CourseSearchDropdown';

type FormData = {
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

const initialFormData: FormData = {
  user_id: "",
  full_name: "",
  email: "",
  career_goal_id: "",
  enrollment_type: "",
  credits_completed: 0,
  preferred_subjects: [],
  course_slot_preference: "",
  preferred_learning_mode: "",
  current_courses_taken: [],
  weekly_study_availability: {}, 
  skill_goals: [], 
  technical_proficiency: "",
  preferred_difficulty_level: "",
  learning_style: "",
  target_graduation_term: "",
  internship_ready: false,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  language_preference: "",
  accessibility_needs: "",
  extracurricular_interests: [], 
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

export default function ProfileSetup() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [careers, setCareers] = useState<Career[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCareer, setSelectedCareer] = useState<Career | null>(null);
  const { user } = useAuth();
  const router = useRouter();
  const [selectedCourses, setSelectedCourses] = useState<Course[]>([]);

  const baseInputStyles = "block w-full rounded-xl border-0 bg-gray-50 px-4 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 transition-all duration-200";
  const baseLabelStyles = "block text-sm font-medium text-gray-900 mb-2";
  const baseSelectStyles = "block w-full rounded-xl border-0 bg-gray-50 px-4 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 transition-all duration-200";
  const baseCardStyles = "bg-white rounded-2xl shadow-sm p-8 hover:shadow-md transition-all duration-300 border border-gray-100";

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        user_id: user.id,
        email: user.email || "",
        full_name: user.user_metadata?.name || ""
      }));
    }
  }, [user]);

  useEffect(() => {
    const fetchCareers = async () => {
      const { data, error } = await supabase
        .from("careers")
        .select("*");
      if (error) {
        console.error("Error fetching careers:", error);
        return;
      }
      if (data) {
        setCareers(data);
      }
    };
    fetchCareers();
  }, []);

  useEffect(() => {
    if (formData.career_goal_id) {
      const career = careers.find(c => c.id === formData.career_goal_id);
      setSelectedCareer(career || null);
    } else {
      setSelectedCareer(null);
    }
  }, [formData.career_goal_id, careers]);

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      // Format arrays for PostgreSQL
      const submissionData = {
        ...formData,
        current_courses_taken:
          selectedCourses.length > 0 ? selectedCourses.map((c) => c.id) : [],
      
        preferred_subjects:
          Array.isArray(formData.preferred_subjects) && formData.preferred_subjects.length > 0
            ? formData.preferred_subjects
            : [],
      
        skill_goals:
          Array.isArray(formData.skill_goals) && formData.skill_goals.length > 0
            ? formData.skill_goals
            : [],
      
        weekly_study_availability:
          Object.keys(formData.weekly_study_availability).length > 0
            ? formData.weekly_study_availability
            : {},
      };

      const { error } = await supabase.from("students").insert([submissionData]);
      console.log(submissionData);
      console.log(error);
      if (error) throw error;
      router.push("/dashboard");
    } catch (error) {
      console.error("Error saving profile:", error);
      alert("Failed to save profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-8">
            <div className={baseCardStyles}>
              <label className={baseLabelStyles}>
                Career Goal
              </label>
              <select
                value={formData.career_goal_id}
                onChange={(e) =>
                  setFormData({ ...formData, career_goal_id: e.target.value })
                }
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
                  {selectedCareer.required_courses && (
                    <div className="mt-4">
                      <h5 className="text-xs font-medium text-gray-700 mb-2">Required Courses:</h5>
                      <div className="flex flex-wrap gap-2">
                        {selectedCareer.required_courses.map((course, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-800 ring-1 ring-inset ring-indigo-200"
                          >
                            {course}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedCareer.recommended_skills && (
                    <div className="mt-4">
                      <h5 className="text-xs font-medium text-gray-700 mb-2">Recommended Skills:</h5>
                      <div className="flex flex-wrap gap-2">
                        {selectedCareer.recommended_skills.map((skill, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-800 ring-1 ring-inset ring-purple-200"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className={baseCardStyles}>
              <label className={baseLabelStyles}>
                Enrollment Type
              </label>
              <select
                value={formData.enrollment_type}
                onChange={(e) =>
                  setFormData({ ...formData, enrollment_type: e.target.value })
                }
                className={baseSelectStyles}
              >
                <option value="">Select enrollment type</option>
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
              </select>
            </div>

            <div className={baseCardStyles}>
              <label className={baseLabelStyles}>
                Credits Completed
              </label>
              <input
                type="number"
                min="0"
                value={formData.credits_completed}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    credits_completed: parseInt(e.target.value) || 0,
                  })
                }
                className={baseInputStyles}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-10">
            {/* <div className={baseCardStyles}>
              <label className={baseLabelStyles}>
                Weekly Study Availability
              </label>
              <div className="mt-4">
                <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(
                    (day) => (
                      <div key={day} className="relative">
                        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                          <div className="text-sm font-semibold text-gray-900 pb-3 border-b border-gray-100">
                            {day}
                          </div>
                          <div className="mt-3 space-y-3">
                            {["morning", "afternoon", "evening"].map((timeSlot) => (
                              <label
                                key={`${day}-${timeSlot}`}
                                className={`relative flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                                  formData.weekly_study_availability[day]?.includes(timeSlot)
                                    ? 'bg-indigo-50 ring-2 ring-indigo-500'
                                    : 'hover:bg-gray-50'
                                }`}
                              >
                                <div className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={formData.weekly_study_availability[day]?.includes(timeSlot) || false}
                                    onChange={(e) => {
                                      const currentSlots = formData.weekly_study_availability[day] || [];
                                      const updatedSlots = e.target.checked
                                        ? [...currentSlots, timeSlot]
                                        : currentSlots.filter((slot) => slot !== timeSlot);
                                      setFormData({
                                        ...formData,
                                        weekly_study_availability: {
                                          ...formData.weekly_study_availability,
                                          [day]: updatedSlots,
                                        },
                                      });
                                    }}
                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded transition-all duration-200"
                                  />
                                  <span className="ml-3 text-sm font-medium text-gray-700 capitalize">
                                    {timeSlot}
                                  </span>
                                </div>
                                {formData.weekly_study_availability[day]?.includes(timeSlot) && (
                                  <svg className="h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
                <div className="mt-6 flex items-start space-x-3 text-sm text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <p className="leading-relaxed">
                    Select your preferred time slots for each day. You can choose multiple slots per day to indicate your availability for study sessions.
                  </p>
                </div>
              </div>
            </div> */}

            <div className={baseCardStyles}>
              <label className={baseLabelStyles}>
                Course Slot Preference
              </label>
              <select
                value={formData.course_slot_preference}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    course_slot_preference: e.target.value,
                  })
                }
                className={baseSelectStyles}
              >
                <option value="">Select your preferred time for courses</option>
                <option value="Morning">Morning (8 AM - 12 PM)</option>
                <option value="Afternoon">Afternoon (12 PM - 4 PM)</option>
                <option value="Evening">Evening (4 PM - 8 PM)</option>
                <option value="No Preference">No Preference</option>
              </select>
            </div>

            <div className={baseCardStyles}>
              <label className={baseLabelStyles}>
                Learning Mode
              </label>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                {["online", "in-person", "hybrid"].map((mode) => (
                  <label
                    key={mode}
                    className={`relative flex flex-col p-4 cursor-pointer rounded-xl border-2 transition-all duration-200 ${
                      formData.preferred_learning_mode === mode
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-indigo-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900 capitalize">
                        {mode.replace("-", " ")}
                      </span>
                      <input
                        type="radio"
                        name="learning_mode"
                        value={mode}
                        checked={formData.preferred_learning_mode === mode}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            preferred_learning_mode: e.target.value,
                          })
                        }
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      {mode === "online" && "Learn from anywhere with virtual classes and resources"}
                      {mode === "in-person" && "Traditional classroom experience with face-to-face interaction"}
                      {mode === "hybrid" && "Mix of online and in-person learning for maximum flexibility"}
                    </p>
                  </label>
                ))}
              </div>
            </div>

            <div className={baseCardStyles}>
              <label className={baseLabelStyles}>
                Current Courses
              </label>
              <CourseSearchDropdown
                selectedCourses={selectedCourses}
                onCoursesChange={setSelectedCourses}
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-8">
            {/* <div className={baseCardStyles}>
              <label className={baseLabelStyles}>
                Preferred Subjects
              </label>
              <div className="mt-1 space-y-4">
                <input
                  type="text"
                  placeholder="Enter subjects separated by commas"
                  value={formData.preferred_subjects.join(", ")}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      preferred_subjects: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  className={baseInputStyles}
                />
                <div className="flex flex-wrap gap-2">
                  {formData.preferred_subjects.map((subject, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-800 ring-1 ring-inset ring-indigo-200"
                    >
                      {subject}
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            preferred_subjects: formData.preferred_subjects.filter(
                              (_, i) => i !== index
                            ),
                          })
                        }
                        className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-indigo-600 hover:bg-indigo-200 hover:text-indigo-900 focus:bg-indigo-500 focus:text-white focus:outline-none"
                      >
                        <span className="sr-only">Remove {subject}</span>×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div> */}

            {/* <div className={baseCardStyles}>
              <label className={baseLabelStyles}>
                Skill Goals
              </label>
              <div className="mt-1 space-y-4">
                <input
                  type="text"
                  placeholder="Enter skills separated by commas"
                  value={formData.skill_goals.join(", ")}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      skill_goals: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  className={baseInputStyles}
                />
                <div className="flex flex-wrap gap-2">
                  {formData.skill_goals.map((skill, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800 ring-1 ring-inset ring-purple-200"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            skill_goals: formData.skill_goals.filter(
                              (_, i) => i !== index
                            ),
                          })
                        }
                        className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-purple-600 hover:bg-purple-200 hover:text-purple-900 focus:bg-purple-500 focus:text-white focus:outline-none"
                      >
                        <span className="sr-only">Remove {skill}</span>×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div> */}

            <div className={baseCardStyles}>
              <label className={baseLabelStyles}>
                Target Graduation Term
              </label>
              <input
                type="text"
                value={formData.target_graduation_term}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    target_graduation_term: e.target.value,
                  })
                }
                placeholder="e.g., Spring 2025"
                className={baseInputStyles}
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-8">
            <div className={baseCardStyles}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={baseLabelStyles}>
                    Technical Proficiency
                  </label>
                  <select
                    value={formData.technical_proficiency}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        technical_proficiency: e.target.value,
                      })
                    }
                    className={baseSelectStyles}
                  >
                    <option value="">Select proficiency level</option>
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
                <div>
                  <label className={baseLabelStyles}>
                    Preferred Difficulty Level
                  </label>
                  <select
                    value={formData.preferred_difficulty_level}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        preferred_difficulty_level: e.target.value,
                      })
                    }
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

            {/* <div className={baseCardStyles}>
              <label className={baseLabelStyles}>
                Learning Style
              </label>
              <select
                value={formData.learning_style}
                onChange={(e) =>
                  setFormData({ ...formData, learning_style: e.target.value })
                }
                className={baseSelectStyles}
              >
                <option value="">Select learning style</option>
                <option value="visual">Visual</option>
                <option value="auditory">Auditory</option>
                <option value="kinesthetic">Kinesthetic</option>
                <option value="mixed">Mixed</option>
              </select>
            </div> */}

            {/* <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 space-y-6">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.internship_ready}
                  onChange={(e) =>
                    setFormData({ ...formData, internship_ready: e.target.checked })
                  }
                  className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded-md transition-all duration-200"
                />
                <label className="ml-3 block text-sm font-medium text-gray-900">
                  Ready for Internships
                </label>
              </div>

              <div>
                <label className={baseLabelStyles}>
                  Language Preference
                </label>
                <input
                  type="text"
                  value={formData.language_preference}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      language_preference: e.target.value,
                    })
                  }
                  placeholder="e.g., English, Spanish"
                  className={baseInputStyles}
                />
              </div>

              <div>
                <label className={baseLabelStyles}>
                  Accessibility Needs
                </label>
                <textarea
                  value={formData.accessibility_needs}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      accessibility_needs: e.target.value,
                    })
                  }
                  placeholder="Please describe any accessibility requirements or accommodations you need"
                  className={`${baseInputStyles} resize-none`}
                  rows={3}
                />
              </div>

              <div>
                <label className={baseLabelStyles}>
                  Extracurricular Interests
                </label>
                <textarea
                  value={formData.extracurricular_interests}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      extracurricular_interests: e.target.value,
                    })
                  }
                  placeholder="Share your interests, hobbies, or activities outside of academics"
                  className={`${baseInputStyles} resize-none`}
                  rows={3}
                />
              </div>
            </div> */}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <ProfileSetupLayout>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="max-w-5xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
          {/* Header Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl tracking-tight">
              Complete Your Profile
            </h1>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              Help us personalize your learning experience and create a tailored path for your success
            </p>
          </div>

          {/* Main Card */}
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
            {/* Progress Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-6">
              <div className="flex justify-between items-center text-white">
                <h2 className="text-2xl font-semibold tracking-tight">
                  {currentStep === 1 && "Personal Details"}
                  {currentStep === 2 && "Study Preferences"}
                  {currentStep === 3 && "Subject Interests & Goals"}
                  {currentStep === 4 && "Technical Background"}
                </h2>
                <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-white/20 backdrop-blur-sm">
                  Step {currentStep} of 4
                </span>
              </div>
              
              {/* Progress Steps */}
              <div className="mt-8 relative">
                <div className="overflow-hidden h-2 flex rounded-full bg-white/20">
                  <div
                    style={{ width: `${(currentStep / 4) * 100}%` }}
                    className="bg-white rounded-full transition-all duration-500 ease-in-out"
                  />
                </div>
                {/* <div className="flex justify-between -mt-3">
                  {[1, 2, 3, 4].map((step) => (
                    <div
                      key={step}
                      className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                        step <= currentStep
                          ? 'border-white bg-white text-indigo-600 shadow-lg'
                          : 'border-white/40 bg-transparent text-white'
                      }`}
                    >
                      {step}
                    </div>
                  ))}
                </div> */}
              </div>
            </div>

            {/* Form Content */}
            <div className="px-8 py-10">
              <form onSubmit={(e) => e.preventDefault()} className="space-y-8">
                <div className="bg-gray-50/50 rounded-2xl p-8 backdrop-blur-sm border border-gray-100">
                  {renderStep()}
                </div>

                {/* Navigation Buttons */}
                <div className="flex justify-between pt-8">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(currentStep - 1)}
                    disabled={currentStep === 1}
                    className={`relative inline-flex items-center px-8 py-4 text-base font-medium rounded-xl text-gray-700 bg-white border-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300 ${
                      currentStep === 1 ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <svg
                      className="mr-2 h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l2.293 2.293a1 1 0 010 1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Previous Step
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (currentStep === 4) {
                        handleSubmit();
                      } else {
                        setCurrentStep(currentStep + 1);
                      }
                    }}
                    disabled={isLoading}
                    className="relative inline-flex items-center px-8 py-4 text-base font-medium rounded-xl text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Saving Profile...
                      </>
                    ) : (
                      <>
                        {currentStep === 4 ? (
                          "Complete Setup"
                        ) : (
                          <>
                            Next Step
                            <svg
                              className="ml-2 h-5 w-5"
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </>
                        )}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </ProfileSetupLayout>
  );
} 