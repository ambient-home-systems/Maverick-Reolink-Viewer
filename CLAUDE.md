# CLAUDE.md

Project: a Home Assistant companion custom integration (`custom_components/reolink_viewer`)
plus a Lit/TypeScript sidebar panel (`frontend/`) for Reolink cameras configured in HA's
built-in Reolink integration.

Read before starting work:

- `docs/PLAN.md` — research findings and architecture rationale.
- `docs/IMPLEMENTATION_PLAN.md` — phases, tasks, exit criteria. Work phase by phase and
  update the plan's status as phases complete.

Non-negotiable architecture rules (details in `docs/IMPLEMENTATION_PLAN.md`):

1. Only `custom_components/reolink_viewer/bridge.py` may touch Reolink integration
   internals (`config_entry.runtime_data`, `homeassistant.components.reolink`).
2. All camera I/O goes through `scheduler.py` (per-host limits and priorities).
3. Camera URLs and credentials never reach the browser; use HA auth or signed URLs.
4. Settings writes go through standard HA actions; HA state is the source of truth.
5. Copy no neolink code (AGPL-3.0).
