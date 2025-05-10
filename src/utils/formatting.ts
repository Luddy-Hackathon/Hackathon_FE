/**
 * Format time slot for display
 * @param timeSlot The time slot to format
 * @returns Formatted time slot string
 */
export const formatTimeSlot = (timeSlot: string): string => {
  const dayMap: Record<string, string> = {
    'M': 'Monday',
    'T': 'Tuesday',
    'W': 'Wednesday',
    'R': 'Thursday',
    'F': 'Friday',
    'S': 'Saturday',
    'U': 'Sunday',
  };
  
  if (!timeSlot) return 'Flexible';
  
  // Parse time slot format like "MWF 10:00-11:15"
  const parts = timeSlot.split(' ');
  if (parts.length !== 2) return timeSlot;
  
  const days = parts[0].split('').map(day => dayMap[day] || day).join(', ');
  return `${days} ${parts[1]}`;
}; 