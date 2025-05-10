import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";



export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    
    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }
    
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .eq("user_id", userId)
      .single();
    
    if (error) {
      console.error("Error fetching profile:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ profile: data });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const data = await request.json();

    // Validate required fields
    if (!data.user_id) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    // Required fields validation
    const requiredFields = ['full_name', 'email', 'career_goal_id', 'enrollment_type'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Format and clean up the data before saving
    const cleanedData = { ...data };

    // Ensure arrays are properly initialized and formatted as JSON strings
    const arrayFields = ['preferred_subjects', 'skill_goals', 'current_courses_taken'];
    arrayFields.forEach(field => {
      // Check if field exists
      if (field in cleanedData) {
        // Ensure it's an array
        if (!Array.isArray(cleanedData[field])) {
          // If it's a single value, convert to array
          cleanedData[field] = [cleanedData[field]].filter(Boolean);
        }
        // Make sure array is not empty or contains only empty values
        cleanedData[field] = cleanedData[field].filter((item: string | any) => item && typeof item === 'string' && item.trim() !== "");
      } else {
        // Default to empty array
        cleanedData[field] = [];
      }
    });

    // Convert numeric string fields to numbers
    ['credits_completed', 'weekly_study_availability'].forEach(field => {
      if (field in cleanedData && typeof cleanedData[field] === 'string') {
        const numValue = parseFloat(cleanedData[field]);
        if (!isNaN(numValue)) {
          cleanedData[field] = numValue;
        }
      }
    });

    // Ensure string fields have valid values
    const stringFields = [
      'full_name', 'email', 'career_goal_id', 'enrollment_type', 
      'course_slot_preference', 'target_graduation_term', 'preferred_learning_mode',
      'learning_style', 'preferred_difficulty_level', 'technical_proficiency',
      'internship_ready'
    ];

    stringFields.forEach(field => {
      if (field in cleanedData && typeof cleanedData[field] === 'string') {
        // Trim and validate
        cleanedData[field] = cleanedData[field].trim();
        // If empty after trimming, remove the field
        if (cleanedData[field] === '') {
          delete cleanedData[field];
        }
      }
    });

    console.log("Sanitized profile data:", cleanedData);

    // Insert the profile data
    const { error } = await supabase.from("students").insert([cleanedData]);

    if (error) {
      console.error("Error inserting profile:", error);
      // Handle specific database errors
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json(
          { error: "A profile for this user already exists" },
          { status: 409 }
        );
      }
      
      // Pattern matching error often shows in the message
      if (error.message && error.message.includes("pattern")) {
        return NextResponse.json(
          { error: "Invalid data format: " + error.message },
          { status: 400 }
        );
      }
      
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected error in profile creation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 