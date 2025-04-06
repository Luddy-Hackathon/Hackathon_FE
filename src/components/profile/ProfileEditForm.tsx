"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";

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

interface ProfileEditFormProps {
  initialData: any;
}

export default function ProfileEditForm({ initialData }: ProfileEditFormProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      
      const response = await fetch("/api/profile/update", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          user_id: user?.id,
        }),
      });

      if (response.ok) {
        router.push("/profile");
      } else {
        const errorData = await response.json();
        console.error("Error updating profile:", errorData);
        alert("Failed to update profile. Please try again.");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentPageFields = formPages[currentPage].fields;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-8">
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

      <form className="space-y-6">
        {currentPageFields.map((field) => (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>{field.label}</Label>
            {field.type === "text" || field.type === "email" || field.type === "number" ? (
              <Input
                id={field.name}
                type={field.type}
                value={formData[field.name] || ""}
                onChange={(e) => handleInputChange(field.name, field.type === "number" ? Number(e.target.value) : e.target.value)}
                required={field.required}
              />
            ) : field.type === "select" ? (
              <Select
                value={formData[field.name]}
                onValueChange={(value) => handleInputChange(field.name, value)}
              >
                <SelectTrigger>
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
            ) : field.type === "multiselect" ? (
              <div className="flex flex-wrap gap-2">
                {field.options?.map((option) => {
                  const isSelected = Array.isArray(formData[field.name]) && formData[field.name]?.includes(option);
                  return (
                    <Button
                      key={option}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      onClick={() => {
                        const currentValues = Array.isArray(formData[field.name]) ? formData[field.name] : [];
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
            <Button 
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Updating..." : "Update Profile"}
            </Button>
          ) : (
            <Button 
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(formPages.length - 1, prev + 1))}
            >
              Next
            </Button>
          )}
        </div>
      </form>
    </div>
  );
} 