import { html, css, LitElement, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { localize } from "../localize/localize";
import { HomeAssistant } from "../ha-types";
import {
  getIcon,
  isOfflineState,
  mapStateDisplay,
} from "../google-button/google-button-mapper";
import {
  DEFAULT_CONFIG,
  GoogleClimateCardConfig,
} from "./google-climate-const";
import { fireEvent } from "custom-card-helpers";
import { applyRippleEffect } from "../utils";

@customElement("google-climate-card")
export class GoogleClimateCard extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config: GoogleClimateCardConfig = DEFAULT_CONFIG;

  public setConfig(config: GoogleClimateCardConfig): void {
    if (!config || !config.entity) {
      throw new Error(localize("common.invalid_configuration"));
    }
    this._config = config;
  }

  public static getStubConfig(
    _hass: HomeAssistant,
    entities: string[]
  ): Partial<GoogleClimateCardConfig> {
    const switcher = entities
      .filter((entity) => entity.split(".")[0] === "climate")
      .sort();
    const randomClimate = switcher[Math.floor(Math.random() * switcher.length)];
    return {
      type: "custom:google-climate-card",
      entity: randomClimate,
      increase_temp: 1,
      decrease_temp: 1,
      use_material_color: true,
      use_default_icon: true,
    };
  }

  static getCardSize() {
    return 1;
  }

  static async getConfigElement() {
    return document.createElement("google-climate-card-editor");
  }

  public _onClick(event: MouseEvent) {
    applyRippleEffect(event.currentTarget as HTMLElement, event);
    if (navigator.vibrate) {
      navigator.vibrate(60);
    }

    if (!this._config || !this.hass) return;

    const entityId = this._config.entity;

    fireEvent(this, "hass-more-info", { entityId });
  }

  private async _adjustTemp(delta: number): Promise<void> {
    if (navigator.vibrate) {
      navigator.vibrate(60);
    }
    if (!this.hass || !this._config?.entity) return;

    const stateObj = this.hass.states[this._config.entity];
    const current = Number(stateObj?.attributes?.temperature);
    if (isNaN(current)) return;

    const newTemp = current + delta;

    this.hass.states[this._config.entity]!.attributes!.temperature! = newTemp;

    await this.hass.callService("climate", "set_temperature", {
      entity_id: this._config.entity,
      temperature: newTemp,
    });

    // Attendi un momento per permettere a HASS di aggiornare lo stato
    setTimeout(() => {
      this.requestUpdate(); // Forza il re-render manuale
    }, 500); // 500ms è solitamente sufficiente
  }

  private setColorCard(
    use_material_color: boolean,
    theme: string,
    isOffline: boolean,
    isOn: boolean
  ) {
    let nameColor = "";
    let iconColor = "";
    let adjustTemp = "";
    let internalTemp = "";
    let containerColor = "";
    if (isOffline) {
      // Offline, tema light
      if (theme === "light") {
        nameColor = iconColor = "#949496";
        containerColor = "rgba(223, 223, 225, 0.85)";
        //containerColor = "#dfdfe1";
      } else {
        // Offline, tema dark
        nameColor = iconColor = "#717173";
        containerColor = "#2c2c2e";
      }
    } else if (isOn) {
      // Acceso, tema dark
      if (theme === "dark") {
        if (use_material_color) {
          nameColor = iconColor = "#fedcca";
          adjustTemp = "#4b332b";
          internalTemp = "#e6c0b2";
          containerColor = "rgba(92, 64, 53, 0.85)";
          //containerColor = "#5c4035";
        } else {
          nameColor = iconColor = "#c3c3c3";
          adjustTemp = "#5c5b60";
          internalTemp = "#c1c2c6";
          containerColor = "rgba(65, 66, 70, 0.83)";
          //containerColor = "#414246";
        }
      } else {
        // Acceso, tema light
        if (use_material_color) {
          nameColor = iconColor = internalTemp = "#812800";
          adjustTemp = "rgba(245, 180, 150, 0.6)";
          containerColor = "rgba(258, 193.8, 166, 0.3)";
        } else {
          nameColor = iconColor = internalTemp = "#525252";
          //containerColor = "#d8e3f7";
          adjustTemp = "#c1c1c3";
          containerColor = "rgba(221, 221, 223, 0.83)";
        }
      }
    } else {
      // Spento, tema dark
      if (theme === "dark") {
        nameColor = iconColor = "#e3e3e5";
        containerColor = "#292a2e";
      } else {
        // Spento, tema light
        nameColor = iconColor = "#1b1b1d";
        containerColor = "#e8e8ea";
      }
    }

    this._setStyleProperty("--bsc-name-color", nameColor);
    this._setStyleProperty("--bsc-icon-color", iconColor);
    this._setStyleProperty("--bsc-adjustTemp-color", adjustTemp);
    this._setStyleProperty("--bsc-internalTemp-color", internalTemp);
    this._setStyleProperty("--bsc-background", containerColor);
  }

  _setStyleProperty(
    name: string,
    value: any,
    transform = (value: any): string => value
  ): void {
    if (value !== undefined && value !== null && value !== "") {
      this.style.setProperty(name, transform(value));
    }
  }

  protected render(): TemplateResult {
    if (!this._config || !this.hass) return html``;

    const stateObj = this.hass.states[this._config.entity!];
    if (!stateObj) {
      return html`<ha-card
        ><div class="warning">${localize("common.no_entity")}</div></ha-card
      >`;
    }

    const name = this._config.name || stateObj.attributes.friendly_name;
    const isOffline = isOfflineState(stateObj.state);

    const stateDisplay = mapStateDisplay(stateObj, "thermometer", isOffline);
    const theme = this.hass?.themes?.darkMode ? "dark" : "light";
    const isOn =
      stateObj.state === "on" ||
      stateObj.state === "auto" ||
      stateObj.state === "heat" ||
      stateObj.state === "cool";

    this.setColorCard(this._config.use_material_color, theme, isOffline, isOn);

    const config = {
      control_type: "thermometer",
      icon: this._config.icon,
      use_default_icon: this._config.use_default_icon,
      dual_icon: this._config.dual_icon,
      icon_on: this._config.icon_on,
      icon_off: this._config.icon_off,
    };

    return html`
      <div class="temperature-card">
        <div class="header" @click=${this._onClick}>
          <div class="valve-info">
            <ha-icon
              id="icon_offline"
              icon="${getIcon(stateObj, config)}"
              title="Climate"
              class="chevron"
              style="
                --mdc-icon-size: 20px;
                margin-top: -5px;
              "
            ></ha-icon>

            <span class="valve-name">${name}</span>
          </div>

          ${isOffline
            ? html`<ha-icon
                id="icon_offline"
                icon="mdi:alert"
                style="position: absolute; right: 0px; top: 50%; transform: translateY(-50%); color: var(--bsc-icon-color);"
                title="Offline"
              ></ha-icon>`
            : html`<ha-icon
                icon="m3rf:arrow-forward-ios"
                style="
                  position: absolute;
                  right: 0px;
                  top: 50%;
                  transform: translateY(-50%);
                  color: var(--bsc-icon-color);
                  --mdc-icon-size: 15px;
                "
                title="Enter"
                class="chevron"
              ></ha-icon> `}
        </div>
        ${isOffline
          ? html`
              <div class="temperature-control offline-control">
                <div class="temperature-display offline">Offline</div>
              </div>
            `
          : html`
              <div class="temperature-control">
                <button
                  class="control-btn minus-btn"
                  @click=${() =>
                    this._adjustTemp(
                      -this._config.decrease_temp |
                        -DEFAULT_CONFIG.decrease_temp
                    )}
                >
                  −
                </button>
                <div class="temperature-display" id="tempDisplay">
                  ${stateObj.attributes.temperature}
                </div>
                <button
                  class="control-btn plus-btn"
                  @click=${() =>
                    this._adjustTemp(
                      this._config.decrease_temp | DEFAULT_CONFIG.increase_temp
                    )}
                >
                  +
                </button>
              </div>

              <div class="internal-temp">
                <span id="internalTemp">${stateDisplay}</span>
              </div>
            `}
      </div>
    `;
  }

  static styles = css`
    .temperature-card {
      /* background: #414246;*/
      background: var(--bsc-background);
      border-radius: 28px;
      padding: 10px 15px;
      width: -webkit-fill-available;
      /* box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3); */
      box-shadow: none;
      position: relative;
      overflow: hidden;
    }

    .temperature-card::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      /* background: #414246;*/
      background: var(--bsc-background);
      border-radius: 24px;
      pointer-events: none;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 25px;
      position: relative;
      z-index: 2;
      pointer-events: visible;
      cursor: pointer;
      -webkit-user-select: none; /* Safari */
      -moz-user-select: none; /* Firefox */
      -ms-user-select: none; /* IE10+/Edge */
      user-select: none; /* Standard */
    }

    .valve-info {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 2px;
    }

    .steam-icon {
      color: #888;
      font-size: 20px;
    }

    .valve-name {
      /* color: #c3c3c3; */
      color: var(--bsc-name-color);
      font-size: 16px;
      font-weight: 500;
    }

    .chevron {
      /* color: #c3c3c3; */
      color: var(--bsc-icon-color);
      font-size: 20px;
      cursor: pointer;
      transition: color 0.2s ease;
    }

    .chevron:hover {
      color: #ccc;
    }

    .temperature-control {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 15px;
      position: relative;
      z-index: 2;
    }

    .control-btn {
      width: 80px;
      height: 55px;
      border-radius: 30px;
      /* background: #5c5b60; */
      background: var(--bsc-adjustTemp-color);
      border: none;
      /* color: #c3c3c3; */
      color: var(--bsc-name-color);
      font-size: 32px;
      font-weight: 300;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(10px);
      -webkit-tap-highlight-color: transparent;
    }

    .control-btn:hover {
      background: rgba(255, 255, 255, 0.15);
      transform: scale(1.05);
    }

    .control-btn:active {
      transform: scale(0.98);
    }

    .temperature-display {
      /* color: #c3c3c3; */
      color: var(--bsc-name-color);
      font-size: 72px;
      font-weight: 450;
      text-align: center;
      line-height: 1;
    }

    .internal-temp {
      text-align: center;
      /* color: #c1c2c6; */
      color: var(--bsc-internalTemp-color);
      font-size: 15px;
      font-weight: 400;
      position: relative;
      z-index: 2;
      margin-bottom: 20px;
    }

    .offline {
      font-size: 65px;
    }

    .offline-control {
      justify-content: center;
      margin-bottom: 61px;
      margin-top: 30px;
    }

    .ripple {
      position: absolute;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.3);
      transform: scale(0);
      animation: ripple 0.6s linear;
      pointer-events: none;
    }

    @keyframes ripple {
      to {
        transform: scale(4);
        opacity: 0;
      }
    }

    @media (max-width: 420px) {
      .valve-name,
      .state {
        font-size: 15px;
      }
      .valve-name {
        line-height: 1.4;
      }

      .temperature-display {
        font-size: 60px;
      }

      .control-btn {
        width: 65px;
        height: 45px;
        font-size: 28px;
      }

      .offline {
        font-size: 55px;
      }

      .offline-control {
        margin-bottom: 59px;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "google-climate-card": GoogleClimateCard;
  }
}
