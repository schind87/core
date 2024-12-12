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
import { VirtualScroller } from "./virtualScroller";

declare const __BUILD_VERSION__: string;

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

interface GoogleCalendarApiResponse {
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  summary: string;
  location?: string;
  colorId?: string;
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

interface ScrollState {
  left: number;
  top: number;
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
  @state() private _scrollState: ScrollState = { left: 0, top: 0 };
  @state() private _virtualScroller?: VirtualScroller;
  @state() private _resizeObserver?: ResizeObserver;

  // Generate time slots in 12-hour format
  private _timeSlots = Array.from({ length: 24 }, (_, i) => {
    const hour = i % 12 || 12;
    return `${hour}:00`;
  });

  static styles = css`
    :host {
      display: block;
      --ha-card-background: var(--card-background-color, white);
    }

    ha-card {
      display: flex;
      flex-direction: column;
      flex: 1;
      position: relative;
      padding: 0;
      background: var(--ha-card-background);
      height: calc(100vh - 130px);
      overflow: hidden;
    }

    .calendar-wrapper {
      display: flex;
      flex: 1;
      height: 100%;
      overflow: hidden;
      background: white;
    }

    .time-column {
      position: sticky;
      left: 0;
      width: 100px;
      background: white;
      z-index: 3;
      font-weight: 500;
      height: calc(100% - 130px);
      overflow-y: scroll;
      border-right: 1px solid rgba(0, 0, 0, 0.1);
      scrollbar-width: none;
      -ms-overflow-style: none;
      &::-webkit-scrollbar {
        display: none;
      }
    }

    .time-slots-container {
      position: relative;
      height: calc(var(--hour-height, 60px) * 24);
    }

    .time-slot {
      position: absolute;
      left: 0;
      width: 100px;
      display: flex;
      align-items: center;
      padding-right: 10px;
      justify-content: flex-end;
      color: var(--secondary-text-color);
      font-size: 0.9em;
      transform: translateY(-50%);
    }

    .calendar-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      width: 100%;
    }

    .header-section {
      position: sticky;
      top: 0;
      z-index: 10;
      background: white;
      display: flex;
      overflow-x: hidden;
      height: 130px;
      width: 100%;
    }

    .scrollable-content {
      flex: 1;
      overflow: auto;
      display: flex;
      position: relative;
      height: calc(100% - 130px);
      scrollbar-width: none; /* Firefox */
      -ms-overflow-style: none; /* IE and Edge */
      &::-webkit-scrollbar {
        display: none; /* Chrome, Safari, Opera */
      }
    }

    swiper-container {
      width: 100%;
      overflow: visible;
    }

    .virtual-slide {
      height: 100%;
      position: absolute;
      display: flex;
      flex-direction: column;
    }

    .day-card {
      display: flex;
      flex-direction: column;
      position: relative;
      height: 100%;
      width: 100%;
      background: white;
      border-right: 1px solid rgba(0, 0, 0, 0.1);
    }

    .day-header {
      position: sticky;
      top: 0;
      height: 50px;
      background: white;
      text-align: left;
      padding: 8px 16px;
      font-size: 42px;
      font-weight: 500;
      color: #000000;
      z-index: 4;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    }

    .all-day-section {
      position: sticky;
      top: 50px;
      min-height: 40px;
      background: white;
      z-index: 3;
      padding: 4px 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
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
      height: calc(var(--hour-height, 60px) * 24);
      background: white;
      width: 100%;
    }

    .event {
      position: absolute;
      left: 4px;
      right: 4px;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 32px;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #000000;
      background-color: #a4d8f9;
      display: flex;
      flex-direction: column;
      z-index: 1;
    }

    .event.meal-plan,
    .event.all-day {
      height: 32px;
      padding: 4px 12px;
      align-items: center;
      margin: 0 4px;
      line-height: 22px;
    }

    .event.all-day {
      background-color: #e1e1e1;
      font-size: 22px;
    }

    .event.meal-plan {
      background-color: #ffe5d9;
      font-size: 14px;
    }

    .event.meal-plan.error {
      background-color: #ffebee;
      color: #c62828;
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

    .virtual-slide:last-child .day-card {
      border-right: 1px solid rgba(0, 0, 0, 0.3);
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

      // Fetch initial calendar events
      await this._fetchCalendarEvents();

      // Prefetch initial visible range
      const container = this.shadowRoot?.querySelector(
        ".scrollable-content",
      ) as HTMLElement;
      if (container) {
        const { clientWidth } = container;
        const itemWidth = 305; // Default width before virtual scroller is initialized

        // Calculate initial visible range
        const startIndex = 0;
        const endIndex = Math.ceil(clientWidth / itemWidth) + 2;

        this._prefetchMenuData(startIndex, endIndex);
      }

      // Set up periodic refresh for calendar events
      setInterval(
        () => {
          this._fetchCalendarEvents();
        },
        5 * 60 * 1000,
      ); // Refresh every 5 minutes
    } catch (error) {
      console.error("Error initializing card data:", error);
      this._error = "Failed to load data";
    }
  }

  updated(changedProps: Map<string, any>) {
    if (changedProps.has("config") || changedProps.has("hass")) {
      this._initializeCard();
      this._fetchCalendarEvents();
    }
  }

  private async _fetchCalendarEvents() {
    if (!this.config?.entities || !this.hass) {
      return;
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 30); // Fetch a month of events

    try {
      const events: CalendarEvent[] = [];
      for (const entityId of this.config.entities) {
        const calendar = this.hass.states[entityId];
        if (!calendar) {
          console.warn(`Calendar entity not found: ${entityId}`);
          continue;
        }

        const response = await this.hass.callApi(
          "GET",
          `calendars/${entityId}?start=${start.toISOString()}&end=${end.toISOString()}`,
        );

        // Type guard to ensure response is an array of calendar events
        if (
          Array.isArray(response) &&
          response.every(
            (item) =>
              item &&
              typeof item === "object" &&
              "start" in item &&
              "end" in item &&
              "summary" in item,
          )
        ) {
          const calendarEvents = (response as GoogleCalendarApiResponse[]).map(
            (event) => ({
              start: new Date(event.start.dateTime || event.start.date || ""),
              end: new Date(event.end.dateTime || event.end.date || ""),
              title: event.summary,
              calendar: entityId,
              location: event.location,
              color: event.colorId,
            }),
          );
          events.push(...calendarEvents);
        }
      }

      this._events = events;
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      this._error = "Failed to load calendar events";
    }
  }

  firstUpdated() {
    // Wait for container to be ready
    const container = this.shadowRoot?.querySelector(".scrollable-content");
    if (container) {
      this._resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const availableHeight = entry.contentRect.height;
          console.log("Available height from observer:", availableHeight);

          if (availableHeight > 0) {
            // Calculate hour height to show 12 hours
            const hourHeight = Math.floor(availableHeight / 12);
            console.log("Hour height:", hourHeight);

            // Set the CSS custom property
            this.style.setProperty("--hour-height", `${hourHeight}px`);

            // Initialize other components now that we have the correct height
            this._initializeVirtualScroller();

            // Can disconnect observer after initial setup
            this._resizeObserver?.disconnect();
          }
        }
      });

      this._resizeObserver.observe(container);
    }

    // Add scroll event listeners
    const timeColumn = this.shadowRoot?.querySelector(".time-column");
    const scrollableContent = this.shadowRoot?.querySelector(
      ".scrollable-content",
    );

    timeColumn?.addEventListener("scroll", this._syncScroll.bind(this));
    scrollableContent?.addEventListener("scroll", this._syncScroll.bind(this));
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    // Clean up resize observer
    this._resizeObserver?.disconnect();

    // Remove scroll event listeners
    const timeColumn = this.shadowRoot?.querySelector(".time-column");
    const scrollableContent = this.shadowRoot?.querySelector(
      ".scrollable-content",
    );

    timeColumn?.removeEventListener("scroll", this._syncScroll.bind(this));
    scrollableContent?.removeEventListener(
      "scroll",
      this._syncScroll.bind(this),
    );
  }

  private async _initializeVirtualScroller() {
    const container = this.shadowRoot?.querySelector(
      ".scrollable-content",
    ) as HTMLElement;
    const headerContainer = this.shadowRoot?.querySelector(
      ".header-section",
    ) as HTMLElement;
    const scrollableContent = this.shadowRoot?.querySelector(
      ".scrollable-content",
    ) as HTMLElement;

    if (!container || !headerContainer || !scrollableContent) return;

    // Wait for next frame to ensure containers are sized
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const availableWidth = scrollableContent.clientWidth;
    const columnWidth = Math.floor(availableWidth / 5); // Use Math.floor to avoid decimal widths

    console.log("Initializing scroller:", {
      availableWidth,
      columnWidth,
      scrollableContentWidth: scrollableContent.clientWidth,
      scrollableContentOffsetWidth: scrollableContent.offsetWidth,
      headerWidth: headerContainer.clientWidth,
      headerOffsetWidth: headerContainer.offsetWidth,
    });

    this._virtualScroller = new VirtualScroller({
      container,
      headerContainer,
      itemWidth: columnWidth,
      overscan: 2,
      renderItem: (index: number) => this._renderDayColumn(index),
      renderHeader: (index: number) => this._renderDayHeader(index),
      onScroll: (state: { left: number; top: number }) => {
        this._scrollState = state;
        this._syncScroll(state);
      },
    });
  }

  private _syncScroll(eventOrState: Event | { left: number; top: number }) {
    const timeColumn = this.shadowRoot?.querySelector(
      ".time-column",
    ) as HTMLElement;
    const scrollableContent = this.shadowRoot?.querySelector(
      ".scrollable-content",
    ) as HTMLElement;

    if (!timeColumn || !scrollableContent) return;

    // Handle virtual scroller state
    if ("top" in eventOrState) {
      timeColumn.scrollTop = eventOrState.top;
      return;
    }

    // Handle direct scroll events
    const target = eventOrState.target as HTMLElement;
    if (target === timeColumn) {
      scrollableContent.scrollTop = target.scrollTop;
    } else if (target === scrollableContent) {
      timeColumn.scrollTop = target.scrollTop;
    }
  }

  private _renderDayColumn(index: number) {
    const date = new Date();
    date.setDate(date.getDate() + index);

    return html`
      <div class="virtual-slide" style="height: 100%;">
        <div class="day-card">
          <div class="hourly-section">
            ${this._timeSlots.map(
              (_, i) => html`
                <div class="hour-line" style="top: ${i * 60}px"></div>
              `,
            )}
            ${this._getEventsForDay(date)}
          </div>
        </div>
      </div>
    `;
  }

  private _renderDayHeader(index: number) {
    const date = new Date();
    date.setDate(date.getDate() + index);

    return html`
      <div class="virtual-slide">
        <div class="day-header">
          ${date
            .toLocaleDateString("en-US", {
              weekday: "short",
              day: "numeric",
            })
            .replace(",", "")}
        </div>
        <div class="all-day-section">${this._getAllDayEvents(date)}</div>
        <div class="meal-plan-section">${this._getMealPlan(date)}</div>
      </div>
    `;
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

  private _getDateForIndex(index: number): string {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return date.toISOString().split("T")[0];
  }

  protected _prefetchMenuData(startIndex: number, endIndex: number) {
    // Prefetch an additional week ahead
    const prefetchEndIndex = endIndex + 7;

    for (let i = startIndex; i <= prefetchEndIndex; i++) {
      const date = this._getDateForIndex(i);
      if (date) {
        menuCacheService.getCachedMenu(date);
      }
    }
  }

  protected override update(changedProps: Map<string, unknown>) {
    super.update(changedProps);

    if (this._virtualScroller) {
      const container = this.shadowRoot?.querySelector(
        ".scrollable-content",
      ) as HTMLElement;
      if (container) {
        const { scrollLeft, clientWidth } = container;
        const itemWidth = this._virtualScroller.getItemWidth();

        const startIndex = Math.max(0, Math.floor(scrollLeft / itemWidth) - 2);
        const endIndex = Math.min(
          1000, // Fixed number of items
          Math.ceil((scrollLeft + clientWidth) / itemWidth) + 2,
        );

        this._prefetchMenuData(startIndex, endIndex);
      }
    }
  }

  private _renderTimeColumn() {
    const hours: TemplateResult[] = [];

    // Hours 0-23 (starting with midnight)
    for (let i = 0; i < 24; i++) {
      const hour =
        i === 0
          ? "12:00"
          : i < 12
          ? `${i}:00`
          : i === 12
          ? "12:00"
          : `${i - 12}:00`;
      const ampm = i < 12 ? "am" : "pm";

      hours.push(html`
        <div
          class="time-slot"
          style="top: calc(${i} * var(--hour-height, 60px))"
        >
          ${hour}${ampm}
        </div>
      `);
    }

    return html`
      <div class="time-column">
        <div class="time-slots-container">${hours}</div>
      </div>
    `;
  }

  render() {
    if (!this.config || !this.hass) {
      return html``;
    }

    return html`
      <ha-card>
        <div class="calendar-wrapper">
          <div class="time-column">
            ${this._timeSlots.map(
              (time, i) => html`
                <div class="time-slot" style="top: ${i * 60}px">${time}</div>
              `,
            )}
          </div>
          <div class="calendar-container">
            <div class="header-section"></div>
            <div class="scrollable-content"></div>
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
    version: __BUILD_VERSION__,
  });
}

console.info(`Family Calendar Card version ${__BUILD_VERSION__} loaded`);
