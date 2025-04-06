"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth/AuthProvider";
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

// Simple interface for filter parameters
interface Filters {
  subject?: string;
  semester?: string;
  credits?: number;
  learning_mode?: string;
  is_elective?: boolean;
  search?: string;
}

export default function CoursesPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({});
  const [searchTerm, setSearchTerm] = useState("");
  
  // Subjects, semesters, and learning modes for filter options
  const [subjects, setSubjects] = useState<string[]>([]);
  const [semesters, setSemesters] = useState<string[]>([]);
  const [learningModes, setLearningModes] = useState<string[]>([]);
  
  // Load courses on initial render and when filters change
  useEffect(() => {
    const loadCourses = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Start with a base query
        let query = supabase
          .from("courses")
          .select("*");
        
        // Apply filters if provided
        if (filters.subject && filters.subject !== "all_subjects") {
          query = query.eq("subject", filters.subject);
        }
        
        if (filters.semester && filters.semester !== "all_semesters") {
          query = query.eq("semester", filters.semester);
        }
        
        if (filters.credits && filters.credits !== 0) {
          query = query.eq("credits", filters.credits);
        }
        
        if (filters.learning_mode && filters.learning_mode !== "all_modes") {
          query = query.eq("learning_mode", filters.learning_mode);
        }
        
        if (filters.is_elective !== undefined) {
          query = query.eq("is_elective", filters.is_elective);
        }
        
        if (filters.search) {
          // For basic search, we'll use ilike which is less prone to pattern matching errors
          const safeSearch = filters.search.replace(/[%_]/g, ''); // Remove special characters
          if (safeSearch) {
            query = query.ilike('title', `%${safeSearch}%`);
          }
        }
        
        const { data, error } = await query;
        
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
        
        setCourses(processedData);
        
        // Extract unique filter options from courses
        const uniqueSubjects = [...new Set(data?.map((c: Course) => c.subject))] as string[];
        const uniqueSemesters = [...new Set(data?.map((c: Course) => c.semester))] as string[];
        const uniqueLearningModes = [...new Set(data?.map((c: Course) => c.learning_mode))] as string[];
        
        setSubjects(uniqueSubjects);
        setSemesters(uniqueSemesters);
        setLearningModes(uniqueLearningModes);
      } catch (err) {
        console.error("Error fetching courses:", err);
        setError("Failed to load courses. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    
    loadCourses();
  }, [filters]);
  
  // Apply search filter
  const handleSearch = () => {
    setFilters(prev => ({
      ...prev,
      search: searchTerm
    }));
  };
  
  // Reset all filters
  const resetFilters = () => {
    setFilters({});
    setSearchTerm("");
  };
  
  // Update a specific filter
  const updateFilter = (key: keyof Filters, value: any) => {
    // Handle special "all_*" values which should clear the filter
    if (value === "all_subjects" || value === "all_semesters" || 
        value === "all_modes" || value === "all_credits" || value === "all_types") {
      // Clear this specific filter
      setFilters(prev => {
        const newFilters = { ...prev };
        delete newFilters[key];
        return newFilters;
      });
      return;
    }
    
    // For credits, parse as number
    if (key === 'credits' && value) {
      value = parseInt(value);
    }
    
    // For is_elective, convert to boolean
    if (key === 'is_elective') {
      value = value === "true";
    }
    
    // Set the filter value
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };
  
  // Format keywords as an array
  const getKeywords = (keywords: string | null | undefined) => {
    if (!keywords) return [];
    return typeof keywords === 'string' 
      ? keywords.split(',').map(k => k.trim()) 
      : [];
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Course Catalog</h1>
      
      {/* Search and filters */}
      <div className="grid gap-4 mb-8 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Search</label>
          <div className="flex">
            <Input 
              placeholder="Search courses..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-r-none"
            />
            <Button 
              onClick={handleSearch}
              className="rounded-l-none"
            >
              Search
            </Button>
          </div>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Subject</label>
          <Select 
            value={filters.subject || "all_subjects"} 
            onValueChange={(value) => updateFilter('subject', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Subjects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_subjects">All Subjects</SelectItem>
              {subjects.map((subject) => (
                <SelectItem key={subject} value={subject}>{subject}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Semester</label>
          <Select 
            value={filters.semester || "all_semesters"} 
            onValueChange={(value) => updateFilter('semester', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Semesters" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_semesters">All Semesters</SelectItem>
              {semesters.map((semester) => (
                <SelectItem key={semester} value={semester}>{semester}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Learning Mode</label>
          <Select 
            value={filters.learning_mode || "all_modes"} 
            onValueChange={(value) => updateFilter('learning_mode', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Modes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_modes">All Modes</SelectItem>
              {learningModes.map((mode) => (
                <SelectItem key={mode} value={mode}>{mode}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Credits</label>
          <Select 
            value={filters.credits?.toString() || "all_credits"} 
            onValueChange={(value) => updateFilter('credits', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Any Credits" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_credits">Any Credits</SelectItem>
              <SelectItem value="1">1 Credit</SelectItem>
              <SelectItem value="2">2 Credits</SelectItem>
              <SelectItem value="3">3 Credits</SelectItem>
              <SelectItem value="4">4 Credits</SelectItem>
              <SelectItem value="5">5+ Credits</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Course Type</label>
          <Select 
            value={filters.is_elective !== undefined 
              ? filters.is_elective.toString() 
              : "all_types"} 
            onValueChange={(value) => updateFilter('is_elective', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Courses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_types">All Courses</SelectItem>
              <SelectItem value="true">Electives Only</SelectItem>
              <SelectItem value="false">Required Courses</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-end">
          <Button 
            variant="outline" 
            onClick={resetFilters}
            className="w-full"
          >
            Reset Filters
          </Button>
        </div>
      </div>
      
      {/* Loading and error states */}
      {loading && (
        <div className="text-center py-8">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading courses...</p>
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {/* Course list */}
      {!loading && !error && (
        <>
          <div className="mb-4">
            <p className="text-gray-600">Showing {courses.length} course{courses.length !== 1 ? 's' : ''}</p>
          </div>
          
          {courses.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-500">No courses match your filters. Try adjusting your search criteria.</p>
              <Button 
                variant="link" 
                onClick={resetFilters}
                className="mt-2"
              >
                Reset all filters
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
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
                      <div>
                        <span className="font-medium">Available Slots:</span> {course.available_slots}
                      </div>
                    </div>
                    
                    {course.time_slots && course.time_slots.length > 0 && (
                      <div className="mt-3">
                        <p className="font-medium text-sm">Schedule:</p>
                        <ul className="list-disc list-inside text-sm text-gray-600">
                          {Array.isArray(course.time_slots) 
                            ? course.time_slots.map((slot, i) => <li key={i}>{slot}</li>)
                            : <li>{course.time_slots}</li>
                          }
                        </ul>
                      </div>
                    )}
                    
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
                  <CardFooter className="border-t pt-4">
                    <Button className="w-full">Enroll in Course</Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}