// Export the course availability utility function
import { supabase } from "@/lib/supabase";

// Utility to calculate course availability based on historical data
export async function getCourseAvailabilityData(courseIds: number[]): Promise<Record<number, number>> {
  try {
    // Skip if no course IDs provided
    if (!courseIds.length) return {};
    
    // Fetch course history data for these courses
    const { data, error } = await supabase
      .from('course_history')
      .select('*')
      .in('course_id', courseIds);
      
    if (error) {
      console.error('Error fetching course history:', error);
      return {};
    }
    
    // Group data by course_id
    const historyByCourseid: Record<number, any[]> = {};
    
    data.forEach(record => {
      const courseId = record.course_id;
      if (!historyByCourseid[courseId]) {
        historyByCourseid[courseId] = [];
      }
      historyByCourseid[courseId].push(record);
    });
    
    // Calculate availability score (0-1) for each course
    const availabilityScores: Record<number, number> = {};
    
    Object.entries(historyByCourseid).forEach(([courseId, history]) => {
      const numericId = Number(courseId);
      
      // If no history, assume high availability (0.8)
      if (!history.length) {
        availabilityScores[numericId] = 0.8;
        return;
      }
      
      // Sort by semester to get most recent first
      // Assuming semester format like "Fall 2023", "Spring 2024"
      const sortedHistory = [...history].sort((a, b) => {
        const yearA = parseInt(a.semester.match(/\d{4}/)?.[0] || '0');
        const yearB = parseInt(b.semester.match(/\d{4}/)?.[0] || '0');
        
        if (yearA !== yearB) return yearB - yearA;
        
        // If same year, sort by semester (Spring < Summer < Fall < Winter)
        const semesterOrder: Record<string, number> = { 'Spring': 0, 'Summer': 1, 'Fall': 2, 'Winter': 3 };
        const semesterA = a.semester.split(' ')[0] || '';
        const semesterB = b.semester.split(' ')[0] || '';
        const semA = semesterOrder[semesterA] ?? 0;
        const semB = semesterOrder[semesterB] ?? 0;
        
        return semB - semA;
      });
      
      // Calculate average fill rate with higher weight to recent semesters
      let totalWeight = 0;
      let weightedFillRate = 0;
      
      sortedHistory.forEach((record, index) => {
        if (record.filled_slots && record.max_capacity && record.max_capacity > 0) {
          const fillRate = record.filled_slots / record.max_capacity;
          // Weight decreases with older semesters (recency bias)
          const weight = 1 / (index + 1);
          weightedFillRate += fillRate * weight;
          totalWeight += weight;
        }
      });
      
      const avgFillRate = totalWeight > 0 ? weightedFillRate / totalWeight : 0.5;
      
      // Convert fill rate to availability score (1 - fillRate)
      // Add small variance to avoid all courses having same score
      const baseAvailability = 1 - avgFillRate;
      
      // Add small random variance (±0.05) to avoid ties
      const variance = (Math.random() * 0.1) - 0.05;
      
      // Ensure score stays between 0.1 and 0.95
      availabilityScores[numericId] = Math.max(0.1, Math.min(0.95, baseAvailability + variance));
    });
    
    return availabilityScores;
  } catch (error) {
    console.error('Error calculating course availability:', error);
    return {};
  }
} 