/*
 * File: src/family-calendar-card.ts
 * Description: Main entry point for the Family Calendar custom card
 *
 */
import { styles } from "./styles";
import { html, css, LitElement, nothing } from "lit";
import type { TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { HomeAssistant } from "custom-card-helpers";
import { menuCacheService } from "./menuCacheService";

declare const __BUILD_VERSION__: string;

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

  static styles = styles;

  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) public config!: any;
  @state() private _events?: CalendarEvent[];
  @state() private _error?: string;
  @state() private _colors?: GoogleCalendarColors;
  @state() private _menuData: any = null;

  // Generate time slots in 12-hour format
  private _timeSlots = Array.from({ length: 24 }, (_, i) => {
    const hour = i % 12 || 12;
    return `${hour}:00`;
  });

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
    window.addEventListener("resize", () => this.updateDebugInfo());
    this._setupResizeObserver();
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
    } catch (error) {
      console.error("Error initializing menu data:", error);
      this._error = "Failed to load menu data";
    }
  }

  updated(changedProps: Map<string, any>) {
    super.updated(changedProps);
    this._debugLayout();
    if (changedProps.has("config") || changedProps.has("hass")) {
      this._initializeCard();
      this._fetchCalendarEvents();
    }
    this.updateDebugInfo();
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

    console.log("Fetching events for:", {
      entities: this.config.entities,
      start: start.toISOString(),
      end: end.toISOString(),
    });

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

          console.log(`Events received for ${entityId}:`, result);

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

      console.log("Final processed events:", events);
      this._events = events;
    } catch (error) {
      console.error("Error in _fetchCalendarEvents:", error);
      this._error = "Failed to load calendar events";
    }
  }

  firstUpdated() {
    const container = this.shadowRoot?.querySelector(".calendar-card");
    if (container) {
      container.scrollTop = 1000; // Scroll to 10am
    }
    this.updateDebugInfo();
  }

  private _scrollToBusinessHours() {
    requestAnimationFrame(() => {
      const container = this.shadowRoot?.querySelector(".calendar-card");
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

  private _isAllDayEvent(event: CalendarEvent): boolean {
    // Check if the start time is midnight and end time is midnight (or 23:59:59) of another day
    const startIsDate =
      event.start.getHours() === 0 &&
      event.start.getMinutes() === 0 &&
      event.start.getSeconds() === 0;

    const endIsDate =
      (event.end.getHours() === 0 &&
        event.end.getMinutes() === 0 &&
        event.end.getSeconds() === 0) ||
      (event.end.getHours() === 23 &&
        event.end.getMinutes() === 59 &&
        event.end.getSeconds() === 59);

    return startIsDate && endIsDate;
  }

  private _getAllDayEvents(date: Date): TemplateResult | typeof nothing {
    if (!this._events) {
      return nothing;
    }

    const dayEvents = this._events.filter(
      (event) =>
        this._isAllDayEvent(event) &&
        event.start.toDateString() === date.toDateString(),
    );

    if (dayEvents.length === 0) {
      return nothing;
    }

    return html`
      ${dayEvents.map(
        (event) => html` <div class="event all-day">${event.title}</div> `,
      )}
    `;
  }

  private _getEventsForDay(date: Date): TemplateResult[] {
    if (!this._events) {
      return [];
    }

    // Only return non-all-day events for the regular grid
    return this._events
      .filter(
        (event) =>
          !this._isAllDayEvent(event) && // Exclude all-day events
          event.start.getDate() === date.getDate() &&
          event.start.getMonth() === date.getMonth() &&
          event.start.getFullYear() === date.getFullYear(),
      )
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

    // Generate 5 days starting from today
    for (let i = 0; i < 5; i++) {
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

  private _syncHeaderScroll(e: Event) {
    const headerContainer = e.target as HTMLElement;
    const mainContainer = this.shadowRoot?.querySelector(
      ".main-scroll-container",
    );
    if (mainContainer) {
      mainContainer.scrollLeft = headerContainer.scrollLeft;
    }
  }

  private _syncMainScroll(e: Event) {
    const mainContainer = e.target as HTMLElement;
    const headerContainer = this.shadowRoot?.querySelector(
      ".header-scroll-container",
    );
    if (headerContainer) {
      headerContainer.scrollLeft = mainContainer.scrollLeft;
    }
  }

  private _renderTimeColumn(): TemplateResult {
    const timeSlots = Array.from({ length: 23 }, (_, i) => {
      const hour = (i + 1) % 12 || 12;
      const meridiem = i < 11 ? "am" : "pm";
      return `${hour} ${meridiem}`;
    });

    return html`
      <div class="time-column">
        ${timeSlots.map(
          (time, i) => html`
            <div class="time-slot" style="top: ${100 + i * 100 + 50}px">
              ${time}
            </div>
          `,
        )}
      </div>
    `;
  }

  private _renderDayColumn(day: Date): TemplateResult {
    return html`
      <div class="day-column">
        ${Array.from(
          { length: 24 },
          (_, i) => html`
            <div
              class="hour-line"
              style="top: calc(${i} * var(--hour-height))"
            ></div>
          `,
        )}
        ${this._getEventsForDay(day)}
      </div>
    `;
  }

  private _renderDayColumnHeader(day: Date, index: number): TemplateResult {
    return html`
      <div
        class="day-column-header"
        data-column-index="${index}"
        data-computed-width="${this.shadowRoot?.querySelector(
          `.day-column-header:nth-child(${index + 1})`,
        )?.clientWidth}"
      >
        ${day
          .toLocaleDateString("en-US", {
            weekday: "short",
            day: "numeric",
          })
          .replace(",", "")}
      </div>
    `;
  }

  private async updateDebugInfo() {
    // Wait for next render cycle
    await this.updateComplete;

    // Wait one more frame to ensure sizes are calculated
    requestAnimationFrame(() => {
      const containers = [
        ".header-content",
        ".all-day-content",
        ".meal-plan-content",
        ".main-content",
      ];

      containers.forEach((selector) => {
        const element = this.shadowRoot?.querySelector(selector);
        if (element) {
          const totalWidth = element.getBoundingClientRect().width;
          const timeColWidth = 60;
          const availableWidth = totalWidth; // Don't subtract timeColWidth since it's absolute
          const columnWidth = availableWidth / 5;

          element.setAttribute(
            "data-width",
            `Total: ${Math.round(totalWidth)}px | Column: ${Math.round(
              columnWidth,
            )}px`,
          );
        }
      });
    });
  }

  private _debugLayout() {
    requestAnimationFrame(() => {
      const elements = {
        headerContent: this.shadowRoot?.querySelector(".header-content"),
        headerColumns: this.shadowRoot?.querySelectorAll(".day-column-header"),
        mainContent: this.shadowRoot?.querySelector(".main-content"),
        dayColumns: this.shadowRoot?.querySelectorAll(".day-column"),
      };

      console.group("Layout Debug");
      console.log("Header Content Width:", elements.headerContent?.clientWidth);
      console.log("Main Content Width:", elements.mainContent?.clientWidth);

      elements.headerColumns?.forEach((col, i) => {
        console.log(`Header Column ${i} Width:`, col.clientWidth);
      });

      elements.dayColumns?.forEach((col, i) => {
        console.log(`Day Column ${i} Width:`, col.clientWidth);
      });
      console.groupEnd();
    });
  }

  private _setupResizeObserver() {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        console.log(`${entry.target.className} size:`, {
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    ["header-content", "main-content"].forEach((className) => {
      const element = this.shadowRoot?.querySelector(`.${className}`);
      if (element) observer.observe(element);
    });
  }

  render() {
    if (!this.config || !this.hass) {
      return html``;
    }

    const days = this._getDays();

    return html`
      <ha-card>
        <div class="calendar-card">
          <div
            class="header-scroll-container"
            @scroll=${this._syncHeaderScroll}
          >
            <div class="header-content">
              ${days.map(
                (day) => html`
                  <div class="day-column-header">
                    ${day
                      .toLocaleDateString("en-US", {
                        weekday: "short",
                        day: "numeric",
                      })
                      .replace(",", "")}
                  </div>
                `,
              )}
            </div>
          </div>

          <div class="all-day-scroll-container">
            <div class="all-day-content">
              ${days.map(
                (day) => html`
                  <div class="all-day-column">
                    ${this._getAllDayEvents(day)}
                  </div>
                `,
              )}
            </div>
          </div>

          <div class="meal-plan-scroll-container">
            <div class="meal-plan-content">
              ${days.map(
                (day) => html`
                  <div class="meal-plan-column">${this._getMealPlan(day)}</div>
                `,
              )}
            </div>
          </div>

          <div class="main-scroll-container" @scroll=${this._syncMainScroll}>
            <div class="time-column">
              ${Array.from(
                { length: 24 },
                (_, i) => html`
                  <div class="time-slot" style="top: ${i * 60}px">
                    ${i === 0
                      ? "12 am"
                      : i < 12
                      ? `${i} am`
                      : i === 12
                      ? "12 pm"
                      : `${i - 12} pm`}
                  </div>
                `,
              )}
            </div>
            ${days.map((day) => this._renderDayColumn(day))}
          </div>
        </div>
      </ha-card>
    `;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("resize", () => this.updateDebugInfo());
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
    version: __BUILD_VERSION__,
  });
}

console.info(`Family Calendar Card version ${__BUILD_VERSION__} loaded`);
