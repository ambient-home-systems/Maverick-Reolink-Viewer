import { afterEach, describe, expect, it } from "vitest";

import "./components/findings";
import { count, inShortLines, middle, parseInShort, secondsText, speed, worst, type InShort } from "./plain";

afterEach(() => {
  document.body.innerHTML = "";
});

const SUMMARY: InShort = {
  headline: "1 problem found.",
  findings: [
    { grade: "good", text: "Garage: live video starts in 0.8 s." },
    { grade: "problem", text: "Doorbell: live video did not start.", advice: "Check that the camera is online." },
    { grade: "pending", text: "The live board has been on screen for 1.0 of 8 hours." },
  ],
};

describe("plain words", () => {
  it("says waits and counts as people do", () => {
    expect(secondsText(40)).toBe("under 0.1 s");
    expect(secondsText(1840)).toBe("1.8 s");
    expect(secondsText(12_400)).toBe("12 s");
    expect(speed(900, 1000, 3000)).toBe("good");
    expect(speed(2000, 1000, 3000)).toBe("fine");
    expect(speed(3000, 1000, 3000)).toBe("slow");
    expect(speed(undefined, 1000, 3000)).toBe("problem");
    expect(worst(["good", "slow", "fine"])).toBe("slow");
    expect(worst([])).toBe("note");
    expect(middle([3, 1, 2, 4])).toBe(2);
    expect(middle([])).toBeUndefined();
    expect(count(1, "camera")).toBe("1 camera");
    expect(count(3, "camera")).toBe("3 cameras");
  });

  it("writes the summary into a report and reads it back", () => {
    const lines = inShortLines(SUMMARY);
    expect(lines).toEqual([
      "In short: 1 problem found.",
      "- Good: Garage: live video starts in 0.8 s.",
      "- Problem: Doorbell: live video did not start. What to do: Check that the camera is online.",
      "- Not yet: The live board has been on screen for 1.0 of 8 hours.",
    ]);
    expect(parseInShort(["Report v1", "", ...lines, "", "Summary:", "- cold WebRTC: 0.8 s"].join("\n"))).toEqual(SUMMARY);
    expect(parseInShort("a report from before")).toBeUndefined();
  });

  it("shows a summary as ruled rows, each with its grade in a word", async () => {
    const el = document.createElement("rv-findings");
    el.summary = SUMMARY;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector(".headline")?.textContent).toBe("1 problem found.");
    const rows = [...(el.shadowRoot?.querySelectorAll("li") ?? [])];
    expect(rows.map((r) => r.className)).toEqual(["good", "problem", "pending"]);
    expect(rows.map((r) => r.querySelector(".grade")?.textContent)).toEqual(["Good", "Problem", "Not yet"]);
    expect(rows[1]?.querySelector(".advice")?.textContent).toBe("Check that the camera is online.");
    el.summary = undefined;
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector(".headline")).toBeNull();
  });
});
