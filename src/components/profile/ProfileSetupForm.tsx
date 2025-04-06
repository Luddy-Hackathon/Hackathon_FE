"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createProfile } from "@/utils/api-helpers";

const formPages = [
  {
    title: "Basic Information",
    fields: [
      { name: "full_name", label: "Full Name", type: "text", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "career_goal_id", label: "Career Goal", type: "select", options: ["Software Development", "Data Science", "AI/ML", "Cybersecurity", "Other"], required: true },
      { name: "enrollment_type", label: "Enrollment Type", type: "select", options: ["Full-time", "Part-time", "Online"], required: true },
    ],
  },
  {
    title: "Academic Information",
    fields: [
      { name: "credits_completed", label: "Credits Completed", type: "number", required: true },
      { name: "preferred_subjects", label: "Preferred Subjects", type: "multiselect", options: ["Computer Science", "Mathematics", "Physics", "Engineering", "Business"], required: true },
      { name: "course_slot_preference", label: "Course Slot Preference", type: "select", options: ["Morning", "Afternoon", "Evening", "Flexible"], required: true },
      { name: "target_graduation_term", label: "Target Graduation Term", type: "text", required: true },
    ],
  },
  {
    title: "Learning Preferences",
    fields: [
      { name: "preferred_learning_mode", label: "Preferred Learning Mode", type: "select", options: ["Online", "In-person", "Hybrid"], required: true },
      { name: "learning_style", label: "Learning Style", type: "select", options: ["Visual", "Auditory", "Reading/Writing", "Kinesthetic"], required: true },
      { name: "preferred_difficulty_level", label: "Preferred Difficulty Level", type: "select", options: ["Beginner", "Intermediate", "Advanced"], required: true },
      { name: "technical_proficiency", label: "Technical Proficiency", type: "select", options: ["Beginner", "Intermediate", "Advanced", "Expert"], required: true },
    ],
  },
  {
    title: "Goals and Availability",
    fields: [
      { name: "skill_goals", label: "Skill Goals", type: "multiselect", options: ["Programming", "Data Analysis", "Machine Learning", "Web Development", "Cloud Computing"], required: true },
      { name: "weekly_study_availability", label: "Weekly Study Availability (hours)", type: "number", required: true },
      { name: "current_courses_taken", label: "Current Courses", type: "multiselect", options: ["CS101", "MATH201", "ENG301", "BUS401"], required: true },
      { name: "internship_ready", label: "Internship Ready", type: "select", options: ["Yes", "No", "Planning to be"], required: true },
    ],
  },
];

