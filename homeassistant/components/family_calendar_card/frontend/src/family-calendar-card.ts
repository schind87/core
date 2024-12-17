/*
 * File: src/family-calendar-card.ts
 * Description: Main entry point for the Family Calendar custom card
 *
 */
import { LitElement, html, css } from "lit";
import { property, state, query } from "lit/decorators.js";
import {
  HomeAssistant,
  LovelaceCard,
  LovelaceCardEditor,
} from "custom-card-helpers";
import {
  Calendar,
  EventSourceInput,
  CalendarOptions,
  EventInput,
} from "@fullcalendar/core";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import scrollGridPlugin from "@fullcalendar/scrollgrid";
import { menuCacheService } from "./menuCacheService";

// This is for editor support
declare global {
  interface Window {
    customCards: Array<{
      type: string;
      name: string;
      description: string;
      preview: boolean;
    }>;
  }
  interface HTMLElementTagNameMap {
    "family-calendar-card-editor": LovelaceCardEditor;
    "hui-error-card": LovelaceCard;
  }
}

// Card version should be shown in the console
console.info(
  "%c FAMILY-CALENDAR-CARD %c Version 1.0.0 ",
  "color: orange; font-weight: bold; background: black",
  "color: white; font-weight: bold; background: dimgray",
);

// Register the card with Home Assistant
window.customCards = window.customCards || [];
window.customCards.push({
  type: "family-calendar-card",
  name: "Family Calendar Card",
  description: "A calendar card for family scheduling",
  preview: true,
});

// Define interfaces
interface CalendarEvent {
  start: Date;
  end: Date;
  title: string;
  calendar: string;
  location?: string;
  description?: string;
  color?: string;
}

interface ColorFilter {
  pattern: string;
  color: string;
}

interface CalendarCardConfig {
  type: string;
  entities: string[];
  show_header?: boolean;
  title?: string;
  color_filters?: ColorFilter[];
}

interface HACalendarEvent {
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  summary: string;
  location?: string;
  description?: string;
  colorId?: string;
}

interface MenuData {
  date: string;
  items: string[];
}

// Define the custom element
class FamilyCalendarCard extends LitElement implements LovelaceCard {
  public static getConfigElement(): LovelaceCardEditor {
    return document.createElement("family-calendar-card-editor");
  }

  public static getStubConfig(): Record<string, unknown> {
    return {
      entities: ["calendar.test_name"],
      show_header: true,
      title: "Family Calendar",
      color_filters: [
        { pattern: "calli", color: "Plum" },
        { pattern: "jess", color: "PaleGreen" },
        { pattern: "david", color: "LightSkyBlue" },
        { pattern: "cambria", color: "LightPink" },
      ],
    };
  }

