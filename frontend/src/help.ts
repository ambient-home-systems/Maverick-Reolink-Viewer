// The panel's help: the user docs of the release it belongs to, on GitHub
// (docs/user-guide.md, docs/troubleshooting.md, docs/cameras.md), so what
// they say matches what this version shows.
import { VERSION } from "./version";

const REPO = "https://github.com/ambient-home-systems/Maverick-Reolink-Viewer";

export type HelpDoc = "user-guide" | "troubleshooting" | "cameras";

/** What the panel links to: a doc, and a section of it. help.test.ts checks each section is there. */
export const HELP = {
  guide: ["user-guide"],
  troubleshooting: ["troubleshooting"],
  cameras: ["cameras"],
  changed: ["troubleshooting", "reolink-viewer-needs-an-update"],
  stopped: ["troubleshooting", "the-reolink-integration-is-not-running"],
  none: ["troubleshooting", "no-reolink-devices-yet"],
  loading: ["troubleshooting", "a-page-could-not-load"],
  recordings: ["troubleshooting", "recordings-and-events"],
} as const satisfies Record<string, readonly [HelpDoc] | readonly [HelpDoc, string]>;

export type HelpTopic = keyof typeof HELP;

/** The page (and section) of this release's docs about `topic`. */
export function helpUrl(topic: HelpTopic): string {
  const [doc, section] = HELP[topic] as readonly [HelpDoc, string?];
  return `${REPO}/blob/v${VERSION}/docs/${doc}.md${section ? `#${section}` : ""}`;
}