export default function ProfileSetupForm() {
  const [currentPage, setCurrentPage] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({
    preferred_subjects: [],
    skill_goals: [],
    current_courses_taken: []
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const { user } = useAuth();
  const router = useRouter();

  const validateCurrentPage = () => {
    const errors: Record<string, string> = {};
    const currentFields = formPages[currentPage].fields;
    
    currentFields.forEach((field) => {
      if (field.required) {
        if (field.type === 'multiselect') {
          const values = formData[field.name] || [];
          if (!Array.isArray(values) || values.length === 0) {
            errors[field.name] = `Please select at least one ${field.label}`;
          }
        } else if (!formData[field.name]) {
          errors[field.name] = `${field.label} is required`;
        } else if (field.type === 'email' && !isValidEmail(formData[field.name])) {
          errors[field.name] = 'Please enter a valid email address';
        } else if (field.type === 'number') {
          const numValue = parseFloat(formData[field.name]);
          if (isNaN(numValue) || numValue < 0) {
            errors[field.name] = `Please enter a valid number for ${field.label}`;
          }
        }
      }
    });
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear validation error for this field when it's being edited
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
  };

  const handleNextPage = () => {
    if (validateCurrentPage()) {
      setCurrentPage((prev) => Math.min(formPages.length - 1, prev + 1));
    }
  };

  const formatFormData = (data: Record<string, any>) => {
    const formatted = { ...data };
    
    // Ensure all array fields are actually arrays
    ['preferred_subjects', 'skill_goals', 'current_courses_taken'].forEach(field => {
      if (formatted[field] && !Array.isArray(formatted[field])) {
        formatted[field] = [formatted[field]];
      } else if (!formatted[field]) {
        formatted[field] = [];
      }
    });
    
    // Convert numeric strings to numbers
    ['credits_completed', 'weekly_study_availability'].forEach(field => {
      if (formatted[field] && typeof formatted[field] === 'string') {
        formatted[field] = parseFloat(formatted[field]);
      }
    });
    
    // Trim string fields
    Object.keys(formatted).forEach(key => {
      if (typeof formatted[key] === 'string') {
        formatted[key] = formatted[key].trim();
      }
    });
    
    return formatted;
  };

  const handleSubmit = async () => {
    if (!validateCurrentPage()) {
      return;
    }
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      if (!user?.id) {
        setError("User is not authenticated. Please sign in again.");
        setIsSubmitting(false);
        return;
      }
      
      // Format the data before sending
      const formattedData = formatFormData({
        ...formData,
        user_id: user.id,
      });
      
      console.log("Submitting profile data:", formattedData);
      
      const { success, error } = await createProfile(formattedData);

      if (success) {
        console.log("Profile created successfully!");
        router.push("/profile");
      } else {
        console.error("Error saving profile:", error);
        if (error && typeof error === 'string' && error.includes('pattern')) {
          setError("Invalid data format. Please check your inputs and try again.");
        } else {
          setError(error || "Failed to create profile. Please try again.");
        }
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentPageFields = formPages[currentPage].fields;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Complete Your Profile</h1>
      <p className="text-gray-600 mb-6">Please complete your profile information to personalize your course recommendations.</p>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <div className="mb-4">
        <div className="flex justify-between mb-2">
          <span className="text-sm text-gray-600">
            Page {currentPage + 1} of {formPages.length}
          </span>
          <span className="text-sm text-gray-600">
            {Math.round(((currentPage + 1) / formPages.length) * 100)}% Complete
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full"
            style={{ width: `${((currentPage + 1) / formPages.length) * 100}%` }}
          ></div>
        </div>
      </div>

      <form className="space-y-6" onSubmit={(e) => {
        e.preventDefault();
        if (currentPage === formPages.length - 1) {
          handleSubmit();
        } else {
          handleNextPage();
        }
      }}>
        {currentPageFields.map((field) => (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>{field.label} {field.required && <span className="text-red-500">*</span>}</Label>
            {field.type === "text" || field.type === "email" || field.type === "number" ? (
              <>
                <Input
                  id={field.name}
                  type={field.type}
                  value={formData[field.name] || ""}
                  onChange={(e) => handleInputChange(field.name, e.target.value)}
                  required={field.required}
                  className={validationErrors[field.name] ? "border-red-500" : ""}
                />
                {validationErrors[field.name] && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors[field.name]}</p>
                )}
              </>
            ) : field.type === "select" ? (
              <>
                <Select
                  value={formData[field.name] || ""}
                  onValueChange={(value) => handleInputChange(field.name, value)}
                >
                  <SelectTrigger className={validationErrors[field.name] ? "border-red-500" : ""}>
                    <SelectValue placeholder={`Select ${field.label}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {validationErrors[field.name] && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors[field.name]}</p>
                )}
              </>
            ) : field.type === "multiselect" ? (
              <>
                <div className={`flex flex-wrap gap-2 ${validationErrors[field.name] ? "border border-red-500 p-2 rounded" : ""}`}>
                  {field.options?.map((option) => {
                    const values = formData[field.name] || [];
                    const isSelected = Array.isArray(values) && values.includes(option);
                    
                    return (
                      <Button
                        key={option}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        onClick={() => {
                          const currentValues = Array.isArray(formData[field.name]) ? 
                            formData[field.name] : [];
                          const newValues = isSelected
                            ? currentValues.filter((v: string) => v !== option)
                            : [...currentValues, option];
                          handleInputChange(field.name, newValues);
                        }}
                      >
                        {option}
                      </Button>
                    );
                  })}
                </div>
                {validationErrors[field.name] && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors[field.name]}</p>
                )}
              </>
            ) : null}
          </div>
        ))}

        <div className="flex justify-between pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
            disabled={currentPage === 0}
          >
            Previous
          </Button>
          {currentPage === formPages.length - 1 ? (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Complete Profile"}
            </Button>
          ) : (
            <Button type="submit">
              Next
            </Button>
          )}
        </div>
      </form>
    </div>
  );
} 