  // Required by LovelaceCard interface
  public async getCardSize(): Promise<number> {
    return 12; // Calendar takes up significant space
  }

  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) public config!: CalendarCardConfig;
  @state() private _events?: CalendarEvent[];
  @state() private _error?: string;
  @state() private _menuData: MenuData[] | null = null;
  @query("#calendar") private calendarEl!: HTMLElement;
  private calendar?: Calendar;

  static styles = css`
    :host {
      display: block;
      height: 100%;
      --fc-border-color: var(--divider-color, rgba(255, 255, 255, 0.06));
      --fc-page-bg-color: var(--card-background-color, #fff);
      --fc-neutral-bg-color: var(--card-background-color, #fff);
      --fc-event-text-color: black;
      --fc-list-event-hover-bg-color: rgba(0, 0, 0, 0.06);
      --fc-small-font-size: 0.85em;
      --fc-neutral-text-color: black;
      --fc-button-text-color: black;
      --fc-button-active-bg-color: var(--primary-color);
      --fc-button-active-text-color: white;
    }

    ha-card {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 16px;
      box-sizing: border-box;
      background: var(--ha-card-background, var(--card-background-color, #fff));
    }

    #calendar {
      height: 100%;
      width: 100%;
    }

    .fc {
      height: 100%;
      color: var(--primary-text-color);
    }

    /* Remove most borders */
    .fc th,
    .fc td {
      border: none !important;
    }

    .fc-theme-standard .fc-scrollgrid {
      border: none !important;
    }

    /* Header styling */
    .fc .fc-toolbar-title {
      font-size: 1.4em;
      font-weight: 600;
      color: black;
    }

    .fc .fc-col-header-cell {
      padding: 8px 4px;
      background: transparent;
      border-right: 1px solid var(--fc-border-color) !important;
    }

    .fc .fc-col-header-cell-cushion {
      padding: 4px;
      color: black;
      font-weight: 600;
      font-size: 3em;
    }

    /* Time grid styling */
    .fc .fc-timegrid-slot {
      height: 4.5em !important;
      border-bottom: 1px solid var(--fc-border-color) !important;
    }

    /* Add vertical lines between days */
    .fc .fc-timegrid-col {
      border-right: 1px solid var(--fc-border-color) !important;
    }

    /* Remove borders from time axis and add more space */
    .fc .fc-timegrid-axis {
      border: none !important;
    }

    .fc .fc-timegrid-axis-frame {
      border: none !important;
    }

    .fc .fc-timegrid-axis-cushion,
    .fc .fc-timegrid-slot-label-cushion {
      color: black;
      font-size: 1.5em;
      font-weight: 400;
      padding-right: 8px;
      transform: translateY(-85%);
      line-height: 1.5;
      text-transform: lowercase;
    }

    /* Remove hour lines in time label column */
    .fc .fc-timegrid-slot-label {
      border-bottom: none !important;
      vertical-align: top;
    }

    .fc .fc-timegrid-slot.fc-timegrid-slot-label {
      border-bottom: none !important;
    }

    /* Event styling */
    .fc-timegrid-event {
      border-radius: 16px !important;
      border: none !important;
      padding: 6px 8px !important;
    }

    .fc-timegrid-event .fc-event-main {
      padding: 2px;
    }

    .fc-timegrid-event .fc-event-title {
      font-weight: 600;
      font-size: 2em;
      color: black;
      margin-bottom: 8px;
    }

    .fc-timegrid-event .fc-event-time {
      font-size: 2em;
      color: rgba(0, 0, 0, 0.7);
      font-weight: 400;
    }

    /* Current time indicator */
    .fc .fc-timegrid-now-indicator-line {
      border-color: #ff5252;
      border-width: 2px;
    }

    .fc .fc-timegrid-now-indicator-arrow {
      border-color: #ff5252;
      border-width: 5px;
    }

    /* Today column highlight */
    .fc .fc-day-today {
      background: transparent !important;
    }

    .fc .fc-day-today .fc-col-header-cell-cushion {
      color: var(--primary-color);
      font-weight: 700;
    }

    /* Toolbar buttons */
    .fc .fc-button {
      background: transparent;
      border: none;
      color: black;
      text-transform: uppercase;
      font-weight: 600;
      font-size: 0.9em;
      padding: 6px 12px;
    }

    .fc .fc-button:hover {
      background: rgba(0, 0, 0, 0.06);
    }

    .fc .fc-button-active {
      background: var(--primary-color) !important;
      color: white !important;
    }

    /* Scrollbar styling */
    .fc-scroller::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    .fc-scroller::-webkit-scrollbar-track {
      background: transparent;
    }

    .fc-scroller::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.1);
      border-radius: 4px;
    }

    .fc-scroller::-webkit-scrollbar-thumb:hover {
      background: rgba(0, 0, 0, 0.2);
    }

    /* Handle overlapping events */
    .fc .fc-timegrid-col-events {
      margin: 0 !important;
      padding: 0 !important;
    }

    /* Base event styling */
    .fc-timegrid-event {
      border-radius: 16px !important;
      border: none !important;
      padding: 6px 8px !important;
      margin: 0 !important;
    }

    /* Make overlapping events take half width */
    .fc-v-event.fc-event-mirror,
    .fc-v-event {
      margin: 0 !important;
      border-radius: 16px !important;
    }

    /* Overlapping events */
    .fc-timegrid-event-harness-inset.fc-timegrid-event-harness-overlap {
      width: calc(50% - 4px) !important;
    }

    /* Second overlapping event */
    .fc-timegrid-event-harness-inset.fc-timegrid-event-harness-overlap
      + .fc-timegrid-event-harness-inset.fc-timegrid-event-harness-overlap {
      margin-left: calc(50% + 4px) !important;
    }

    /* Non-overlapping events */
    .fc-timegrid-event-harness:not(.fc-timegrid-event-harness-overlap) {
      width: 100% !important;
    }

    /* Event content spacing */
    .fc-timegrid-event .fc-event-main {
      padding: 2px;
    }

    .fc-timegrid-event .fc-event-title {
      font-weight: 600;
      font-size: 2em;
      color: black;
      margin-bottom: 8px;
    }

    .fc-timegrid-event .fc-event-time {
      font-size: 2em;
      color: rgba(0, 0, 0, 0.7);
      font-weight: 400;
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
  }

  async connectedCallback() {
    super.connectedCallback();
    console.log("Connected callback called");
    await this._initializeCard();
  }

  private async _initializeCard() {
    if (!this.config || !this.hass) {
      console.log("Waiting for config and hass to be ready...");
      return;
    }

    try {
      await menuCacheService.initializeCache();
      this._menuData = menuCacheService.getCachedMenu();
      await this._fetchCalendarEvents();
    } catch (error) {
      console.error("Error initializing:", error);
      this._error = "Failed to initialize calendar";
    }
  }

  async firstUpdated() {
    console.log("First updated called");
    await this._initializeCalendar();
    // Fetch events again after calendar is initialized
    await this._fetchCalendarEvents();
  }

  private async _initializeCalendar() {
    if (!this.calendarEl) {
      console.error("Calendar element not found");
      return;
    }

    console.log("Initializing calendar with element:", this.calendarEl);

    const calendarOptions: CalendarOptions = {
      plugins: [
        timeGridPlugin,
        dayGridPlugin,
        interactionPlugin,
        scrollGridPlugin,
      ],
      initialView: "timeGridFourDay",
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "",
      },
      views: {
        timeGridFourDay: {
          type: "timeGrid",
          duration: { days: 4 },
          buttonText: "4 Day",
          dayHeaderFormat: { weekday: "short", day: "numeric" },
          allDaySlot: true,
          allDayText: "All Day",
          slotDuration: "01:00:00", // Changed to 1-hour slots
          slotLabelInterval: "01:00",
          slotMinTime: "06:00:00",
          slotMaxTime: "20:00:00",
          scrollTime: "08:00:00", // Start scrolled to 8 AM
          slotLabelFormat: {
            hour: "numeric",
            minute: "2-digit",
            omitZeroMinute: true,
            hour12: true,
          },
        },
      },
      height: "100%",
      expandRows: true,
      nowIndicator: true,
      dayMinWidth: 200,
      allDayMaintainDuration: true,
      eventMinHeight: 35, // Increased minimum height
      eventShortHeight: 40, // Increased short height
      eventOrder: "start,-duration,allDay,title",
      eventTimeFormat: {
        hour: "numeric",
        minute: "2-digit",
        meridiem: "short",
      },
      eventContent: (arg) => {
        const timeText = arg.timeText;
        const title = arg.event.title;
        const type = arg.event.extendedProps?.type;
        const start = arg.event.start?.getTime() ?? 0;
        const end = arg.event.end?.getTime() ?? start;
        const duration = end - start;
        const showTime = duration >= 60 * 60 * 1000; // Show time for events 1 hour or longer

        if (type === "meal") {
          return {
            html: `<div class="fc-event-main-content">
                    <div class="fc-event-title">🍽️ ${title}</div>
                  </div>`,
          };
        }

        return {
          html: `<div class="fc-event-main-content">
                  <div class="fc-event-title">${title}</div>
                  ${
                    !arg.event.allDay && showTime
                      ? `<div class="fc-event-time">${timeText}</div>`
                      : ""
                  }
                </div>`,
        };
      },
    };

    this.calendar = new Calendar(this.calendarEl, calendarOptions);
    console.log("Calendar instance created:", this.calendar);

    // Add initial events
    const events = this._getCalendarEvents();
    console.log("Initial events:", events);
    this.calendar.addEventSource(events);

    this.calendar.render();
    console.log("Calendar rendered");
  }

  private _getCalendarEvents(): EventSourceInput {
    const events: EventInput[] = [];

    // Add meal plan events at the top
    if (this._menuData) {
      events.push(
        ...this._menuData.map((menu) => ({
          title: menu.items.join(", "),
          start: `${menu.date}`,
          end: `${menu.date}`,
          backgroundColor: "rgb(255, 243, 224)", // Light yellow for meal events
          textColor: "black",
          display: "block",
          allDay: true,
          extendedProps: {
            type: "meal",
            order: 1,
          },
        })),
      );
    }

    // Add regular calendar events
    if (this._events) {
      events.push(
        ...this._events.map((event) => {
          const isAllDay =
            (event.start.getHours() === 0 &&
              event.start.getMinutes() === 0 &&
              event.end.getHours() === 0 &&
              event.end.getMinutes() === 0) ||
            event.end.getTime() - event.start.getTime() >= 24 * 60 * 60 * 1000;

          const backgroundColor = this._getEventClass(event);

          return {
            title: event.title,
            start: event.start,
            end: event.end,
            allDay: isAllDay,
            backgroundColor,
            textColor: "black",
            extendedProps: {
              calendar: event.calendar,
              location: event.location,
              description: event.description,
              type: "regular",
              order: 2,
            },
          };
        }),
      );
    }

    return events;
  }

  private async _fetchCalendarEvents() {
    if (!this.config?.entities || !this.hass) {
      console.warn("No config or hass available");
      return;
    }

    console.log("Fetching calendar events for entities:", this.config.entities);

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 30);

    try {
      const events: CalendarEvent[] = [];
      for (const entityId of this.config.entities) {
        const calendar = this.hass.states[entityId];
        if (!calendar) {
          console.warn(`Calendar entity not found: ${entityId}`);
          continue;
        }

        try {
          console.log(`Fetching events for ${entityId}`);
          const result = await this.hass.callApi<HACalendarEvent[]>(
            "GET",
            `calendars/${entityId}?start=${start.toISOString()}&end=${end.toISOString()}`,
          );
          console.log(`Received events for ${entityId}:`, result);

          const calendarEvents = result.map((event) => ({
            start: new Date(event.start.dateTime || event.start.date || ""),
            end: new Date(event.end.dateTime || event.end.date || ""),
            title: event.summary,
            calendar: entityId,
            location: event.location,
            description: event.description,
            color: event.colorId ? this._getCalendarColor(entityId) : undefined,
          }));
          events.push(...calendarEvents);
        } catch (error) {
          console.error(`Error fetching events for ${entityId}:`, error);
        }
      }

      console.log("All events fetched:", events);
      this._events = events;

      if (this.calendar) {
        console.log("Updating calendar with new events");
        this.calendar.removeAllEvents();
        const calendarEvents = this._getCalendarEvents();
        console.log("Calendar events to add:", calendarEvents);
        this.calendar.addEventSource(calendarEvents);
      } else {
        console.warn("Calendar not initialized when trying to update events");
      }
    } catch (error) {
      console.error("Error in _fetchCalendarEvents:", error);
      this._error = "Failed to load calendar events";
    }
  }

  private _getCalendarColor(calendarId: string): string {
    const calendar = this.hass?.states[calendarId];
    if (calendar?.attributes?.color) {
      return calendar.attributes.color;
    }

    // Pastel color palette
    const colors = {
      "calendar.personal": "var(--fc-event-blue-color)",
      "calendar.work": "var(--fc-event-purple-color)",
      "calendar.family": "var(--fc-event-green-color)",
      "calendar.holidays": "var(--fc-event-yellow-color)",
      default: "var(--fc-event-default-color)",
    };

    return colors[calendarId] || colors.default;
  }

  private _getEventClass(event: CalendarEvent): string {
    // First check text filters if configured
    if (this.config.color_filters) {
      for (const filter of this.config.color_filters) {
        if (event.title.toLowerCase().includes(filter.pattern.toLowerCase())) {
          // Return the color directly for RGB values
          return filter.color;
        }
      }
    }

    // Fall back to calendar-based colors if no filter match
    const defaultColors = {
      "calendar.personal": "rgb(3, 155, 229)", // David's blue
      "calendar.work": "rgb(142, 36, 170)", // Calli's purple
      "calendar.family": "rgb(51, 182, 121)", // Jess's green
      "calendar.holidays": "rgb(230, 124, 115)", // Cambria's color
    };

    return defaultColors[event.calendar] || "rgb(3, 155, 229)"; // Default to blue
  }

  render() {
    if (!this.config || !this.hass) {
      return html``;
    }

    return html`
      <ha-card>
        ${this._error ? html`<div class="error">${this._error}</div>` : ""}
        <div id="calendar"></div>
      </ha-card>
    `;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.calendar) {
      this.calendar.destroy();
    }
  }
}

// Register the element
if (!customElements.get("family-calendar-card")) {
  customElements.define("family-calendar-card", FamilyCalendarCard);
  console.info(
    "%c FAMILY-CALENDAR-CARD %c Version 1.0.0 ",
    "color: orange; font-weight: bold; background: black",
    "color: white; font-weight: bold; background: dimgray",
  );
}

// Export for TypeScript
export default FamilyCalendarCard;
