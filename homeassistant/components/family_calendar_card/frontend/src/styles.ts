/*
 * File: src/styles.ts
 * Description: Styles for the Family Calendar card
 */

import { css } from "lit";

export const styles = css`
  :host {
    display: block;
  }

  .calendar-container {
    display: flex;
    height: 100%;
    min-height: 600px;
    padding: 16px;
  }

  .time-column {
    width: 60px;
    padding-top: 40px;
    border-right: 1px solid var(--divider-color, #e0e0e0);
  }

  .time-marker {
    height: 60px;
    font-size: 0.8em;
    color: var(--secondary-text-color);
    text-align: right;
    padding-right: 8px;
  }

  .events-container {
    flex: 1;
    position: relative;
    margin-left: 8px;
  }

  .event {
    position: absolute;
    left: 0;
    right: 8px;
    padding: 8px;
    border-radius: 4px;
    font-size: 0.9em;
    cursor: pointer;
    transition: box-shadow 0.2s ease-in-out;
  }

  .event:hover {
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .event-title {
    font-weight: 500;
    margin-bottom: 4px;
  }

  .event-time {
    font-size: 0.8em;
    opacity: 0.8;
  }

  .error {
    padding: 16px;
    color: var(--error-color, #db4437);
  }
`;
