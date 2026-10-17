// Map a control's new value to the standard HA action that sets it.
import type { WriteValue } from "./writes";

export interface ServiceCall {
  domain: string;
  service: string;
  data: Record<string, unknown>;
}

/** `value` is the new state; buttons and updates ignore it. */
export function serviceFor(domain: string, value: WriteValue): ServiceCall {
  switch (domain) {
    case "switch":
    case "light":
    case "siren":
      return { domain, service: value === true ? "turn_on" : "turn_off", data: {} };
    case "number":
      return { domain, service: "set_value", data: { value } };
    case "select":
      return { domain, service: "select_option", data: { option: value } };
    case "time":
      return { domain, service: "set_value", data: { time: value } };
    case "button":
      return { domain, service: "press", data: {} };
    case "update":
      return { domain, service: "install", data: {} };
    default:
      throw new Error(`${domain} entities cannot be changed`);
  }
}

/** Light brightness: HA uses 0–255, the slider shows percent. */
export function brightnessCall(percent: number): ServiceCall {
  return { domain: "light", service: "turn_on", data: { brightness_pct: percent } };
}
