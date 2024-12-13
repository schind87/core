import { css } from "lit";

export const styles = css`
  :host {
    display: block;
    height: 100%;
    overflow: hidden;
    --hour-height: 60px;
    --time-column-width: 100px;
    --border-color: var(--divider-color, rgba(255, 255, 255, 0.2));
    --header-height: 100px;
  }

  html,
  body {
    height: 100%;
    margin: 0;
    overflow: hidden;
  }

  #app {
    height: 100%;
    overflow: hidden;
  }

  ha-card {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 0;
    overflow: hidden;
    background: var(
      --ha-card-background,
      var(--card-background-color, #1c1c1c)
    );
  }

  .calendar-card {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .header-scroll-container {
    position: sticky;
    top: 0;
    z-index: 4;
    background: var(
      --ha-card-background,
      var(--card-background-color, #1c1c1c)
    );
    border-bottom: 1px solid var(--border-color);
  }

  .header-content {
    height: var(--header-height);
  }

  .day-column-header,
  .day-column,
  .all-day-column,
  .meal-plan-column {
    width: 100%;
    box-sizing: border-box;
    border-right: 1px solid var(--border-color);
    margin: 0;
    padding: 0;
  }

  .day-column-header {
    height: var(--header-height);
    line-height: var(--header-height);
    text-align: center;
    font-weight: 500;
  }

  .all-day-scroll-container,
  .meal-plan-scroll-container {
    background: var(
      --ha-card-background,
      var(--card-background-color, #1c1c1c)
    );
    border-bottom: 1px solid var(--border-color);
  }

  .all-day-content,
  .meal-plan-content {
    display: flex;
    flex: 1;
  }

  .all-day-column,
  .meal-plan-column {
    padding: 4px;
    position: relative;
    min-height: 40px;
  }

  .event.all-day,
  .event.meal-plan {
    margin: 2px 0;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.9em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .event.all-day {
    background: var(--light-primary-color, #7986cb);
    color: var(--text-primary-color, white);
  }

  .event.meal-plan {
    background: #ff9800;
    color: var(--text-primary-color, white);
    position: relative;
    width: calc(100% - 16px);
    box-sizing: border-box;
  }

  .main-scroll-container {
    display: flex;
    position: relative;
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    width: 100%;
    min-height: calc(24 * var(--hour-height));
    box-sizing: border-box;
  }

  .time-column {
    position: absolute;
    left: 0;
    top: 0;
    width: var(--time-column-width);
    height: 100%;
    background: var(
      --ha-card-background,
      var(--card-background-color, #1c1c1c)
    );
    z-index: 2;
    border-right: 1px solid var(--border-color);
  }

  .time-slot {
    position: absolute;
    right: 8px;
    font-size: 0.9em;
    color: var(--primary-text-color);
    transform: translateY(-50%);
  }

  .header-content,
  .main-content {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    width: 100%;
    margin: 0;
    padding: 0;
  }

  .day-column {
    position: relative;
  }

  .hour-line {
    position: absolute;
    left: 0;
    right: 0;
    width: 100%;
    height: 1px;
    background: var(--border-color);
    pointer-events: none;
  }

  .event {
    position: absolute;
    left: 4px;
    right: 4px;
    padding: 4px 8px;
    border-radius: 4px;
    background: #2196f3;
    color: var(--text-primary-color, white);
    font-size: 0.9em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    z-index: 1;
    min-width: 0;
    margin: 0 2px;
  }

  .event > div {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .main-scroll-container,
  .header-scroll-container,
  .all-day-scroll-container,
  .meal-plan-scroll-container {
    position: relative;
    margin-left: var(--time-column-width);
    width: calc(100% - var(--time-column-width));
    box-sizing: border-box;
  }

  .all-day-content,
  .meal-plan-content {
    display: flex;
    flex: 1;
  }

  .day-column,
  .meal-plan-column {
  }

  /* Column styles */
  .day-column,
  .header-column,
  .all-day-column,
  .meal-plan-column {
    flex: 1;
    border-right: 1px solid var(--border-color);
  }

  .day-column-header:last-child,
  .day-column:last-child,
  .all-day-column:last-child,
  .meal-plan-column:last-child {
    border-right: none;
  }

  /* Debugging styles */
  .header-content {
    border: 2px solid blue;
  }

  .day-column-header {
    border: 2px solid red;
  }

  .day-column {
    border: 2px solid green;
  }
`;
