import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Clears all user-related data from localStorage
 * @param userId Optional user ID to target specific user data
 */
export function clearUserDataFromStorage(userId?: string) {
  try {
    if (typeof localStorage === 'undefined') return;
    
    // If userId is provided, clear only that user's data
    if (userId) {
      // Clear user-specific chat history
      localStorage.removeItem(`chat_history_${userId}`);
      
      // Clear user-specific recommendations
      localStorage.removeItem(`user-recommendations-${userId}`);
      
      // Clear any keys containing userId
      Object.keys(localStorage).forEach(key => {
        if (key.includes(userId)) {
          localStorage.removeItem(key);
        }
      });
    } else {
      // Clear all potentially user-related data
      const keysToRemove = [
        // Add known keys here
        'dashboard-recommendations',
      ];
      
      // Remove specific keys
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });
      
      // Remove any keys that seem to be user-related
      Object.keys(localStorage).forEach(key => {
        if (
          key.startsWith('chat_history_') || 
          key.startsWith('user-recommendations-') ||
          key.includes('user') || 
          key.includes('auth') ||
          key.includes('recommendations')
        ) {
          localStorage.removeItem(key);
        }
      });
    }
    
    console.log('Cleared user data from localStorage', userId ? `for user ${userId}` : 'for all users');
  } catch (error) {
    console.error('Error clearing localStorage:', error);
  }
}
