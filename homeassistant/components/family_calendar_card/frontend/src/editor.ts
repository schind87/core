import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  HomeAssistant,
  fireEvent,
  LovelaceCardEditor,
} from "custom-card-helpers";

@customElement("family-calendar-card-editor")
export class FamilyCalendarCardEditor
  extends LitElement
  implements LovelaceCardEditor
{
  @property({ attribute: false }) public hass?: HomeAssistant;
  @property({ attribute: false }) private _config?: any;
  @property({ attribute: false }) private _configEntities?: string[];

  public setConfig(config: any): void {
    this._config = config;
    this._configEntities = config.entities || [];
  }

  private _valueChanged(ev: any): void {
    const target = ev.target;
    if (!this._config || !target) {
      return;
    }

    if (target.configValue) {
      if (target.configValue === "entities") {
        this._configEntities = target.value;
      }
      if (this.hass) {
        fireEvent(this, "config-changed", {
          config: {
            ...this._config,
            [target.configValue]:
              target.checked !== undefined ? target.checked : target.value,
          },
        });
      }
    }
  }

  protected render() {
    if (!this.hass || !this._config) {
      return html``;
    }

    return html`
      <div class="card-config">
        <ha-entity-picker
          .label="${this.hass.localize(
            "ui.panel.lovelace.editor.card.generic.entities",
          )} (${this.hass.localize(
            "ui.panel.lovelace.editor.card.config.required",
          )})"
          .hass=${this.hass}
          .value=${this._configEntities}
          .configValue=${"entities"}
          .includeDomains=${["calendar"]}
          .multiple=${true}
          @value-changed=${this._valueChanged}
        ></ha-entity-picker>
      </div>
    `;
  }

  static styles = css`
    .card-config {
      padding: 16px;
    }
  `;
}
