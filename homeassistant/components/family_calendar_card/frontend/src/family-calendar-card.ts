/*
 * File: src/family-calendar-card.ts
 * Description: Main entry point for the Family Calendar custom card
 *
 */

import { html, css, LitElement, nothing } from "lit";
import type { TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { HomeAssistant } from "custom-card-helpers";
import { register } from "swiper/element";
import type { SwiperContainer, SwiperSlide } from "swiper/element";
import "swiper/css";

register(); // Register Swiper custom elements

declare global {
  interface HTMLElementTagNameMap {
    "swiper-container": SwiperContainer;
    "swiper-slide": SwiperSlide;
  }
}

interface CalendarEvent {
  start: Date;
  end: Date;
  title: string;
  calendar: string;
  location?: string;
  description?: string;
  color?: string;
}

interface CalendarCardConfig {
  entities: string[];
  show_header?: boolean;
  title?: string;
}

interface GoogleCalendarEvent {
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  summary: string;
  location?: string;
  colorId?: string;
  // Add other properties as needed
}

interface GoogleCalendarColors {
  kind: string;
  updated: string;
  calendar: {
    [key: string]: {
      background: string;
      foreground: string;
    };
  };
  event: {
    [key: string]: {
      background: string;
      foreground: string;
    };
  };
}

class DateUtils {
  static getHourRange(startHour: number, endHour: number): number[] {
    const hours: number[] = [];
    for (let hour = startHour; hour <= endHour; hour++) {
      hours.push(hour);
    }
    return hours;
  }

  static getTimeString(date: Date): string {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  static convertTimeToPixels(date: Date, startHour: number): number {
    const hours = date.getHours() - startHour;
    const minutes = date.getMinutes();
    return (hours * 60 + minutes) * (60 / 60); // 60px per hour
  }
}

// Define the class first
@customElement("family-calendar-card")
export class FamilyCalendarCard extends LitElement {
  static get shadowRootOptions(): { mode: "open" | "closed" } {
    return { mode: "open" };
  }

  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) public config!: any;
  @state() private _events?: CalendarEvent[];
  @state() private _swiper?: any;
  @state() private _error?: string;
  @state() private _colors?: GoogleCalendarColors;

  // Generate time slots in 12-hour format
  private _timeSlots = Array.from({ length: 24 }, (_, i) => {
    const hour = i % 12 || 12;
    return `${hour}:00`;
  });

  static styles = css`
    :host {
      display: block;
      height: 100%;
      font-family: "EB Garamond", serif;
      font-optical-sizing: auto;
      overflow: hidden;
    }

    ha-card {
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .calendar-wrapper {
      display: flex;
      flex: 1;
      min-height: 700px;
      height: 100%;
      overflow: hidden;
    }

    .calendar-container {
      flex: 1;
      overflow: hidden;
      display: flex;
    }

    swiper-container {
      width: 100%;
      height: 100%;
      flex: 1;
    }

    swiper-slide {
      width: 20%;
      height: 100%;
      overflow-y: auto;
    }

    .time-column {
      position: sticky;
      left: 0;
      width: 100px;
      background: white;
      z-index: 3;
      font-weight: 500;
      height: calc(100% - 80px);
      margin-top: 80px;
    }

    .time-slot {
      position: absolute;
      padding: 0 8px;
      font-size: 24px;
      color: #000000;
      white-space: nowrap;
      transform: translateY(-50%);
      line-height: 1;
    }

    .day-card {
      height: 2400px;
      position: relative;
      border-left: 1px solid #e0e0e0;
    }

    .day-header {
      position: sticky;
      top: 0;
      height: 80px;
      background: white;
      text-align: left;
      padding: 24px 16px;
      font-size: 42px;
      font-weight: 500;
      color: #000000;
      z-index: 2;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .hour-line {
      position: absolute;
      left: 0;
      right: 0;
      height: 1px;
      background-color: #e0e0e0;
    }

    .event {
      position: absolute;
      left: 4px;
      right: 4px;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 32px;
      font-weight: 500;
      color: #000000;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      background-color: #a4d8f9;
      display: flex;
      flex-direction: column;
      z-index: 2;
    }

    .event.meal-plan {
      top: 0;
      height: 32px;
      background-color: #ffe5d9;
      margin-top: 80px;
      padding: 4px 12px;
      font-size: 22px;
      display: flex;
      align-items: center;
      line-height: 1;
    }

    .event.meal-plan .event-time {
      display: none; /* Hide time for meal plans */
    }

    .event-icon {
      margin-right: 8px;
      font-size: 20px;
    }

    .event-time {
      font-size: 24px;
      opacity: 0.8;
      font-weight: 400;
      margin-top: 4px;
    }
  `;

  setConfig(config: CalendarCardConfig) {
    if (
      !config.entities ||
      !Array.isArray(config.entities) ||
      config.entities.length === 0
    ) {
      throw new Error("At least one calendar entity must be specified");
    }

    config.entities.forEach((entity) => {
      if (!entity.startsWith("calendar.")) {
        throw new Error(`Entity ${entity} is not a calendar entity`);
      }
    });

    this.config = config;
    this._fetchCalendarEvents();
  }

  async connectedCallback() {
    super.connectedCallback();
    //    await this._fetchColors();
    await this._fetchCalendarEvents();
  }

  private async _fetchCalendarEvents() {
    if (!this.config?.entities || !this.hass) {
      console.log("Config or hass not ready:", {
        config: this.config,
        hass: !!this.hass,
      });
      return;
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 5);

    try {
      const events: CalendarEvent[] = [];
      for (const entityId of this.config.entities) {
        const calendar = this.hass.states[entityId];
        if (!calendar) {
          console.warn(`Calendar entity not found: ${entityId}`);
          continue;
        }

        try {
          const result: GoogleCalendarEvent[] = await this.hass.callApi(
            "GET",
            `calendars/${entityId}?start=${start.toISOString()}&end=${end.toISOString()}`,
          );
          console.log("Calendar API Response:", result);

          const calendarEvents = result.map((event) => {
            // Handle potential undefined values
            const startDateTime =
              event.start.dateTime || event.start.date || "";
            const endDateTime = event.end.dateTime || event.end.date || "";

            return {
              start: new Date(startDateTime),
              end: new Date(endDateTime),
              title: event.summary,
              calendar: entityId,
              location: event.location,
              color: event.colorId,
            };
          });
          events.push(...calendarEvents);
        } catch (error) {
          console.error(`Error fetching events for ${entityId}:`, error);
        }
      }

      this._events = events;
    } catch (error) {
      console.error("Error in _fetchCalendarEvents:", error);
      this._error = "Failed to load calendar events";
    }
  }

  firstUpdated() {
    const container = this.shadowRoot?.querySelector(".calendar-container");
    if (container) {
      container.scrollTop = 1000; // Scroll to 10am
    }

    // Initialize Swiper with proper typing
    const swiperEl = this.shadowRoot?.querySelector(
      "swiper-container",
    ) as SwiperContainer;
    if (swiperEl) {
      // Set any additional Swiper parameters
      Object.assign(swiperEl, {
        centeredSlides: true,
        centerInsufficientSlides: true,
      });

      swiperEl.swiper.init();
    }
  }

  private _scrollToBusinessHours() {
    requestAnimationFrame(() => {
      const container = this.shadowRoot?.querySelector(".calendar-container");
      if (container) {
        // Scroll to 7am minus 15 minutes
        const scrollTop = 7 * 60 - 15;
        container.scrollTop = scrollTop;
      }
    });
  }

  private _getCalendarColor(calendarId: string): string {
    // Get the actual calendar entity
    const calendar = this.hass?.states[calendarId];
    if (calendar?.attributes?.color) {
      return calendar.attributes.color;
    }

    // Fallback colors if no color is set in the calendar entity
    const colors = {
      "calendar.personal": "#039be5",
      "calendar.work": "#7986cb",
      "calendar.family": "#33b679",
      "calendar.holidays": "#8e24aa",
      default: "#039be5",
    };

    return colors[calendarId] || colors.default;
  }

  private _getEventStyle(event: CalendarEvent, dayStart: Date): string {
    const startMinutes = event.start.getHours() * 60 + event.start.getMinutes();
    const endMinutes = event.end.getHours() * 60 + event.end.getMinutes();
    let duration = endMinutes - startMinutes;

    // Ensure minimum 1 hour duration
    duration = Math.max(duration, 60);

    const top = startMinutes;
    const height = duration;

    // Get color from Google Calendar colors
    let backgroundColor = "#039be5"; // Default color
    if (this._colors?.event && event.color) {
      backgroundColor =
        this._colors.event[event.color]?.background || backgroundColor;
    }

    return `top: ${top}px; height: ${height}px; background-color: ${backgroundColor};`;
  }

  private _formatTime(date: Date): string {
    const hours = date.getHours() % 12 || 12;
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const meridiem = date.getHours() >= 12 ? "pm" : "am";
    return `${hours}:${minutes} ${meridiem}`;
  }

  private _getEventsForDay(date: Date): TemplateResult[] {
    if (!this._events) {
      return [];
    }

    return this._events
      .filter((event) => {
        const eventDate = new Date(event.start);
        return (
          eventDate.getDate() === date.getDate() &&
          eventDate.getMonth() === date.getMonth() &&
          eventDate.getFullYear() === date.getFullYear()
        );
      })
      .map((event) => {
        const startDate = new Date(event.start);
        const endDate = new Date(event.end);

        const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
        const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();
        const duration = endMinutes - startMinutes;

        // Convert minutes to pixels (100px per hour = 1.667px per minute)
        const top = startMinutes * (100 / 60);
        const height = duration * (100 / 60);

        return html`
          <div
            class="event"
            style="top: ${top}px; height: ${height}px; ${event.color
              ? `background-color: ${event.color};`
              : ""}"
          >
            <div>${event.title}</div>
            <div class="event-time">
              ${this._formatTime(startDate)} - ${this._formatTime(endDate)}
            </div>
          </div>
        `;
      });
  }

  private _getDays(): Date[] {
    const today = new Date();
    const days: Date[] = [];

    // Generate 30 days starting from today
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      days.push(date);
    }

    return days;
  }

  private _getMealPlan(date: Date): TemplateResult | typeof nothing {
    const day = date.getDay(); // 0 = Sunday, 1 = Monday, etc.

    if (day === 2) {
      // Tuesday
      return html`
        <div class="event meal-plan">
          <span class="event-icon">🌮</span>Tacos
        </div>
      `;
    } else if (day === 5) {
      // Friday
      return html`
        <div class="event meal-plan">
          <span class="event-icon">🍕</span>Pizza
        </div>
      `;
    }

    return nothing;
  }

  render() {
    if (!this.config || !this.hass) {
      return html``;
    }

    const timeSlots = Array.from({ length: 24 }, (_, i) => {
      const hour = i % 12 || 12;
      const meridiem = i < 12 ? "am" : "pm";
      return `${hour} ${meridiem}`;
    });

    const days = this._getDays();

    return html`
      <ha-card>
        <style>
          @import url("https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;800&display=swap");
        </style>
        <div class="calendar-wrapper">
          <div class="time-column">
            ${timeSlots.map(
              (time, i) => html`
                <div class="time-slot" style="top: ${i * 100}px">${time}</div>
              `,
            )}
          </div>
          <div class="calendar-container">
            <swiper-container
              slides-per-view="5"
              space-between="0"
              initial-slide="2"
              resistance
              resistance-ratio="0"
              watch-slides-progress
            >
              ${days.map(
                (day) => html`
                  <swiper-slide>
                    <div class="day-card">
                      <div class="day-header">
                        ${day
                          .toLocaleDateString("en-US", {
                            weekday: "short",
                            day: "numeric",
                          })
                          .replace(",", "")}
                      </div>
                      ${this._getMealPlan(day)}
                      ${timeSlots.map(
                        (_, i) => html`
                          <div
                            class="hour-line"
                            style="top: ${i * 100}px"
                          ></div>
                        `,
                      )}
                      ${this._getEventsForDay(day)}
                    </div>
                  </swiper-slide>
                `,
              )}
            </swiper-container>
          </div>
        </div>
      </ha-card>
    `;
  }
}

// Then handle the registration
if (!customElements.get("family-calendar-card")) {
  customElements.define("family-calendar-card", FamilyCalendarCard);
}

// Register with Home Assistant's custom cards registry
if (!(window as any).customCards) {
  (window as any).customCards = [];
}

if (
  !(window as any).customCards.find(
    (card: any) => card.type === "family-calendar-card",
  )
) {
  (window as any).customCards.push({
    type: "family-calendar-card",
    name: "Family Calendar Card",
    description: "A calendar card for family scheduling",
  });
}
