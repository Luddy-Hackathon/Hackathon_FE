"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import CourseSearchDropdown from '@/components/CourseSearchDropdown';
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
      <div className="h-full w-full flex items-center justify-center bg-zinc-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-zinc-900"></div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-zinc-50">
        <Card className="w-full max-w-md mx-4">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-center">Profile Not Found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-center text-muted-foreground">Please complete your profile setup first.</p>
            <Button 
              onClick={() => router.push("/profile-setup")}
              className="w-full"
            >
              Set Up Profile
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-zinc-50">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="h-full w-full flex flex-col"
      >
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-zinc-900 to-zinc-800 px-6 py-10 sm:px-10">
          <div className="absolute inset-0 overflow-hidden">
            <motion.div 
              className="absolute -inset-[10px] opacity-50"
              style={{
                backgroundImage: "radial-gradient(circle at center, white 0.5px, transparent 0.5px)",
                backgroundSize: "12px 12px",
              }}
              initial={{ opacity: 0.1 }}
              animate={{ opacity: 0.3 }}
              transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
            />
          </div>
          <div className="relative flex justify-between items-center max-w-7xl mx-auto w-full">
            <div>
              <motion.h1 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-3xl font-bold text-white"
              >
                {student.full_name}
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="mt-2 text-zinc-300"
              >
                {student.email}
              </motion.p>
            </div>
            <Button
              onClick={() => isEditing ? handleSave() : setIsEditing(true)}
              disabled={isSaving}
              variant={isEditing ? "default" : "secondary"}
              className={cn(
                "relative overflow-hidden transition-all duration-300",
                isEditing ? "bg-white text-zinc-900 hover:bg-zinc-100" : "bg-zinc-100 text-zinc-900 hover:bg-white"
              )}
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
            <div className="space-y-6">
              {/* Career and Enrollment */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-md font-medium">Career Goal</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Select 
                      disabled={!isEditing}
                      value={student.career_goal_id}
                      onValueChange={(value) => setStudent({ ...student, career_goal_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a career goal" />
                      </SelectTrigger>
                      <SelectContent>
                        {careers.map((career) => (
                          <SelectItem key={career.id} value={career.id}>
                            {career.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {selectedCareer && (
                      <motion.div 
                        className="mt-4 rounded-xl bg-zinc-50 p-6 border border-zinc-100"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <h4 className="text-sm font-semibold text-zinc-900">Career Details</h4>
                        <p className="mt-2 text-sm text-zinc-600">{selectedCareer.description}</p>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>

                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-md font-medium">Enrollment Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="enrollment-type">Enrollment Type</Label>
                      <Select 
                        disabled={!isEditing}
                        value={student.enrollment_type}
                        onValueChange={(value) => setStudent({ ...student, enrollment_type: value })}
                      >
                        <SelectTrigger id="enrollment-type">
                          <SelectValue placeholder="Select enrollment type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Full-time">Full-time</SelectItem>
                          <SelectItem value="Part-time">Part-time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="credits-completed">Credits Completed</Label>
                      <Input
                        id="credits-completed"
                        type="number"
                        value={student.credits_completed}
                        onChange={(e) => setStudent({ ...student, credits_completed: parseInt(e.target.value) || 0 })}
                        disabled={!isEditing}
                        min="0"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Study Preferences */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl font-semibold">Study Preferences</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="course-slot">Course Slot Preference</Label>
                      <Select
                        disabled={!isEditing}
                        value={student.course_slot_preference}
                        onValueChange={(value) => setStudent({ ...student, course_slot_preference: value })}
                      >
                        <SelectTrigger id="course-slot">
                          <SelectValue placeholder="Select preferred time" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Morning">Morning (8 AM - 12 PM)</SelectItem>
                          <SelectItem value="Afternoon">Afternoon (12 PM - 4 PM)</SelectItem>
                          <SelectItem value="Evening">Evening (4 PM - 8 PM)</SelectItem>
                          <SelectItem value="No Preference">No Preference</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="learning-mode">Learning Mode</Label>
                      <Select
                        disabled={!isEditing}
                        value={student.preferred_learning_mode}
                        onValueChange={(value) => setStudent({ ...student, preferred_learning_mode: value })}
                      >
                        <SelectTrigger id="learning-mode">
                          <SelectValue placeholder="Select learning mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="online">Online</SelectItem>
                          <SelectItem value="in-person">In-Person</SelectItem>
                          <SelectItem value="hybrid">Hybrid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Current Courses */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl font-semibold">Current Courses</CardTitle>
                </CardHeader>
                <CardContent>
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
                          className="bg-zinc-50 rounded-lg p-4 border border-zinc-200 transition-all hover:border-zinc-300 hover:shadow-sm"
                        >
                          <h4 className="font-medium text-zinc-900">{course.title}</h4>
                          <div className="flex gap-2 mt-2">
                            <Badge variant="outline" className="bg-zinc-100 text-zinc-700">{course.subject}</Badge>
                            <Badge variant="outline" className="bg-zinc-100 text-zinc-700">{course.credits} credits</Badge>
                          </div>
                        </div>
                      ))}
                      {selectedCourses.length === 0 && (
                        <div className="col-span-full text-center py-10 text-muted-foreground">
                          No courses selected
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Technical Background */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl font-semibold">Technical Background</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="technical-proficiency">Technical Proficiency</Label>
                      <Select
                        disabled={!isEditing}
                        value={student.technical_proficiency}
                        onValueChange={(value) => setStudent({ ...student, technical_proficiency: value })}
                      >
                        <SelectTrigger id="technical-proficiency">
                          <SelectValue placeholder="Select proficiency level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Beginner">Beginner</SelectItem>
                          <SelectItem value="Intermediate">Intermediate</SelectItem>
                          <SelectItem value="Advanced">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="difficulty-level">Preferred Difficulty Level</Label>
                      <Select
                        disabled={!isEditing}
                        value={student.preferred_difficulty_level}
                        onValueChange={(value) => setStudent({ ...student, preferred_difficulty_level: value })}
                      >
                        <SelectTrigger id="difficulty-level">
                          <SelectValue placeholder="Select difficulty level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Beginner">Beginner</SelectItem>
                          <SelectItem value="Intermediate">Intermediate</SelectItem>
                          <SelectItem value="Advanced">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Additional Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl font-semibold">Additional Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="graduation-term">Target Graduation Term</Label>
                    <Input
                      id="graduation-term"
                      type="text"
                      value={student.target_graduation_term}
                      onChange={(e) => setStudent({ ...student, target_graduation_term: e.target.value })}
                      disabled={!isEditing}
                      placeholder="e.g., Spring 2025"
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <Label htmlFor="internship-ready" className="text-base">
                      Ready for Internships
                    </Label>
                    <Switch
                      id="internship-ready"
                      checked={student.internship_ready}
                      onCheckedChange={(checked) => setStudent({ ...student, internship_ready: checked })}
                      disabled={!isEditing}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}