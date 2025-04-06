import OpenAI from "openai";
import { buildAdvisorPrompt } from "../utils/advisorPromptBuilder";
import type {
  Course,
  Prerequisite,
  Student,
} from "../utils/advisorPromptBuilder";
import supabaseClient from "../utils/supabaseClient";

/**
 * A standalone function that directly uses the OpenAI API to get course recommendations
 * This doesn't use the API routes and acts as a direct client
 */
export async function getAdvisorRecommendation(
  userId: string,
  question = "What courses should I take next semester?",
) {
  try {
    // Initialize OpenAI client with Azure endpoint
    const client = new OpenAI({
      baseURL:
        process.env.AI_ENDPOINT || "https://models.inference.ai.azure.com",
      apiKey: process.env.OPENAI_API_KEY || process.env.GITHUB_TOKEN,
    });

    // 1. Fetch student data
    const { data: studentData } = await supabaseClient
      .from("students")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!studentData) {
      throw new Error("Student data not found");
    }

    // Transform data to match our interface
    const student: Student = {
      career_goal_id: studentData.career_goal_id,
      preferred_subjects: studentData.preferred_subjects,
      weekly_study_availability: { hours: studentData.weekly_study_hours },
      preferred_learning_mode: studentData.preferred_learning_mode,
      current_courses_taken: studentData.completed_courses,
    };

    // 2. Fetch courses & prerequisites
    const { data: courses } = await supabaseClient.from("courses").select("*");

    if (!courses || courses.length === 0) {
      throw new Error("No courses found");
    }

    const { data: prerequisites } = await supabaseClient
      .from("prerequisites")
      .select("*");

    // 3. Build the personalized prompt
    const systemPrompt = buildAdvisorPrompt(
      student,
      courses as Course[],
      (prerequisites as Prerequisite[]) || [],
    );

    // 4. Ask gpt-4o-mini
    const response = await client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
      temperature: 0.8,
      top_p: 1.0,
      max_tokens: 1200,
      model: process.env.AI_MODEL || "gpt-4o-mini",
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error("Error in advisor recommendation:", error);
    throw error;
  }
}

// Usage example:
// import { getAdvisorRecommendation } from './standalone-advisor';
//
// async function example() {
//   try {
//     const recommendation = await getAdvisorRecommendation('user-123');
//     console.log('Recommendation:', recommendation);
//   } catch (error) {
//     console.error('Error:', error);
//   }
// }
//
// example();
