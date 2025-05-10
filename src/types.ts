// Define types for the application

export interface Course {
  id: number;
  title: string;
  subject?: string;
  credits: number;
  difficulty_level?: string;
  time_slots: any; // Could be string or object
  prerequisites?: string[];
  career_paths?: string[];
  technical_level?: string;
  description?: string;
  hours_required?: number;
}

export interface Student {
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
}

export interface CourseRecommendation {
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
} 