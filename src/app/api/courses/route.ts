import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * GET /api/courses
 * Fetch courses with optional filtering
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const subject = url.searchParams.get("subject");
    const semester = url.searchParams.get("semester");
    const credits = url.searchParams.get("credits");
    const learningMode = url.searchParams.get("learning_mode");
    const isElective = url.searchParams.get("is_elective");
    const search = url.searchParams.get("search");
    
    const supabase = await createClient();
    
    // Start with a base query
    let query = supabase
      .from("courses")
      .select("*");
    
    // Apply filters if provided
    if (subject) {
      query = query.eq("subject", subject);
    }
    
    if (semester) {
      query = query.eq("semester", semester);
    }
    
    if (credits) {
      query = query.eq("credits", parseInt(credits));
    }
    
    if (learningMode) {
      query = query.eq("learning_mode", learningMode);
    }
    
    if (isElective) {
      query = query.eq("is_elective", isElective === "true");
    }
    
    // Apply search if provided
    if (search) {
      // First sanitize the search term
      const sanitizedSearch = search.replace(/[%_]/g, ''); // Remove special characters
      
      if (sanitizedSearch) {
        // Use textSearch() for better pattern handling
        query = query.textSearch('title', sanitizedSearch, {
          type: 'plain',
          config: 'english'
        });
      }
    }
    
    // Execute the query
    const { data, error } = await query;
    
    if (error) {
      console.error("Error fetching courses:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // Process the data to handle JSON fields correctly
    const processedData = data?.map(course => {
      // Ensure time_slots is an array
      let timeSlots = course.time_slots;
      
      // If time_slots is a string, try to parse it as JSON
      if (typeof timeSlots === 'string') {
        try {
          timeSlots = JSON.parse(timeSlots);
        } catch (e) {
          // If parsing fails, wrap it in an array
          timeSlots = [timeSlots];
        }
      } 
      // If time_slots is null or undefined, make it an empty array
      else if (!timeSlots) {
        timeSlots = [];
      }
      
      return {
        ...course,
        time_slots: timeSlots
      };
    });
    
    return NextResponse.json({ courses: processedData || [] });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 