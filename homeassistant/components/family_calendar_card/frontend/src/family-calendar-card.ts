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
import { menuCacheService } from "./menuCacheService";

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
  @state() private _menuData: any = null;

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
      height: 100%;
      overflow: hidden;
    }

    .time-and-events {
      display: flex;
      flex: 1;
      overflow-y: scroll;
      overflow-x: hidden;
      margin-top: 130px; /* Height of headers */
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    .time-and-events::-webkit-scrollbar {
      display: none;
    }

    .time-column {
      position: sticky;
      left: 0;
      width: 100px;
      background: white;
      z-index: 3;
      font-weight: 500;
    }

    .calendar-container {
      flex: 1;
      position: relative;
    }

    swiper-container {
      width: 100%;
      height: 2400px;
    }

    swiper-slide {
      width: 20%;
      height: 100%;
    }

    .day-card {
      height: 100%;
      position: relative;
    }

    .headers-container {
      position: fixed;
      top: 0;
      width: 100%;
      z-index: 4;
    }

    .day-header {
      position: absolute;
      top: 0;
      height: 50px;
      background: white;
      text-align: left;
      padding: 8px 16px;
      font-size: 42px;
      font-weight: 500;
      color: #000000;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      width: 20%;
    }

    .all-day-section {
      position: absolute;
      top: 50px;
      min-height: 40px;
      background: white;
      padding: 4px 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
      width: 20%;
    }

    .meal-plan-section {
      position: sticky;
      top: 90px;
      min-height: 40px;
      background: white;
      z-index: 3;
      border-bottom: 4px solid #000000;
      padding: 4px 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
      border-right: 1px solid #000000;
    }

    .hourly-section {
      position: relative;
      flex: 1;
      border-right: 1px solid #000000;
    }

    .time-slot {
      position: absolute;
      padding: 0 8px;
      font-size: 24px;
      color: #000000;
      white-space: nowrap;
      height: 24px;
      line-height: 24px;
      margin-top: -12px; /* Center the time label */
    }

    .time-tick {
      position: absolute;
      right: 0;
      width: 20px;
      height: 1px;
      background-color: #000000;
    }

    .hour-line {
      position: absolute;
      left: 0;
      right: 0;
      height: 1px;
      background-color: #000000;
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
      z-index: 1;
    }

    .event.meal-plan,
    .event.all-day {
      height: 32px;
      font-size: 22px;
      padding: 4px 12px;
      display: flex;
      align-items: center;
      margin: 0 4px;
      border-radius: 8px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 22px;
    }

    .event.meal-plan {
      background-color: #ffe5d9;
      padding: 4px 8px;
      font-size: 14px;
      min-height: 32px;
      overflow: hidden;
      margin: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      width: calc(100% - 8px);
    }

    .event.meal-plan.error {
      background-color: #ffebee;
      color: #c62828;
    }

    .event.all-day {
      background-color: #e1e1e1;
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

    .menu-item {
      white-space: normal;
      word-wrap: break-word;
      overflow-wrap: break-word;
      line-height: 1.2;
      font-size: 14px;
      text-align: center;
      max-height: 2.4em;
      overflow: hidden;
      text-overflow: ellipsis;
      width: 100%;
    }

    .menu-item:not(:last-child) {
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      padding-bottom: 2px;
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
    await this._initializeCard();
  }

  private async _initializeCard() {
    if (!this.config || !this.hass) {
      console.log("Waiting for config and hass to be ready...");
      return;
    }

    try {
      // Initialize menu cache service
      await menuCacheService.initializeCache();
      this._menuData = menuCacheService.getCachedMenu();
      console.log("Menu data initialized:", this._menuData);
    } catch (error) {
      console.error("Error initializing menu data:", error);
      this._error = "Failed to load menu data";
    }
  }

  updated(changedProps: Map<string, any>) {
    if (changedProps.has("config") || changedProps.has("hass")) {
      this._initializeCard();
    }
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

    // Ensure minimum height
    duration = Math.max(duration, 30);

    // Convert to pixels (100px per hour = 1.666667px per minute)
    const top = (startMinutes * 100) / 60 + 80; // Add header height
    const height = (duration * 100) / 60;

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
        const duration = Math.max(endMinutes - startMinutes, 30); // Minimum 30 minutes

        // Convert to pixels (100px per hour = 1.666667px per minute)
        const top = (startMinutes * 100) / 60 + 80; // Add header height
        const height = (duration * 100) / 60;

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
    if (!this._menuData) {
      console.log("No menu data available yet");
      return html` <div class="event meal-plan error">Loading menu...</div> `;
    }

    // Format the date to match the API date format (YYYY-MM-DD)
    const dateStr = date.toISOString().split("T")[0];

    const dayMenu = this._menuData.find((menu: any) => menu.date === dateStr);

    if (!dayMenu || !dayMenu.items.length) {
      return nothing;
    }

    return html`
      <div class="event meal-plan">
        ${dayMenu.items.map(
          (item: string) => html` <div class="menu-item">${item}</div> `,
        )}
      </div>
    `;
  }

  private _getAllDayEvents(date: Date): TemplateResult | typeof nothing {
    const day = date.getDay();
    const events: string[] = [];

    // Example events for different days
    if (day === 1 || day === 5) {
      events.push("Game Night");
    }
    if (day === 2) {
      events.push("Holiday");
    }
    if (day === 3) {
      events.push("Book Fair");
    }

    if (events.length === 0) {
      return nothing;
    }

    return html`
      ${events.map(
        (event) => html` <div class="event all-day">${event}</div> `,
      )}
    `;
  }

  render() {
    if (!this.config || !this.hass) {
      return html``;
    }

    const timeSlots = Array.from({ length: 23 }, (_, i) => {
      const hour = (i + 1) % 12 || 12;
      const meridiem = i < 11 ? "am" : "pm";
      return `${hour} ${meridiem}`;
    });

    const days = this._getDays();

    return html`
      <ha-card>
        <style>
          @import url("https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;800&display=swap");
        </style>
        <div class="calendar-wrapper">
          <div class="headers-container">
            ${days.map(
              (day, index) => html`
                <div class="day-header" style="left: ${100 + index * 20}%">
                  ${day
                    .toLocaleDateString("en-US", {
                      weekday: "short",
                      day: "numeric",
                    })
                    .replace(",", "")}
                </div>
                <div class="all-day-section" style="left: ${100 + index * 20}%">
                  ${this._getAllDayEvents(day)}
                </div>
                <div
                  class="meal-plan-section"
                  style="left: ${100 + index * 20}%"
                >
                  ${this._getMealPlan(day)}
                </div>
              `,
            )}
          </div>
          <div class="time-and-events">
            <div class="time-column">
              ${timeSlots.map(
                (time, i) => html`
                  <div class="time-slot" style="top: ${i * 100 + 50}px">
                    ${time}
                  </div>
                  <div class="time-tick" style="top: ${i * 100}px"></div>
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
                        <div class="hourly-section">
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
                      </div>
                    </swiper-slide>
                  `,
                )}
              </swiper-container>
            </div>
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
    version: "__BUILD_VERSION__" as string,
  });
}

console.info(`Family Calendar Card 📆 version __BUILD_VERSION__ loaded`);
