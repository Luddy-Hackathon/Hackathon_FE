"use client";

import dynamic from "next/dynamic";
import { Course, Student } from '@/types';

// Dynamically import the ChatAssistant with no SSR
const DynamicChatAssistant = dynamic(
  () => import("@/components/chat/ChatAssistant"),
  { ssr: false }
);

type ClientChatAssistantProps = {
  student: Student;
  courses: Course[];
  onRecommendationsUpdate?: (recommendations: number[]) => void;
  onPreferencesUpdate?: (preferences: any) => void;
};

export default function ClientChatAssistant({ 
  student, 
  courses,
  onRecommendationsUpdate,
  onPreferencesUpdate 
}: ClientChatAssistantProps) {
  return (
    <DynamicChatAssistant
      student={student}
      courses={courses}
      onRecommendationsUpdate={onRecommendationsUpdate}
      onPreferencesUpdate={onPreferencesUpdate}
    />
  );
}
