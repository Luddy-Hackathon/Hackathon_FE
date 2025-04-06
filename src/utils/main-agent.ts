import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildSystemPrompt, getRelevantKnowledge } from './promptBuilder';
import { saveChatMessage, type ChatMessage } from './chatHistory';
import { v4 as uuidv4 } from 'uuid';
import { buildAdvisorPrompt, type Student, type Course, type Prerequisite } from './advisorPromptBuilder';
import supabaseClient from './supabaseClient';

// Initialize AI client with Gemini model
const ai = new GoogleGenerativeAI(process.env.OPENAI_API_KEY || '');

// Default model to use - Gemini 1.5 Flash
const DEFAULT_MODEL = 'gemini-1.5-flash';

// Get model instance
const model = ai.getGenerativeModel({ model: DEFAULT_MODEL });

export interface ChatRequest {
  message: string;
  sessionId?: string;
  username?: string;
  userId?: string;
  projectContext?: string;
  history?: ChatMessage[];
  useAdvisorMode?: boolean;
}

export interface ChatResponse {
  answer: string;
  sessionId: string;
}

/**
 * Process a chat message and get a response from the AI
 */
export async function processChatMessage(request: ChatRequest): Promise<ChatResponse> {
  try {
    // Generate a session ID if not provided
    const sessionId = request.sessionId || uuidv4();
    
    // Get chat history or use the provided history
    const history = request.history || [];
    
    let systemPrompt: string;
    
    // Check if advisor mode is requested
    if (request.useAdvisorMode) {
      try {
        console.log("Fetching data for advisor mode...");
        
        // Fetch student data from Supabase using userId
        let student: Student | null = null;
        let courses: Course[] = [];
        let prerequisites: Prerequisite[] = [];
        
        if (request.userId) {
          console.log("Fetching student with user_id:", request.userId);
          
          // Fetch student data - match with user_id field from the students table
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
            .eq('user_id', request.userId)
            .single();
          
          if (studentError) {
            console.error("Error fetching student data:", studentError);
          }
          
          if (studentData) {
            console.log("Found student data:", studentData);
            
            // Transform to match our interface
            student = {
              career_goal_id: studentData.career_goal_id,
              preferred_subjects: studentData.preferred_subjects,
              weekly_study_availability: studentData.weekly_study_availability,
              preferred_learning_mode: studentData.preferred_learning_mode,
              current_courses_taken: studentData.current_courses_taken,
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
          }
          
          // Fetch courses data - get ALL courses without limits
          console.log("Fetching courses data");
          const { data: coursesData, error: coursesError } = await supabaseClient
            .from('courses')
            .select(`
              id,
              title,
              description,
              credits,
              subject,
              semester
            `);
            
          if (coursesError) {
            console.error("Error fetching courses data:", coursesError);
          }
          
          if (coursesData && coursesData.length > 0) {
            console.log(`Found ${coursesData.length} courses`);
            
            // Transform to match our interface - include all courses
            courses = coursesData.map(course => ({
              id: course.id,
              title: course.title,
              credits: course.credits,
              description: course.description,
              subject: course.subject,
              semester: course.semester
            }));
          }
          
          // Fetch prerequisites data
          console.log("Fetching prerequisites data");
          const { data: prerequisiteData, error: prerequisiteError } = await supabaseClient
            .from('prerequisites')
            .select(`
              id,
              course_id,
              prerequisite_id
            `);
            
          if (prerequisiteError) {
            console.error("Error fetching prerequisites data:", prerequisiteError);
          }
          
          if (prerequisiteData && prerequisiteData.length > 0) {
            console.log(`Found ${prerequisiteData.length} prerequisites`);
            
            // Transform to match our interface
            prerequisites = prerequisiteData.map(prereq => ({
              course_id: prereq.course_id,
              prerequisite_id: prereq.prerequisite_id,
            }));
          }
        }
        
        // Check if we have the required data
        if (student && courses.length > 0) {
          console.log("Using advisor mode with student data and courses");
          
          // Build advisor prompt with fetched data
          systemPrompt = buildAdvisorPrompt(student, courses, prerequisites);
        } else {
          console.warn('Missing student data or courses for advisor mode, reverting to standard mode');
          throw new Error("Incomplete data for advisor mode");
        }
      } catch (error) {
        console.warn('Error in advisor mode setup, reverting to standard mode:', error);
        
        // Use regular prompt builder as fallback
        const relevantKnowledge = await getRelevantKnowledge(request.message);
        const additionalInstructions = relevantKnowledge 
          ? `Use the following knowledge to help answer the user's question:\n${relevantKnowledge}`
          : undefined;
        
        systemPrompt = await buildSystemPrompt({
          username: request.username,
          projectContext: request.projectContext,
          additionalInstructions,
        });
      }
    } else {
      // Standard mode - use regular prompt builder
      const relevantKnowledge = await getRelevantKnowledge(request.message);
      const additionalInstructions = relevantKnowledge 
        ? `Use the following knowledge to help answer the user's question:\n${relevantKnowledge}`
        : undefined;
      
      systemPrompt = await buildSystemPrompt({
        username: request.username,
        projectContext: request.projectContext,
        additionalInstructions,
      });
    }
    
    // Prepare messages for Gemini API
    const chatHistory = [];
    
    // Add chat history
    for (const msg of history) {
      chatHistory.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      });
    }
    
    console.log(`Calling AI API with model: ${process.env.AI_MODEL || DEFAULT_MODEL}`);
    
    // Start with an empty chat without system instruction
    const chat = model.startChat({
      history: chatHistory,
    });
    
    // Add instructions for conversational responses
    const briefingPrefix = "Respond conversationally to the user's specific question. Be personable but relatively concise (under 150 words when possible).";
    
    // Add the user's current message with brief instruction
    const messageWithContext = `${briefingPrefix}\n\n${systemPrompt}\n\nUser query: ${request.message}`;
    const result = await chat.sendMessage(messageWithContext);
    const answer = result.response.text();
    
    // Save the user message to history
    saveChatMessage({
      sessionId,
      role: 'user',
      content: request.message,
    });
    
    // Save the AI response to history
    saveChatMessage({
      sessionId,
      role: 'assistant',
      content: answer,
    });
    
    return {
      answer,
      sessionId,
    };
  } catch (error) {
    console.error('Error in processChatMessage:', error);
    throw new Error('Failed to process chat message');
  }
} 