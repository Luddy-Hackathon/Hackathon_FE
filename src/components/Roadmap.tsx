import { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { CheckCircle2, Circle, ArrowRight, GraduationCap, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/lib/supabase";

interface Course {
  id: string;
  name: string;
  title: string;
  description: string;
  credits: number;
  prerequisites: string[];
  path: string;
  term?: string;
  isCompleted?: boolean;
  isCurrent?: boolean;
}

interface CareerMilestone {
  title: string;
  description: string;
  courses: string[];
  progress: number;
}

interface RoadmapProps {
  careerGoal: string;
  currentCourses: string[];
  creditsCompleted: number;
}

const Roadmap: React.FC<RoadmapProps> = ({ careerGoal, currentCourses, creditsCompleted }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [careerMilestones, setCareerMilestones] = useState<CareerMilestone[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const generateRoadmap = async () => {
      if (!careerGoal) return;

      setLoading(true);
      setError(null);

      try {
        // Fetch all courses from the database
        const { data: allCourses, error: coursesError } = await supabase
          .from('courses')
          .select('*');

        if (coursesError) throw coursesError;

        // Initialize Gemini
        const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');
        const model = genAI.getGenerativeModel({ model: process.env.NEXT_PUBLIC_GEMINI_MODEL || 'gemini-1.5-flash' });

        // Generate career milestones using actual course names
        const milestonesPrompt = `Create career milestones for a student pursuing ${careerGoal}.
        Use ONLY these available courses: ${allCourses.map(c => c.name).join(', ')}.
        Format as JSON array:
        [
          {
            "title": "milestone_title",
            "description": "milestone_description",
            "courses": ["course_name1", "course_name2"]
          }
        ]`;

        const milestonesResult = await model.generateContent(milestonesPrompt);
        const milestonesResponse = await milestonesResult.response;
        const milestonesText = milestonesResponse.text()
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim();
        
        const parsedMilestones = JSON.parse(milestonesText);
        setCareerMilestones(parsedMilestones);

        // Generate course roadmap using actual courses
        const roadmapPrompt = `Create a detailed 4-year course roadmap for a student pursuing a career in ${careerGoal}. 
        The student has completed ${creditsCompleted} credits and is currently taking: ${currentCourses.join(', ')}.
        Use ONLY these available courses: ${allCourses.map(c => c.name).join(', ')}.
        Format as JSON array:
        [
          {
            "name": "course_name",
            "term": "semester_year",
            "isCompleted": boolean,
            "isCurrent": boolean
          }
        ]`;

        const roadmapResult = await model.generateContent(roadmapPrompt);
        const roadmapResponse = await roadmapResult.response;
        const roadmapText = roadmapResponse.text()
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim();
        
        const recommendedCourses = JSON.parse(roadmapText);
        
        // Map recommended courses to actual course data
        const mappedCourses = recommendedCourses.map((recCourse: any) => {
          const actualCourse = allCourses.find(c => c.name === recCourse.name);
          if (!actualCourse) return null;
          
          return {
            ...actualCourse,
            term: recCourse.term,
            isCompleted: recCourse.isCompleted,
            isCurrent: recCourse.isCurrent
          };
        }).filter(Boolean);

        setCourses(mappedCourses);
      } catch (err) {
        setError('Failed to generate roadmap. Please try again.');
        console.error('Error generating roadmap:', err);
      } finally {
        setLoading(false);
      }
    };

    generateRoadmap();
  }, [careerGoal, currentCourses, creditsCompleted]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <div className="text-red-600 mb-4">{error}</div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-12">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">Your Career Journey</h1>
        <p className="text-xl text-gray-600">Progressing towards becoming a {careerGoal}</p>
      </div>

      {/* Progress Overview */}
      <Card className="bg-gradient-to-br from-white to-gray-50 border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Total Credits</p>
              <p className="text-3xl font-bold text-gray-900">{creditsCompleted}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Current Courses</p>
              <p className="text-3xl font-bold text-gray-900">{currentCourses.length}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Career Progress</p>
              <Progress value={33} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Career Milestones */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
          <Target className="h-6 w-6 text-indigo-600" />
          Career Progression
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {careerMilestones.map((milestone, index) => (
            <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                    <span className="text-indigo-600 font-bold">{index + 1}</span>
                  </div>
                  <CardTitle className="text-lg">{milestone.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">{milestone.description}</p>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-500">Required Courses</p>
                  <div className="flex flex-wrap gap-2">
                    {milestone.courses.map((course, idx) => (
                      <Badge key={idx} variant="secondary" className="bg-gray-100 text-gray-800">
                        {course}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Course Timeline */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-indigo-600" />
          Course Timeline
        </h2>
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
          <div className="space-y-8 pl-8">
            {courses.map((course, index) => (
              <Card
                key={course.name || index}
                className={`relative border-0 shadow-lg hover:shadow-xl transition-all duration-300 ${
                  course.isCurrent ? 'border-2 border-indigo-500' : ''
                }`}
              >
                <div className="absolute left-0 top-0 w-4 h-4 rounded-full -ml-2 ${
                  course.isCompleted ? 'bg-green-500' : 
                  course.isCurrent ? 'bg-indigo-500' : 'bg-gray-300'
                }">
                  {course.isCompleted && <CheckCircle2 className="w-4 h-4 text-white" />}
                  {course.isCurrent && <Circle className="w-4 h-4 text-white" />}
                </div>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{course.title}</h3>
                        {course.isCompleted && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">Completed</Badge>
                        )}
                        {course.isCurrent && (
                          <Badge variant="secondary" className="bg-indigo-100 text-indigo-800">Current</Badge>
                        )}
                      </div>
                      <p className="text-sm text-indigo-600 mb-2">{course.term}</p>
                      <p className="text-gray-600 mb-4">{course.description}</p>
                      {course.prerequisites && course.prerequisites.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-gray-500">Prerequisites</p>
                          <div className="flex flex-wrap gap-2">
                            {course.prerequisites.map((prereq, idx) => (
                              <Badge key={idx} variant="outline">
                                {prereq}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <Badge variant="secondary" className="bg-indigo-100 text-indigo-800">
                      {course.credits} credits
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Roadmap; 