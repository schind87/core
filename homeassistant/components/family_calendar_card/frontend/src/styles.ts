import { css } from "lit";

export const styles = css`
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
    width: 100%;
    background: white;
  }

  .time-slot {
    position: absolute;
    left: 0;
    right: 0;
    width: 100%;
    display: flex;
    align-items: center;
    padding-right: 10px;
    justify-content: flex-end;
    color: var(--secondary-text-color);
    font-size: 0.9em;
    transform: translateY(-50%);
    pointer-events: none;
  }

  /* ... rest of your existing styles ... */
`;
