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
  view_range?: {
    start: string; // Format: "HH:mm:ss"
    end: string; // Format: "HH:mm:ss"
  };
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
      view_range: {
        start: "06:00:00",
        end: "19:00:00",
      },
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
      font-family: "Noto Sans", sans-serif;
    }

    ha-card {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 12px 0 0 12px;
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
      border-right: none !important;
      text-align: left;
    }

    .fc .fc-col-header-cell-cushion {
      padding: 4px 8px;
      color: black;
      font-weight: 500;
      font-size: 3em;
      text-align: left;
      text-decoration: none !important;
    }

    /* Time grid styling */
    .fc .fc-timegrid-slot {
      height: 7em;
      border-bottom: 1px solid var(--fc-border-color) !important;
    }

    .fc .fc-timegrid-col {
      border-right: 1px solid var(--fc-border-color) !important;
    }

    /* Remove borders only from time axis */
    .fc .fc-timegrid-axis {
      border: none !important;
    }

    .fc .fc-timegrid-axis-frame {
      border: none !important;
    }

    /* Hide all-day text */
    .fc-timegrid-axis-cushion.fc-scrollgrid-shrink-cushion {
      display: none !important;
    }

    /* Remove borders only from time axis cells */
    .fc .fc-timegrid-axis-chunk > table,
    .fc .fc-timegrid-axis-chunk > table td,
    .fc .fc-timegrid-axis td {
      border: none !important;
    }

    /* Keep borders for day columns but remove from axis */
    .fc .fc-timegrid-slots td.fc-timegrid-slot {
      border-bottom: 1px solid var(--fc-border-color) !important;
    }

    .fc .fc-timegrid-slots td.fc-timegrid-axis {
      border: none !important;
    }

    /* Time label styling */
    .fc .fc-timegrid-axis-cushion,
    .fc .fc-timegrid-slot-label-cushion {
      color: black;
      font-size: 1.5em;
      font-weight: 400;
      padding: 0;
      text-transform: lowercase;
      text-align: right;
      position: relative;
      width: auto;
      transform: translateY(-240%);
      top: 50%;
    }

    /* Ensure time labels are properly positioned */
    .fc .fc-timegrid-slot-label {
      vertical-align: middle;
      text-align: right;
      position: relative;
      padding-right: 8px;
    }

    .fc .fc-timegrid-axis.fc-scrollgrid-shrink {
      text-align: right;
      padding-right: 8px;
    }

    /* Remove horizontal lines between time slots in the axis */
    .fc .fc-timegrid-axis-chunk {
      border-bottom: none !important;
    }

    .fc .fc-timegrid-slots tr {
      border-bottom: none !important;
    }

    /* Event styling */
    .fc-timegrid-event,
    .fc-daygrid-event {
      border-radius: 12px !important;
      border: none !important;
      padding: 6px 8px !important;
      margin: 0 0 !important;
      line-height: 1.3 !important;
    }

    /* Make events fill the column width */
    .fc .fc-timegrid-col-events,
    .fc .fc-daygrid-day-events {
      margin: 0 !important;
      padding: 0 1px !important;
    }

    .fc-timegrid-event .fc-event-main,
    .fc-daygrid-event .fc-event-main {
      padding: 2px;
    }

    .fc-timegrid-event .fc-event-title,
    .fc-daygrid-event .fc-event-title {
      font-weight: 600;
      font-size: 2em;
      color: black;
      margin-bottom: 2px;
    }

    .fc-timegrid-event .fc-event-time,
    .fc-daygrid-event .fc-event-time {
      font-size: 2em;
      color: rgba(0, 0, 0, 0.7);
      font-weight: 400;
    }

    /* All-day section styling */
    .fc .fc-daygrid-body {
      border-bottom: 2px solid var(--fc-border-color) !important;
    }

    /* Container for all-day events */
    .fc .fc-daygrid-day-frame {
      display: flex !important;
      flex-direction: column !important;
      padding: 4px !important;
      gap: 8px !important;
    }

    /* Create two distinct sections */
    .fc .fc-daygrid-day-events {
      display: flex !important;
      flex-direction: column !important;
      gap: 8px !important;
    }

    /* Meal events section */
    .fc .fc-daygrid-day-events .meal-events-container {
      border: 2px solid #ff0000 !important;
      min-height: 40px !important;
      padding: 4px !important;
      margin: 2px !important;
    }

    /* All-day events section */
    .fc .fc-daygrid-day-events .all-day-events-container {
      border: 2px solid #0000ff !important;
      min-height: 40px !important;
      padding: 4px !important;
      margin: 2px !important;
    }

    /* Event styling */
    .fc-daygrid-event {
      border: none !important;
      margin: 2px 0 !important;
    }

    .fc-daygrid-block-event {
      min-height: 30px !important;
      display: flex !important;
      align-items: center !important;
    }

    /* Event content styling */
    .fc-daygrid-event .fc-event-main {
      padding: 2px !important;
    }

    .fc-daygrid-event .fc-event-title {
      font-weight: 400 !important;
      font-size: 1.5em !important;
    }

    /* Event positioning */
    .fc .fc-daygrid-event[data-event-type="meal"] {
      margin: 0 !important;
    }

    .fc .fc-daygrid-event:not([data-event-type="meal"]) {
      margin: 0 !important;
    }

    /* Remove the debug border */
    .fc .fc-daygrid-day {
      border: none !important;
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
      color: black;
      font-weight: 500;
    }

    /* Toolbar buttons */
    .fc .fc-button {
      background: transparent;
      border: 1px solid rgba(0, 0, 0, 0.1);
      color: black;
      text-transform: uppercase;
      font-weight: 600;
      font-size: 0.9em;
      padding: 6px 12px;
      border-radius: 4px;
      margin: 0 4px;
    }

    .fc .fc-button:hover {
      background: rgba(0, 0, 0, 0.06);
      border-color: rgba(0, 0, 0, 0.2);
    }

    .fc .fc-button-active,
    .fc .fc-today-button {
      background: var(--primary-color) !important;
      border-color: var(--primary-color) !important;
      color: white !important;
    }

    .fc .fc-button:disabled {
      opacity: 0.6;
      cursor: default;
      background: rgba(0, 0, 0, 0.06) !important;
      border-color: rgba(0, 0, 0, 0.1) !important;
      color: rgba(0, 0, 0, 0.6) !important;
    }

    /* Scrollbar styling */
    .fc-scroller {
      scrollbar-width: none !important; /* Firefox */
      -ms-overflow-style: none !important; /* IE and Edge */
    }

    .fc-scroller::-webkit-scrollbar {
      display: none !important; /* Chrome, Safari and Opera */
    }

    /* Hide license message */
    .fc-license-message {
      display: none !important;
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
      initialView: "timeGridFiveDay",
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "",
      },
      views: {
        timeGridFiveDay: {
          type: "timeGrid",
          duration: { days: 5 },
          buttonText: "5 Day",
          dayHeaderFormat: {
            weekday: "short",
            day: "numeric",
            separator: " ",
          },
          allDaySlot: true,
          allDayText: "All Day",
          slotDuration: "01:00:00",
          slotLabelInterval: "01:00",
          slotMinTime: "00:00:00",
          slotMaxTime: "24:00:00",
          scrollTime: this.config.view_range?.start || "06:00:00",
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
      eventMinHeight: 35,
      eventShortHeight: 40,
      eventOrder: "start,-duration,allDay,title",
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
            html: `<div class="meal-events-container">
                    <div class="fc-event-main-content">
                      <div class="fc-event-title">${title}</div>
                    </div>
                  </div>`,
          };
        }

        if (arg.event.allDay) {
          return {
            html: `<div class="all-day-events-container">
                    <div class="fc-event-main-content">
                      <div class="fc-event-title">${title}</div>
                    </div>
                  </div>`,
          };
        }

        return {
          html: `<div class="fc-event-main-content">
                  <div class="fc-event-title">${title}</div>
                  ${
                    showTime
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
        ...this._menuData
          .filter(
            (menu) =>
              menu.items.length > 0 && menu.items.join(", ").trim() !== "",
          )
          .map((menu) => ({
            title: menu.items.join(", "),
            start: `${menu.date}`,
            end: `${menu.date}`,
            backgroundColor: "Gold",
            textColor: "black",
            display: "block",
            allDay: true,
            classNames: ["meal-event"],
            extendedProps: {
              type: "meal",
              order: 2,
            },
            dataEventType: "meal",
          })),
      );
    }

    // Add regular calendar events
    if (this._events) {
      events.push(
        ...this._events
          .filter((event) => event.title !== "-NO SCHOOL-")
          .map((event) => {
            const isAllDay =
              (event.start.getHours() === 0 &&
                event.start.getMinutes() === 0 &&
                event.end.getHours() === 0 &&
                event.end.getMinutes() === 0) ||
              event.end.getTime() - event.start.getTime() >=
                24 * 60 * 60 * 1000;

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

    // Lighter blue color for all calendars if no filter match
    return "rgb(100, 181, 246)"; // Lighter blue color
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
