"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface Course {
  id: number;
  title: string;
  instructor: string;
  description: string;
  subject: string;
  credits: number;
  semester: string;
  available_slots: number;
  time_slots: string[];
  is_elective: boolean;
  learning_mode: string;
  keywords: string;
}

export default function Home() {
  const { user } = useAuth();
  const [recommendedCourses, setRecommendedCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadRecommendedCourses = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Query courses directly from Supabase
        const { data, error } = await supabase
          .from("courses")
          .select("*")
          .order('id', { ascending: false })
          .limit(4);
        
        if (error) {
          throw new Error(error.message);
        }
        
        // Process data to ensure time_slots is handled correctly
        const processedData = (data || []).map(course => {
          // Handle time_slots conversion from string or JSON
          let timeSlots = course.time_slots || [];
          
          if (typeof timeSlots === 'string') {
            try {
              timeSlots = JSON.parse(timeSlots);
            } catch (e) {
              timeSlots = [timeSlots];
            }
          } else if (!Array.isArray(timeSlots)) {
            // If it's not an array or a string, make it an empty array
            timeSlots = [];
          }
          
          return {
            ...course,
            time_slots: timeSlots
          };
        });
        
        setRecommendedCourses(processedData);
      } catch (err) {
        console.error("Error fetching recommended courses:", err);
        setError("Failed to load course recommendations. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    
    loadRecommendedCourses();
  }, []);
  
  // Format keywords as an array
  const getKeywords = (keywords: string | null | undefined) => {
    if (!keywords) return [];
    return typeof keywords === 'string' 
      ? keywords.split(',').map(k => k.trim()) 
      : [];
  };

  return (
    <div className="container mx-auto p-6 pt-4 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Course Recommendations</h1>
        <Link href="/courses">
          <Button variant="outline">View All Courses</Button>
        </Link>
      </div>

      {loading && (
        <div className="text-center py-8">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading course recommendations...</p>
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {!loading && !error && (
        <>
          {recommendedCourses.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-500">No course recommendations available. Please complete your profile to get personalized recommendations.</p>
              <Link href="/profile">
                <Button className="mt-4">Complete Your Profile</Button>
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {recommendedCourses.map((course) => (
                <Card key={course.id} className="h-full flex flex-col">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-xl">{course.title}</CardTitle>
                        <CardDescription>{course.instructor}</CardDescription>
                      </div>
                      <Badge variant={course.is_elective ? "outline" : "default"}>
                        {course.is_elective ? "Elective" : "Required"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-gray-600 mb-4">{course.description}</p>
                    
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div>
                        <span className="font-medium">Subject:</span> {course.subject}
                      </div>
                      <div>
                        <span className="font-medium">Credits:</span> {course.credits}
                      </div>
                      <div>
                        <span className="font-medium">Semester:</span> {course.semester}
                      </div>
                      <div>
                        <span className="font-medium">Mode:</span> {course.learning_mode}
                      </div>
                    </div>
                    
                    {course.keywords && (
                      <div className="mt-4 flex flex-wrap gap-1">
                        {getKeywords(course.keywords).map((keyword, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          
          <div className="mt-8 text-center">
            <p className="text-gray-600 mb-3">Looking for more course options?</p>
            <Link href="/courses">
              <Button>Browse All Courses</Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
