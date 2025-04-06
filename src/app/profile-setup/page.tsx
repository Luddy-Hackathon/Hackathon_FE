"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import CourseSearchDropdown from '@/components/CourseSearchDropdown';
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ArrowRight, CheckCircle, User, Book, Rocket, Code } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";

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

const steps = [
  {
    title: 'Personal Details',
    icon: <User className="h-5 w-5" />,
    content: 'Basic information about you'
  },
  {
    title: 'Study Preferences',
    icon: <Book className="h-5 w-5" />,
    content: 'Your learning preferences and schedule'
  },
  {
    title: 'Career Goals',
    icon: <Rocket className="h-5 w-5" />,
    content: 'Your career aspirations and interests'
  },
  {
    title: 'Technical Background',
    icon: <Code className="h-5 w-5" />,
    content: 'Your technical skills and experience'
  }
];

export default function ProfileSetup() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [careers, setCareers] = useState<Career[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCareer, setSelectedCareer] = useState<Career | null>(null);
  const { user } = useAuth();
  const router = useRouter();
  const [selectedCourses, setSelectedCourses] = useState<Course[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if user already has a profile
  useEffect(() => {
    const checkExistingProfile = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("students")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (data) {
          // If profile exists, redirect to dashboard
          router.push("/");
        }
      } catch (error) {
        console.error("Error checking profile:", error);
      }
    };

    checkExistingProfile();
  }, [user, router]);

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

  const handleSubmit = async () => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      setIsLoading(true);
      
      const submissionData = {
        ...formData,
        current_courses_taken: selectedCourses.map(c => c.id),
        weekly_study_availability: formData.weekly_study_availability || {},
      };

      const { error } = await supabase.from("students").insert([submissionData]);
      
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Profile setup completed successfully!",
      });

      // Add a small delay before redirecting
      setTimeout(() => {
        router.push("/dashboard");
      }, 1000);

    } catch (error) {
      console.error("Error saving profile:", error);
      toast({
        title: "Error",
        description: "Failed to save profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setIsLoading(false);
    }
  };

  const next = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  // Prevent form submission on enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  const items = steps.map((item) => ({
    key: item.title,
    title: item.title,
    icon: item.icon,
  }));

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold tracking-tight mb-4">
            Complete Your Profile
          </h2>
          <p className="text-lg text-muted-foreground">
            Help us personalize your learning experience and create a tailored path for your success
          </p>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {steps.map((step, index) => (
                  <div
                    key={step.title}
                    className={cn(
                      "flex items-center space-x-2",
                      currentStep === index ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    <div className={cn(
                      "rounded-full p-2",
                      currentStep === index ? "bg-primary/10" : "bg-muted"
                    )}>
                      {step.icon}
                    </div>
                    <span className="font-medium">{step.title}</span>
                  </div>
                ))}
              </div>
              <Progress value={(currentStep + 1) * 25} className="w-32" />
            </div>
          </CardHeader>
          
          <CardContent className="pt-8">
            <form 
              className="max-w-2xl mx-auto space-y-6" 
              onSubmit={(e) => e.preventDefault()}
              onKeyDown={handleKeyDown}
            >
              {currentStep === 0 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input
                      id="full_name"
                      placeholder="Enter your full name"
                      value={formData.full_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="enrollment_type">Enrollment Type</Label>
                    <Select
                      value={formData.enrollment_type}
                      onValueChange={(value: string) => setFormData(prev => ({ ...prev, enrollment_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select enrollment type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Full-time">Full-time</SelectItem>
                        <SelectItem value="Part-time">Part-time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="credits_completed">Credits Completed</Label>
                    <Input
                      id="credits_completed"
                      type="number"
                      placeholder="Enter completed credits"
                      value={formData.credits_completed}
                      onChange={(e) => setFormData(prev => ({ ...prev, credits_completed: parseInt(e.target.value) }))}
                    />
                  </div>
                </div>
              )}

              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="course_slot_preference">Preferred Course Time</Label>
                    <Select
                      value={formData.course_slot_preference}
                      onValueChange={(value: string) => setFormData(prev => ({ ...prev, course_slot_preference: value }))}
                    >
                      <SelectTrigger>
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
                    <Label>Learning Mode</Label>
                    <RadioGroup
                      value={formData.preferred_learning_mode}
                      onValueChange={(value: string) => setFormData(prev => ({ ...prev, preferred_learning_mode: value }))}
                      className="grid grid-cols-3 gap-4"
                    >
                      <div className="space-y-2">
                        <RadioGroupItem value="online" id="online" className="peer sr-only" />
                        <Label
                          htmlFor="online"
                          className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                        >
                          <div className="text-lg font-medium">Online</div>
                          <p className="text-sm text-muted-foreground">Virtual classes</p>
                        </Label>
                      </div>
                      <div className="space-y-2">
                        <RadioGroupItem value="in-person" id="in-person" className="peer sr-only" />
                        <Label
                          htmlFor="in-person"
                          className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                        >
                          <div className="text-lg font-medium">In-Person</div>
                          <p className="text-sm text-muted-foreground">Classroom learning</p>
                        </Label>
                      </div>
                      <div className="space-y-2">
                        <RadioGroupItem value="hybrid" id="hybrid" className="peer sr-only" />
                        <Label
                          htmlFor="hybrid"
                          className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                        >
                          <div className="text-lg font-medium">Hybrid</div>
                          <p className="text-sm text-muted-foreground">Mix of both</p>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label>Current Courses</Label>
                    <CourseSearchDropdown
                      selectedCourses={selectedCourses}
                      onCoursesChange={setSelectedCourses}
                    />
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="career_goal_id">Career Goal</Label>
                    <Select
                      value={formData.career_goal_id}
                      onValueChange={(value: string) => {
                        setFormData(prev => ({ ...prev, career_goal_id: value }));
                        const career = careers.find(c => c.id === value);
                        setSelectedCareer(career || null);
                      }}
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
                  </div>

                  {selectedCareer && (
                    <Card className="bg-muted">
                      <CardHeader>
                        <CardTitle className="text-lg">Career Details</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground">{selectedCareer.description}</p>
                        
                        {selectedCareer.required_courses && (
                          <div className="mt-4">
                            <h4 className="font-medium mb-2">Required Courses:</h4>
                            <div className="flex flex-wrap gap-2">
                              {selectedCareer.required_courses.map((course, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center rounded-md bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                                >
                                  {course}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="target_graduation_term">Target Graduation Term</Label>
                    <Input
                      id="target_graduation_term"
                      type="month"
                      value={formData.target_graduation_term}
                      onChange={(e) => setFormData(prev => ({ ...prev, target_graduation_term: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="technical_proficiency">Technical Proficiency</Label>
                      <Select
                        value={formData.technical_proficiency}
                        onValueChange={(value: string) => setFormData(prev => ({ ...prev, technical_proficiency: value }))}
                      >
                        <SelectTrigger>
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
                      <Label htmlFor="preferred_difficulty_level">Preferred Difficulty Level</Label>
                      <Select
                        value={formData.preferred_difficulty_level}
                        onValueChange={(value: string) => setFormData(prev => ({ ...prev, preferred_difficulty_level: value }))}
                      >
                        <SelectTrigger>
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

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="internship_ready"
                      checked={formData.internship_ready}
                      onCheckedChange={(checked: boolean) => setFormData(prev => ({ ...prev, internship_ready: checked }))}
                    />
                    <Label htmlFor="internship_ready">I am ready for internships</Label>
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={prev}
                  disabled={currentStep === 0}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Previous
                </Button>
                {currentStep === steps.length - 1 ? (
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting || isLoading}
                    className="gap-2"
                  >
                    {isSubmitting ? (
                      "Saving..."
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        Complete Setup
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={next}
                    className="gap-2"
                  >
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 