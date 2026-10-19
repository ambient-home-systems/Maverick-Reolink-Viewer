import { describe, expect, it } from "vitest";

import { ThumbLoader, type LoadableImage } from "./thumb-loader";

/** Images that load (or fail) only when the test says so. */
function images() {
  const made: (LoadableImage & { finish: (ok: boolean) => void })[] = [];
  const create = () => {
    const image = {
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      src: "",
      finish(ok: boolean) {
        (ok ? image.onload : image.onerror)?.();
      },
    };
    made.push(image);
    return image;
  };
  return { made, create };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("ThumbLoader", () => {
  it("loads at most two at a time, in order", async () => {
    const { made, create } = images();
    const loader = new ThumbLoader(2, create);
    const results: boolean[] = [];
    for (const n of [1, 2, 3, 4]) void loader.load(`/thumb/${n}`).then((ok) => results.push(ok));
    expect(made.map((i) => i.src)).toEqual(["/thumb/1", "/thumb/2"]);
    expect(loader.pending).toBe(4);
    made[0]?.finish(true);
    made[1]?.finish(false);
    await flush();
    expect(results).toEqual([true, false]);
    expect(made.map((i) => i.src)).toEqual(["/thumb/1", "/thumb/2", "/thumb/3", "/thumb/4"]);
  });

  it("starts nothing while paused and drops everything when cleared", async () => {
    const { made, create } = images();
    const loader = new ThumbLoader(2, create);
    const results: boolean[] = [];
    void loader.load("/thumb/1").then((ok) => results.push(ok));
    loader.pause();
    void loader.load("/thumb/2").then((ok) => results.push(ok));
    expect(made).toHaveLength(1);
    // A load already running finishes; nothing new starts.
    made[0]?.finish(true);
    await flush();
    expect(made).toHaveLength(1);
    loader.resume();
    expect(made).toHaveLength(2);
    void loader.load("/thumb/3").then((ok) => results.push(ok));
    loader.clear();
    await flush();
    expect(results).toEqual([true, false, false]);
    expect(made[1]?.src).toBe("");
    expect(loader.pending).toBe(0);
    // A late answer from a cleared image changes nothing.
    made[1]?.finish(true);
    await flush();
    expect(results).toHaveLength(3);
  });
});
