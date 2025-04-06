export interface Student {
  career_goal_id?: string; // This will store the career title after fetching from careers table
  preferred_subjects?: string[];
  weekly_study_availability?: {
    hours?: number;
    [key: string]: any; // Allow for additional properties in the jsonb structure
  };
  preferred_learning_mode?: string;
  current_courses_taken?: string[];
  technical_proficiency?: string;
  credits_completed?: number;
  enrollment_type?: string;
}

export interface Course {
  id: string;
  title: string;
  credits: number;
  description: string;
  subject?: string;
  semester?: string;
}

export interface Prerequisite {
  course_id: string;
  prerequisite_id: string;
}

/**
 * Build a specialized prompt for university course advising
 * Optimized for complete data access and proper exploration
 */
export function buildAdvisorPrompt(student: Student, courses: Course[], prerequisites: Prerequisite[]): string {
  console.log("Building advisor prompt with", courses.length, "courses and", prerequisites.length, "prerequisites");
  
  // Format student profile information with all details
  const profile = `Career Goal: ${student.career_goal_id || "N/A"}
Subjects: ${student.preferred_subjects?.join(", ") || "N/A"}
Study Time: ${student.weekly_study_availability?.hours || "N/A"} hrs
Learning Mode: ${student.preferred_learning_mode || "Any"}
Current Courses: ${student.current_courses_taken?.join(", ") || "None"}
Credits: ${student.credits_completed || 0}
Proficiency: ${student.technical_proficiency || "N/A"}
Enrollment: ${student.enrollment_type || "N/A"}`;

  // Create comprehensive lookup maps for prerequisite resolution
  const prereqMap = new Map();
  prerequisites.forEach(p => {
    if (!prereqMap.has(p.course_id)) {
      prereqMap.set(p.course_id, []);
    }
    prereqMap.get(p.course_id).push(p.prerequisite_id);
  });
  
  const courseMap = new Map();
  courses.forEach(c => courseMap.set(c.id, c.title));

  // Format full course information with complete data
  const availableCourses = courses.map(course => {
    // Get prerequisites for this course using the map
    const prereqIds = prereqMap.get(course.id) || [];
    
    // Get prerequisite titles using the map
    const prereqTitles = prereqIds.map((id: string) => courseMap.get(id) || id);
    
    // Include full description without truncation
    return `- ${course.title} (${course.credits} cr): Subject: ${course.subject || "General"}, Semester: ${course.semester || "Any"} - Prerequisites: ${prereqTitles.length ? prereqTitles.join(", ") : "None"}\nDescription: ${course.description || "No description available"}`;
  }).join("\n\n");

  // Build a prompt that encourages the model to explore all available data
  return `You are a friendly and knowledgeable university course advisor chatbot. Your job is to guide students based on their goals, interests, time availability, and past experience. Your responses should be tailored to the specific needs and questions of each student.

Here is the student's complete profile:
${profile}

Here is the complete course catalog with ${courses.length} courses:
${availableCourses}

You have access to ALL available courses and prerequisites in the database. Use this complete information to provide accurate and personalized guidance.

✅ Response Guidelines:
1. Always address the student's specific question directly.
2. When discussing courses, reference specific courses from the catalog by name.
3. When making recommendations, explain why those specific courses are suitable based on the student's profile.
4. Consider prerequisites when suggesting courses - check if the student has completed necessary prerequisites.
5. Make full use of the complete course catalog data to find the best matches.
6. If the student is asking about a specific course, provide detailed information about that course.
7. Be helpful, conversational, and provide personalized guidance based on ALL available data.

Remember: You have complete access to the student's profile and the entire course catalog. Use this comprehensive information to provide the most accurate and helpful responses.`;
}