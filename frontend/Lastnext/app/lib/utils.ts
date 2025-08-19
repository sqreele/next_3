import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// Re-export date utilities from centralized dateUtils
export { formatDate, formatRelativeTime, formatDateForFilename, DATE_FORMATS } from './utils/dateUtils'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}