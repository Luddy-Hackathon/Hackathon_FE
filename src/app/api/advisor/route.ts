import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildAdvisorPrompt, type Student, type Course, type Prerequisite } from '@/utils/advisorPromptBuilder';
import { v4 as uuidv4 } from 'uuid';
import supabaseClient from '@/utils/supabaseClient';

export const runtime = 'edge';

// Default model to use - Gemini 1.5 Flash
const DEFAULT_MODEL = 'gemini-1.5-flash';

// Initialize AI client
const ai = new GoogleGenerativeAI(process.env.OPENAI_API_KEY || '');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, userQuery } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    console.log("Processing advisor request for user ID:", userId);

    // 1. Fetch student data from Supabase
    const { data: studentData, error: studentError } = await supabaseClient
      .from('students')
      .select(`
        id,
        user_id,
        full_name,
        email,
        career_goal_id,
        enrollment_type,
        credits_completed,
        preferred_subjects,
        preferred_learning_mode,
        current_courses_taken,
        weekly_study_availability,
        technical_proficiency
      `)
      .eq('user_id', userId)
      .single();

    if (studentError || !studentData) {
      console.error("Error or no data found:", studentError);
      return NextResponse.json(
        { error: 'Failed to fetch student data' },
        { status: 404 }
      );
    }

    console.log("Found student data:", studentData);

    // Transform student data to match our interface
    const student: Student = {
      career_goal_id: studentData.career_goal_id,
      preferred_subjects: studentData.preferred_subjects,
      weekly_study_availability: studentData.weekly_study_availability,
      preferred_learning_mode: studentData.preferred_learning_mode,
      current_courses_taken: studentData.current_courses_taken,
      technical_proficiency: studentData.technical_proficiency,
      credits_completed: studentData.credits_completed,
      enrollment_type: studentData.enrollment_type
    };

    // Get career name if available
    if (studentData.career_goal_id) {
      const { data: careerData } = await supabaseClient
        .from('careers')
        .select('title')
        .eq('id', studentData.career_goal_id)
        .single();
        
      if (careerData) {
        student.career_goal_id = careerData.title; // Use title instead of ID
      }
    }

    // 2. Fetch courses - get all courses for comprehensive data access
    console.log("Fetching courses data");
    let coursesQuery = supabaseClient
      .from('courses')
      .select(`
        id,
        title,
        description,
        credits,
        subject,
        semester
      `);
      
    // Get all courses but optimize by sorting relevant ones first
    let coursesData;
    if (student.preferred_subjects && student.preferred_subjects.length > 0) {
      // First get preferred subject courses
      const { data: preferredCourses, error: preferredError } = await coursesQuery
        .in('subject', student.preferred_subjects);
        
      if (preferredError) {
        console.error("Error fetching preferred courses:", preferredError);
        return NextResponse.json(
          { error: 'Failed to fetch courses data' },
          { status: 500 }
        );
      }
      
      // Then get all other courses
      const { data: otherCourses, error: otherError } = await supabaseClient
        .from('courses')
        .select(`
          id,
          title,
          description,
          credits,
          subject,
          semester
        `)
        .not('subject', 'in', student.preferred_subjects);
        
      if (otherError) {
        console.error("Error fetching other courses:", otherError);
        return NextResponse.json(
          { error: 'Failed to fetch courses data' },
          { status: 500 }
        );
      }
      
      // Combine with preferred subjects first
      coursesData = [...preferredCourses, ...otherCourses];
      console.log(`Found ${preferredCourses.length} preferred courses and ${otherCourses.length} other courses`);
    } else {
      // Get all courses if no preferred subjects
      const { data: allCourses, error: coursesError } = await coursesQuery;
      
      if (coursesError || !allCourses || allCourses.length === 0) {
        console.error("Error or no courses found:", coursesError);
        return NextResponse.json(
          { error: 'Failed to fetch courses data' },
          { status: 500 }
        );
      }
      
      coursesData = allCourses;
      console.log(`Found ${allCourses.length} courses`);
    }

    // Transform courses data
    const courses: Course[] = coursesData.map(course => ({
      id: course.id,
      title: course.title,
      credits: course.credits,
      description: course.description,
      subject: course.subject,
      semester: course.semester
    }));

    // 3. Fetch prerequisites for the selected courses only
    console.log("Fetching prerequisites data");
    const courseIds = courses.map(c => c.id);
    const { data: prerequisitesData, error: prerequisitesError } = await supabaseClient
      .from('prerequisites')
      .select(`
        id,
        course_id,
        prerequisite_id
      `)
      .in('course_id', courseIds); // Only get prerequisites for courses we're showing

    if (prerequisitesError) {
      console.error("Error fetching prerequisites:", prerequisitesError);
      return NextResponse.json(
        { error: 'Failed to fetch prerequisites data' },
        { status: 500 }
      );
    }

    // Transform prerequisites data
    const prerequisites: Prerequisite[] = prerequisitesData ? prerequisitesData.map(prereq => ({
      course_id: prereq.course_id,
      prerequisite_id: prereq.prerequisite_id
    })) : [];

    console.log(`Found ${prerequisites.length} prerequisites for selected courses`);
    console.log('CC',courses)
    // Build the specialized advisor prompt
    const prompt = buildAdvisorPrompt(student, courses, prerequisites);

    // Get model instance
    const model = ai.getGenerativeModel({ model: process.env.AI_MODEL || DEFAULT_MODEL });

    // Call AI API using Google Gemini
    console.log(`Calling AI API with model: ${process.env.AI_MODEL || DEFAULT_MODEL}`);
    
    // Create a prompt that encourages the model to explore all data
    const userPrompt = `The user is asking: "${userQuery || 'What courses should I take next semester?'}"

You have access to the complete student profile and course catalog. Use all available data to provide 
the most accurate and helpful response to the user's specific query.

Guidelines:
- Respond directly to what the user is asking
- Consider ALL relevant courses in the database when forming your response
- You may reference specific course details, prerequisites, and student's profile information
- Be conversational and helpful
- When recommending courses, provide specific course names and rationales based on data
- Use your full knowledge of the complete course catalog`;

    // Prepare the contents for the model - using parts to separate context from query
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { text: userPrompt }
          ]
        }
      ]
    });
    
    const response = result.response;
    const answer = response.text();

    return NextResponse.json({
      recommendations: answer,
      sessionId: uuidv4(),
    });
  } catch (error: any) {
    console.error('Error processing advisor request:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}