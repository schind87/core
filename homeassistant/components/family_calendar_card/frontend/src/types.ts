/*
 * File: src/types.ts
 * Description: Type definitions for the Family Calendar card
 */

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  description?: string;
  location?: string;
  calendar?: string;
}

export interface CalendarCardConfig {
  show_header?: boolean;
  show_time_column?: boolean;
  start_hour?: number;
  end_hour?: number;
}
