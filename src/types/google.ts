export interface NormalizedEvent {
    id: string;
    summary: string;
    description?: string;
    startTime: string;   // ISO string
    endTime: string;     // ISO string
    creator?: string;
    attendees?: string[];
    location?: string;
    hangoutLink?: string;
    htmlLink?: string;   // link to open in Google Calendar
  }