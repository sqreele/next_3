# Date Formatting Guide

This document explains the date formatting system used throughout the project.

## Overview

The project uses a centralized date formatting system built on top of `date-fns` to ensure consistent date displays across all components.

## Key Files

- `/app/lib/utils/dateUtils.ts` - Main date utility functions
- `/app/lib/config/dateConfig.ts` - Date configuration and preferences
- `/app/lib/utils.ts` - Re-exports date utilities for easy importing

## Usage

### Basic Date Formatting

```typescript
import { formatDate, DATE_FORMATS } from '@/app/lib/utils';

// Use predefined formats
formatDate(myDate, DATE_FORMATS.SHORT_DATE);     // 12/31/2024
formatDate(myDate, DATE_FORMATS.LONG_DATE);      // December 31, 2024
formatDate(myDate, DATE_FORMATS.DATE_TIME_12H);  // 12/31/2024 2:30 PM

// Or use custom format
formatDate(myDate, 'yyyy-MM-dd');                // 2024-12-31
```

### Relative Time

```typescript
import { formatRelativeTime } from '@/app/lib/utils';

formatRelativeTime(myDate);         // "2 hours ago"
formatRelativeTime(myDate, false);  // "2 hours" (without suffix)
```

### File Names

```typescript
import { formatDateForFilename } from '@/app/lib/utils';

const filename = `report-${formatDateForFilename()}.pdf`;  // report-2024-12-31.pdf
```

## Available Formats

All predefined formats are available in `DATE_FORMATS`:

- `SHORT_DATE`: MM/dd/yyyy (12/31/2024)
- `LONG_DATE`: MMMM d, yyyy (December 31, 2024)
- `FULL_DATE`: EEEE, MMMM d, yyyy (Monday, December 31, 2024)
- `DATE_TIME`: MM/dd/yyyy HH:mm (12/31/2024 14:30)
- `DATE_TIME_12H`: MM/dd/yyyy h:mm a (12/31/2024 2:30 PM)
- `TIME_ONLY`: HH:mm (14:30)
- `TIME_12H`: h:mm a (2:30 PM)
- `FILE_DATE`: yyyy-MM-dd (2024-12-31)
- `FILE_DATETIME`: yyyy-MM-dd_HHmm (2024-12-31_1430)
- `ISO_DATE`: Full ISO format with timezone

## Configuration

Date preferences can be configured in `/app/lib/config/dateConfig.ts`:

- Default locale
- Timezone settings
- Default formats for different contexts
- Feature flags (relative time, 12-hour format, etc.)

## Best Practices

1. **Always use the centralized utilities** instead of native Date methods
2. **Import from `@/app/lib/utils`** for convenience
3. **Use predefined formats** when possible for consistency
4. **Handle null/undefined dates** - utilities return 'N/A' for invalid dates
5. **Use appropriate formats** for different contexts (display vs. API vs. filenames)

## Examples in Components

### Job List
```typescript
import { formatDate, DATE_FORMATS } from '@/app/lib/utils';

<Text>Created: {formatDate(job.created_at, DATE_FORMATS.DATE_TIME_12H)}</Text>
```

### PDF Generation
```typescript
import { formatDateForFilename } from '@/app/lib/utils';

const filename = `jobs-report-${formatDateForFilename()}.pdf`;
```

### Filters
```typescript
import { formatDate, DATE_FORMATS } from '@/app/lib/utils';

const displayDate = formatDate(selectedDate, DATE_FORMATS.LONG_DATE);
```

## Migration Guide

If you find code using old date formatting:

```typescript
// Old
new Date(dateString).toLocaleDateString('en-US', {...})

// New
import { formatDate, DATE_FORMATS } from '@/app/lib/utils';
formatDate(dateString, DATE_FORMATS.SHORT_DATE)
```

## Adding New Formats

To add a new date format:

1. Add it to `DATE_FORMATS` in `/app/lib/utils/dateUtils.ts`
2. Document it in this guide
3. Use it consistently across the project