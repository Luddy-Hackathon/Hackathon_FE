export type Course = {
  id: number;
  title: string;
  subject?: string;
  credits: number;
  difficulty_level?: string;
  time_slots: string;
  prerequisites?: string[];
  career_paths?: string[];
  technical_level?: string;
};

export type Student = {
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