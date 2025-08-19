// Date utility functions for consistent date formatting across the project
import { format, parseISO, isValid, formatDistanceToNow } from 'date-fns';
import { DATE_CONFIG } from '@/app/lib/config/dateConfig';

// Standard date formats used across the application
export const DATE_FORMATS = {
  // Display formats
  SHORT_DATE: 'MM/dd/yyyy',                    // 12/31/2024
  LONG_DATE: 'MMMM d, yyyy',                   // December 31, 2024
  FULL_DATE: 'EEEE, MMMM d, yyyy',            // Monday, December 31, 2024
  DATE_TIME: 'MM/dd/yyyy HH:mm',              // 12/31/2024 14:30
  DATE_TIME_12H: 'MM/dd/yyyy h:mm a',         // 12/31/2024 2:30 PM
  TIME_ONLY: 'HH:mm',                          // 14:30
  TIME_12H: 'h:mm a',                          // 2:30 PM
  
  // File/export formats
  FILE_DATE: 'yyyy-MM-dd',                     // 2024-12-31
  FILE_DATETIME: 'yyyy-MM-dd_HHmm',            // 2024-12-31_1430
  
  // API/Database formats
  ISO_DATE: "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",   // 2024-12-31T14:30:00.000Z
} as const;

/**
 * Format a date string, Date object, or timestamp to a specified format
 * @param date - Date string, Date object, or timestamp
 * @param formatStr - Format string (from DATE_FORMATS or custom)
 * @returns Formatted date string or 'N/A' if invalid
 */
export function formatDate(
  date: string | number | Date | null | undefined,
  formatStr: string = DATE_FORMATS.SHORT_DATE
): string {
  if (!date) return 'N/A';
  
  try {
    let dateObj: Date;
    
    if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string') {
      // Try to parse ISO string
      dateObj = parseISO(date);
      // If parsing fails, try regular Date constructor
      if (!isValid(dateObj)) {
        dateObj = new Date(date);
      }
    } else if (typeof date === 'number') {
      dateObj = new Date(date);
    } else {
      return 'N/A';
    }
    
    if (!isValid(dateObj)) {
      return 'Invalid Date';
    }
    
    return format(dateObj, formatStr);
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
}

/**
 * Format a date to show relative time (e.g., "2 hours ago")
 * @param date - Date string, Date object, or timestamp
 * @param addSuffix - Whether to add "ago" suffix
 * @returns Relative time string
 */
export function formatRelativeTime(
  date: string | number | Date | null | undefined,
  addSuffix: boolean = true
): string {
  if (!date) return 'N/A';
  
  try {
    let dateObj: Date;
    
    if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string') {
      dateObj = parseISO(date);
      if (!isValid(dateObj)) {
        dateObj = new Date(date);
      }
    } else if (typeof date === 'number') {
      dateObj = new Date(date);
    } else {
      return 'N/A';
    }
    
    if (!isValid(dateObj)) {
      return 'Invalid Date';
    }
    
    return formatDistanceToNow(dateObj, { addSuffix });
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return 'Invalid Date';
  }
}

/**
 * Format date for use in filenames (safe characters only)
 * @param date - Date string, Date object, or timestamp
 * @returns Formatted date string safe for filenames
 */
export function formatDateForFilename(
  date: string | number | Date | null | undefined = new Date()
): string {
  return formatDate(date, DATE_FORMATS.FILE_DATE);
}

/**
 * Check if a date string is valid
 * @param dateString - Date string to validate
 * @returns boolean indicating if date is valid
 */
export function isValidDate(dateString: string | null | undefined): boolean {
  if (!dateString) return false;
  
  try {
    const date = parseISO(dateString);
    return isValid(date);
  } catch {
    try {
      const date = new Date(dateString);
      return isValid(date);
    } catch {
      return false;
    }
  }
}

/**
 * Get a standardized date object from various inputs
 * @param date - Date string, Date object, or timestamp
 * @returns Date object or null if invalid
 */
export function getDateObject(
  date: string | number | Date | null | undefined
): Date | null {
  if (!date) return null;
  
  try {
    let dateObj: Date;
    
    if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string') {
      dateObj = parseISO(date);
      if (!isValid(dateObj)) {
        dateObj = new Date(date);
      }
    } else if (typeof date === 'number') {
      dateObj = new Date(date);
    } else {
      return null;
    }
    
    return isValid(dateObj) ? dateObj : null;
  } catch {
    return null;
  }
}

// Re-export commonly used date-fns functions
export { format, parseISO, isValid, isToday, isYesterday, startOfDay, endOfDay } from 'date-fns';