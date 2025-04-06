// context/RecommendationsContext.tsx
"use client";
import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Course } from '@/types';
import { useAuth } from '@/components/auth/AuthProvider';

export type CourseRecommendation = {
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
};

interface RecommendationsContextType {
  recommendations: CourseRecommendation[];
  setRecommendations: (recommendations: CourseRecommendation[]) => void;
  updateRecommendations: CourseRecommendation[];
  setUpdateRecommendations: (recommendations: CourseRecommendation[]) => void;
  applyUpdateRecommendations: (immediateRecommendations?: CourseRecommendation[]) => void;
  courses: Course[];
  setCourses: (courses: Course[]) => void;
  recommendationsLoaded: boolean;
}

const RecommendationsContext = createContext<RecommendationsContextType | undefined>(undefined);

export function RecommendationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<CourseRecommendation[]>([]);
  const [updateRecommendations, setUpdateRecommendations] = useState<CourseRecommendation[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [recommendationsLoaded, setRecommendationsLoaded] = useState(false);

  // Load recommendations from localStorage on initial mount
  useEffect(() => {
    if (user?.id) {
      console.log('RecommendationsContext: Checking for stored recommendations');
      try {
        const key = `user-recommendations-${user.id}`;
        console.log(`RecommendationsContext: Looking for key: ${key}`);
        const storedRecommendations = localStorage.getItem(key);
        
        if (storedRecommendations) {
          console.log('RecommendationsContext: Found stored recommendations, parsing...');
          const parsedRecommendations = JSON.parse(storedRecommendations);
          if (Array.isArray(parsedRecommendations) && parsedRecommendations.length > 0) {
            console.log(`RecommendationsContext: Loading ${parsedRecommendations.length} recommendations from localStorage`);
            setRecommendations(parsedRecommendations);
          } else {
            console.log('RecommendationsContext: Stored recommendations invalid or empty, starting fresh');
          }
        } else {
          console.log('RecommendationsContext: No stored recommendations found');
        }
      } catch (error) {
        console.error('Error loading recommendations from localStorage:', error);
      } finally {
        // Mark recommendations as loaded, regardless of whether we found any
        console.log('RecommendationsContext: Marking recommendations as loaded');
        setRecommendationsLoaded(true);
      }
    } else {
      console.log('RecommendationsContext: No user ID available, cannot load recommendations');
    }
  }, [user?.id]);

  // Save recommendations to localStorage whenever they change
  useEffect(() => {
    if (user?.id && recommendations.length > 0) {
      try {
        const key = `user-recommendations-${user.id}`;
        localStorage.setItem(key, JSON.stringify(recommendations));
        console.log('RecommendationsContext: Saved recommendations to localStorage');
      } catch (error) {
        console.error('Error saving recommendations to localStorage:', error);
      }
    }
  }, [user?.id, recommendations]);

  // Custom setter for recommendations to ensure proper persistence
  const handleSetRecommendations = (newRecommendations: CourseRecommendation[]) => {
    setRecommendations(newRecommendations);
    
    // We don't need to save to localStorage here as the effect above will handle it
  };

  const applyUpdateRecommendations = (immediateRecommendations?: CourseRecommendation[]) => {
    // If immediateRecommendations is provided, use that instead of the state
    // This allows for immediate updates without state timing issues
    if (immediateRecommendations && immediateRecommendations.length > 0) {
      setRecommendations(immediateRecommendations);
      console.log('RecommendationsContext: Applied immediate recommendations update');
      return;
    }
    
    // Otherwise, use the updateRecommendations state as before
    if (updateRecommendations.length > 0) {
      setRecommendations(updateRecommendations);
      setUpdateRecommendations([]);
      console.log('RecommendationsContext: Applied pending recommendations update');
      
      // We don't need to save to localStorage here as the effect above will handle it
    }
  };

  return (
    <RecommendationsContext.Provider 
      value={{ 
        recommendations, 
        setRecommendations: handleSetRecommendations,
        updateRecommendations,
        setUpdateRecommendations,
        applyUpdateRecommendations,
        courses,
        setCourses,
        recommendationsLoaded
      }}
    >
      {children}
    </RecommendationsContext.Provider>
  );
}

export function useRecommendations() {
  const context = useContext(RecommendationsContext);
  if (context === undefined) {
    throw new Error('useRecommendations must be used within a RecommendationsProvider');
  }
  return context;
}