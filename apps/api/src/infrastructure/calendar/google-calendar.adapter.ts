import { Injectable, Logger } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

/**
 * Puerto del Calendar adapter - abstrae Google Calendar.
 * Si GoogleCalendar está deshabilitado, retorna stubs no-op.
 */
export interface ICalendarAdapter {
  readonly providerName: 'google';
  isEnabled(): boolean;
  createEvent(args: {
    title: string;
    description?: string;
    startISO: string;     // ISO 8601
    endISO: string;
    attendees?: string[]; // emails
  }): Promise<{ eventId: string; htmlLink: string }>;
  updateEvent(eventId: string, patch: Partial<{ startISO: string; endISO: string; title: string }>): Promise<void>;
  deleteEvent(eventId: string): Promise<void>;
  isHealthy(): Promise<boolean>;
}

/**
 * Stub adapter - no interactúa con Google Calendar real.
 * Para activarlo, implementar GoogleCalendarAdapter con googleapis.
 */
@Injectable()
export class GoogleCalendarAdapter implements ICalendarAdapter {
  readonly providerName = 'google' as const;
  private readonly logger = new Logger(GoogleCalendarAdapter.name);
  private readonly enabled = false;

  isEnabled(): boolean {
    return this.enabled;
  }

  async createEvent(args: {
    title: string;
    description?: string;
    startISO: string;
    endISO: string;
    attendees?: string[];
  }): Promise<{ eventId: string; htmlLink: string }> {
    this.logger.warn('GoogleCalendar disabled (stub). Set GOOGLE_CALENDAR_ENABLED=true to enable.');
    return {
      eventId: uuidv7(),
      htmlLink: '',
    };
  }

  async updateEvent(): Promise<void> {
    // noop
  }

  async deleteEvent(): Promise<void> {
    // noop
  }

  async isHealthy(): Promise<boolean> {
    return false;
  }
}

export const CALENDAR_ADAPTER = Symbol('CALENDAR_ADAPTER');
