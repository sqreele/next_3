// Date configuration for the project
// This file centralizes all date format preferences

export const DATE_CONFIG = {
  // Default locale for date formatting
  locale: 'en-US',
  
  // Timezone settings
  timezone: 'UTC',
  
  // Default formats for different contexts
  defaultFormats: {
    display: 'MM/dd/yyyy',              // For general display
    displayWithTime: 'MM/dd/yyyy h:mm a', // For display with time
    input: 'yyyy-MM-dd',                // For date inputs
    api: "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", // For API communication
    filename: 'yyyy-MM-dd',             // For file naming
    log: 'yyyy-MM-dd HH:mm:ss',        // For logging
  },
  
  // Feature flags for date handling
  features: {
    showRelativeTime: true,             // Show "2 hours ago" style dates
    use12HourTime: true,                // Use 12-hour format (AM/PM)
    showTimezone: false,                // Show timezone in date displays
  }
} as const;

// Export type for TypeScript
export type DateConfig = typeof DATE_CONFIG;