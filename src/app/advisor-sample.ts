import { Student, Course, Prerequisite } from '@/utils/advisorPromptBuilder';

// Sample student data
const sampleStudent: Student = {
  career_goal_id: "Software Engineer",
  preferred_subjects: ["Computer Science", "Mathematics", "Data Science"],
  weekly_study_availability: { hours: 20 },
  preferred_learning_mode: "Online",
  current_courses_taken: ["Introduction to Programming", "Calculus I"]
};

// Sample courses
const sampleCourses: Course[] = [
  {
    id: "CS101",
    title: "Introduction to Computer Science",
    credits: 3,
    description: "A foundational course covering basic computing concepts, algorithms, and programming principles."
  },
  {
    id: "CS201",
    title: "Data Structures and Algorithms",
    credits: 4,
    description: "An intermediate course on efficient data organization and algorithm design techniques."
  },
  {
    id: "CS301",
    title: "Database Systems",
    credits: 3,
    description: "Introduction to database design, SQL, normalization, and transaction management."
  },
  {
    id: "CS401",
    title: "Machine Learning",
    credits: 4,
    description: "A comprehensive study of statistical models, neural networks, and deep learning techniques."
  },
  {
    id: "MATH201",
    title: "Discrete Mathematics",
    credits: 3,
    description: "Mathematical structures and techniques essential for computer science and software engineering."
  },
  {
    id: "MATH301",
    title: "Linear Algebra",
    credits: 3,
    description: "Study of vector spaces, linear transformations, matrices, and their applications."
  },
  {
    id: "WEB101",
    title: "Web Development Fundamentals",
    credits: 3,
    description: "Introduction to HTML, CSS, JavaScript, and responsive web design principles."
  }
];

// Sample prerequisites
const samplePrerequisites: Prerequisite[] = [
  { course_id: "CS201", prerequisite_id: "CS101" },
  { course_id: "CS301", prerequisite_id: "CS201" },
  { course_id: "CS401", prerequisite_id: "CS201" },
  { course_id: "CS401", prerequisite_id: "MATH301" },
  { course_id: "MATH301", prerequisite_id: "MATH201" }
];

// Example of how to use the advisor API
async function getRecommendations(userId: string, userQuery?: string) {
  try {
    const response = await fetch('/api/advisor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        userQuery: userQuery || 'What courses should I take next semester?'
      }),
    });

    const data = await response.json();
    
    if (data.error) {
      console.error('Error:', data.error);
      return;
    }
    
    console.log('Recommendations:', data.recommendations);
    return data.recommendations;
  } catch (error) {
    console.error('Failed to get recommendations:', error);
  }
}

// Example of using the standard chat API with advisor mode
async function chatWithAdvisorMode(userId: string, message: string) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        userId,
        useAdvisorMode: true
      }),
    });

    const data = await response.json();
    
    if (data.error) {
      console.error('Error:', data.error);
      return;
    }
    
    console.log('Response:', data.answer);
    return data.answer;
  } catch (error) {
    console.error('Failed to chat:', error);
  }
}

export { getRecommendations, chatWithAdvisorMode };

// Sample usage:
// getRecommendations('user-123');
// chatWithAdvisorMode('user-123', 'Which math course should I take next?'); 