// Optimistic writes: show the new value at once, keep it until HA's state
// changes (HA state is the source of truth), roll back on failure.
import type { HassEntities, HassEntity } from "./types";

export type WriteValue = string | number | boolean;

interface Pending {
  value: WriteValue;
  /** The state object when the write started; a new object means HA updated. */
  base: HassEntity | undefined;
  /** Set once the service call resolved. */
  confirmedAt: number | null;
}

/** How long a confirmed write waits for HA's state before showing HA's value again. */
export const SETTLE_TIMEOUT_MS = 10_000;

export class PendingWrites {
  private readonly _pending = new Map<string, Pending>();

  constructor(private readonly _now: () => number = () => Date.now()) {}

  /** Start a write; returns a token to pass to confirm/fail. */
  begin(entityId: string, value: WriteValue, base: HassEntity | undefined): Pending {
    const pending: Pending = { value, base, confirmedAt: null };
    this._pending.set(entityId, pending);
    return pending;
  }

  /** The service call succeeded; wait for the state update. */
  confirm(entityId: string, token: Pending): void {
    if (this._pending.get(entityId) === token) token.confirmedAt = this._now();
  }

  /** The service call failed: drop the optimistic value (roll back). */
  fail(entityId: string, token: Pending): boolean {
    if (this._pending.get(entityId) !== token) return false;
    this._pending.delete(entityId);
    return true;
  }

  isPending(entityId: string): boolean {
    return this._pending.get(entityId)?.confirmedAt === null;
  }

  /** The value to show: the optimistic one while HA has not caught up. */
  valueFor(entityId: string): WriteValue | undefined {
    return this._pending.get(entityId)?.value;
  }

  /**
   * Drop optimistic values HA has caught up with (a new state object) and
   * confirmed ones that waited too long. Returns true if anything changed.
   */
  settle(states: HassEntities): boolean {
    let changed = false;
    const now = this._now();
    for (const [entityId, pending] of this._pending) {
      const stale =
        pending.confirmedAt !== null && now - pending.confirmedAt > SETTLE_TIMEOUT_MS;
      if (states[entityId] !== pending.base || stale) {
        this._pending.delete(entityId);
        changed = true;
      }
    }
    return changed;
  }

  get size(): number {
    return this._pending.size;
  }
}
