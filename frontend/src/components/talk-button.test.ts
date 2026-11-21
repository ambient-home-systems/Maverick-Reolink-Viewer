import { afterEach, describe, expect, it, vi } from "vitest";

import type { TalkClient, TalkStats } from "../live/talk";
import type { HomeAssistant } from "../types";
import { HOLD_MS, type RvTalk, startError, talkEndedMessage } from "./talk-button";
import "./talk-button";

const unavailable = vi.hoisted(() => ({ reason: undefined as string | undefined }));
vi.mock("../live/talk", async (original) => ({
  ...(await original<typeof import("../live/talk")>()),
  talkUnavailable: () => unavailable.reason,
}));

const STATS: TalkStats = {
  open_ms: 512,
  blocks: 47,
  seconds: 3.01,
  gaps: 0,
  dropped_s: 0,
  ended: "stopped",
  error: null,
  close: "ok",
};

/** A talk client that starts and stops when told to. */
function fakeClient(options: { fail?: Error } = {}) {
  let ended: ((stats: TalkStats) => void) | undefined;
  const client = {
    start: vi.fn(() =>
      options.fail
        ? Promise.reject(options.fail)
        : Promise.resolve({ type: "started", handler_id: 1, sample_rate: 16000, idle_s: 10, max_s: 300, open_ms: 1 }),
    ),
    stop: vi.fn(() => Promise.resolve(STATS)),
  };
  return {
    client,
    make: (_hass: HomeAssistant, _device: string, onEnded: (stats: TalkStats) => void) => {
      ended = onEnded;
      return client as unknown as TalkClient;
    },
    end: (stats: TalkStats) => ended?.(stats),
  };
}

const settle = async (el: RvTalk) => {
  for (let i = 0; i < 3; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  await el.updateComplete;
};

async function mount(fake: ReturnType<typeof fakeClient>) {
  const el = document.createElement("rv-talk");
  el.hass = {} as HomeAssistant;
  el.deviceId = "door";
  el.cameraName = "Front Door";
  el.makeClient = fake.make;
  document.body.appendChild(el);
  await el.updateComplete;
  const button = () => {
    const found = el.shadowRoot?.querySelector<HTMLButtonElement>("button.talk");
    if (!found) throw new Error("no talk button");
    return found;
  };
  return { el, button };
}

const press = (button: HTMLButtonElement) => {
  button.dispatchEvent(new PointerEvent("pointerdown", { button: 0 }));
};
const release = (button: HTMLButtonElement) => {
  button.dispatchEvent(new PointerEvent("pointerup", { button: 0 }));
};

afterEach(() => {
  document.body.innerHTML = "";
  unavailable.reason = undefined;
  vi.useRealTimers();
});

describe("rv-talk", () => {
  it("starts on a tap and stops on the next one", async () => {
    const fake = fakeClient();
    const { el, button } = await mount(fake);
    expect(button().getAttribute("aria-label")).toBe("Talk through Front Door");
    press(button());
    release(button());
    await settle(el);
    expect(fake.client.start).toHaveBeenCalledOnce();
    expect(el._state).toBe("talking");
    expect(button().getAttribute("aria-pressed")).toBe("true");
    expect(button().textContent).toContain("Talking 0:00");
    // A tap now stops it.
    press(button());
    release(button());
    await settle(el);
    expect(fake.client.stop).toHaveBeenCalledOnce();
    expect(el._state).toBe("idle");
    expect(el.lastStats).toEqual(STATS);
    expect(el.shadowRoot?.querySelector(".message")).toBeNull();
  });

  it("talks while held, and stops when let go", async () => {
    const fake = fakeClient();
    const { el, button } = await mount(fake);
    const now = vi.spyOn(performance, "now");
    now.mockReturnValue(1000);
    press(button());
    await settle(el);
    expect(el._state).toBe("talking");
    now.mockReturnValue(1000 + HOLD_MS + 50);
    release(button());
    await settle(el);
    expect(fake.client.stop).toHaveBeenCalledOnce();
    expect(el._state).toBe("idle");
    now.mockRestore();
  });

  it("toggles from the keyboard", async () => {
    const fake = fakeClient();
    const { el, button } = await mount(fake);
    button().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await settle(el);
    expect(el._state).toBe("talking");
    button().dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    await settle(el);
    expect(el._state).toBe("idle");
  });

  it("says why a talk cannot start on this page, without asking for the microphone", async () => {
    unavailable.reason = "Talk needs a secure page: open Home Assistant over https.";
    const fake = fakeClient();
    const { el, button } = await mount(fake);
    press(button());
    release(button());
    await settle(el);
    expect(fake.client.start).not.toHaveBeenCalled();
    expect(el.shadowRoot?.querySelector('[role="alert"]')?.textContent).toContain("secure page");
  });

  it("says why the talk did not start", async () => {
    const blocked = new Error("Permission denied");
    blocked.name = "NotAllowedError";
    const fake = fakeClient({ fail: blocked });
    const { el, button } = await mount(fake);
    press(button());
    await settle(el);
    expect(el._state).toBe("idle");
    expect(el.shadowRoot?.querySelector('[role="alert"]')?.textContent).toContain("microphone is blocked");
  });

  it("says why the server ended the talk", async () => {
    const fake = fakeClient();
    const { el, button } = await mount(fake);
    press(button());
    release(button());
    await settle(el);
    fake.end({ ...STATS, ended: "idle" });
    await settle(el);
    expect(el._state).toBe("idle");
    expect(el.shadowRoot?.querySelector('[role="alert"]')?.textContent).toContain("no sound");
  });

  it("stops the talk when the live view closes", async () => {
    const fake = fakeClient();
    const { el, button } = await mount(fake);
    press(button());
    release(button());
    await settle(el);
    el.remove();
    await settle(el);
    expect(fake.client.stop).toHaveBeenCalledOnce();
  });
});

describe("talk messages", () => {
  it("says how a talk ended when it is worth saying", () => {
    expect(talkEndedMessage(null)).toBeUndefined();
    expect(talkEndedMessage(STATS)).toBeUndefined();
    expect(talkEndedMessage({ ...STATS, ended: "limit" })).toContain("5 minutes");
    expect(talkEndedMessage({ ...STATS, ended: "error", error: "ReolinkError: x" })).toContain("ReolinkError: x");
  });

  it("says why a talk did not start in plain words", () => {
    const missing = new Error("no device");
    missing.name = "NotFoundError";
    expect(startError(missing)).toBe("No microphone found.");
    expect(startError({ code: "talk_failed", message: "someone is already talking through this camera" })).toContain(
      "already talking",
    );
    expect(startError({ code: "unauthorized", message: "Only administrators may talk" })).toContain(
      "Only administrators",
    );
    expect(startError(new Error("The camera did not start the talk: the device refused to talk (400)"))).toBe(
      "Talk did not start: The camera did not start the talk: the device refused to talk (400)",
    );
  });
});
