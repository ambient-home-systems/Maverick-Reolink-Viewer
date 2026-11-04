"""The model's numbers (Phase 8 step 2).

Ported from Reolink Stamina's ``const.py`` (v1.9.2, MIT, Copyright (c) 2026
marl1w; licence in
LICENSE-reolink-stamina.txt), with its measurements. Every number below is
applied when the journal is read, never when it is written, so each can be
changed later and re-applied to the history already kept.
"""

from __future__ import annotations

from typing import Final

# ----------------------------------------------------------- deriving events

# A detection that clears and fires again inside this is one event, not two.
# Stamina measured it across 5,187 detections: the quiet gap between one ending
# and the next starting was 3.2 s at the first quartile and 10.5 s at the
# median, so bounce is under three seconds. (Our journal already merges a motion
# sensor's dips within 30 s into one burst, journal.QUIET_S.)
EVENT_MERGE_SECONDS: Final = 3.0

# A sensor stuck on would otherwise hold one event open for ever. The longest
# any sensor was genuinely on across Stamina's ten days was 81 s, so this guards
# against something broken rather than bounding anything real.
EVENT_MAX_SECONDS: Final = 5 * 60.0

# ---------------------------------------------------------------- rate tables

# Five-minute bins over the day: a school run and an evening return do not land
# in the same bucket, and a year of events still fills it.
RATE_BINS: Final = 288
RATE_BIN_MINUTES: Final = 1440 // RATE_BINS

# The kernel's width, in minutes, so 23:59 and 23:01 are not different questions.
RATE_BANDWIDTH_MINUTES: Final = 45.0

# How fast the past stops counting: a household that changes is tracked without
# anyone retraining anything, and last winter still counts a little.
RATE_HALF_LIFE_DAYS: Final = 90.0

# Below this much evidence, a camera-and-kind pair is blended with the kind
# across its pool and then with everything in the pool.
RATE_BACKOFF_WEIGHT: Final = 40.0

# Laplace smoothing for the categorical terms: a value seen for the first time is
# surprising rather than infinitely so.
RATE_SMOOTHING: Final = 0.5

# The same for the smooth distributions, much smaller: a bin with nothing near it
# (a person at 3 am) scores heavily, but finitely.
RATE_FLOOR: Final = 0.05

# ------------------------------------------------------------------- signals

# Numeric signals are cut into this many bands, learned from their own history,
# once there are this many readings per band.
SIGNAL_BANDS: Final = 5
SIGNAL_BAND_MIN: Final = 20

# ------------------------------------------------------------------- scoring

# Where "what fired first" stops looking, as the quiet seconds between one
# detection finishing and the next starting. Beyond two minutes it is a
# coincidence, counted as "nothing fired first".
SCORE_LAG_BUCKETS: Final = (10.0, 30.0, 120.0)

# The per-camera line: its own scores' 95th percentile. Stamina measured planted
# anomalies (a vehicle at 3 am, a doorbell at 4) around the top 4%.
SCORE_QUANTILE: Final = 0.95

# The absolute floor, in nats, that a mark must also clear: "balanced", four
# times rarer than chance.
SCORE_FLOOR: Final = 1.4

# Nothing is marked until a camera has a week behind it (each day of the week
# seen once) and this many events.
SCORE_MIN_DAYS: Final = 7.0
SCORE_MIN_EVENTS: Final = 200

# The three sensitivities choose the floor. Measured by Stamina on nine cameras
# over a fortnight (5,659 events): 0.7 nats about 9 marks a day, 1.4 about 4,
# 2.1 about 1.6.
SENSITIVITY_FEW: Final = "few"
SENSITIVITY_BALANCED: Final = "balanced"
SENSITIVITY_MANY: Final = "many"
#
# Ours (v0.47.5): with "known after 10" (below) a score's terms can only rise for
# what is new, so Stamina's floors sat too high: Balanced marked 1.4 a day on the
# owner's property, all of them rare by count. The floors are now the least a
# mark must be ("rarer than chance" by that much), and the property's daily
# allowance (DAILY_MARKS) sets the line on a busy one.
SENSITIVITY_FLOORS: Final = {
    SENSITIVITY_FEW: 1.4,
    SENSITIVITY_BALANCED: 0.0,
    SENSITIVITY_MANY: 0.0,
}
DEFAULT_SENSITIVITY: Final = SENSITIVITY_BALANCED
# Ours: about how many marks a day each allows across the property, at most. The
# floor alone marks in proportion to how much a property sees: a busy one would
# get ten times as many. (v0.47.0 to v0.47.4: 2, 4 and 9, Stamina's measured rates.)
DAILY_MARKS: Final = {
    SENSITIVITY_FEW: 0.7,
    SENSITIVITY_BALANCED: 3.0,
    SENSITIVITY_MANY: 6.0,
}

# What a camera with too little history of its own may borrow from, and which
# cameras can count as having fired before one another: every camera together,
# each Reolink host (an NVR, a Hub or a camera added on its own), or none.
SCOPE_TOGETHER: Final = "together"
SCOPE_HOST: Final = "host"
SCOPE_CAMERA: Final = "camera"
SCOPES: Final = (SCOPE_TOGETHER, SCOPE_HOST, SCOPE_CAMERA)
DEFAULT_SCOPE: Final = SCOPE_TOGETHER

# ------------------------------------------------- our adaptations (not Stamina's)

# The thresholds are calibrated on the last four weeks, at most this many events
# per camera (evenly spaced; motion is not among them): our journal keeps a year
# of a busy property, Stamina's a fortnight of a quieter one.
CALIBRATE_DAYS: Final = 28
CALIBRATE_EVENTS: Final = 20_000

# Ours, from the owner's first marks (2026-11-04, v0.47.0: 25 in 7 days):
# motion is learned from but never marked (10 of the 25 were motion); the time
# of day and the time from sunset each count half where both are known (they
# agreed 95% of the time, and together made 71% of a mark's score); and the
# same kind seen on several cameras, each starting within this of the last one
# ending, is one incident: one mark (one animal at 02:25 made three).
UNMARKED_KINDS: Final = frozenset({"motion"})

TIME_WEIGHT: Final = 0.5
INCIDENT_SECONDS: Final = 60.0

# Ours: a house-wide signal reading one of these is not reading at all (Home
# Assistant starting, an entity offline, or a signal chosen after the history
# began): neither counted nor scored. Counted, two months before a signal was
# chosen made every value it has read since look rare.
UNREAD_STATES: Final = frozenset({"unknown", "unavailable", ""})

# House-wide signals: what the options' picker offers (Stamina's
# RELEVANCE_SIGNAL_DOMAINS, RELEVANCE_SIGNAL_ENUM_DOMAINS and
# RELEVANCE_SIGNAL_WORLD_CLASSES). Each has a state a person could read out
# loud, which is what makes it countable; a sensor only where it holds a fixed
# set of values (enum), or measures the world rather than the wiring.
SIGNAL_DOMAINS: Final = (
    "person",
    "device_tracker",
    "binary_sensor",
    "alarm_control_panel",
    "input_boolean",
    "input_select",
    "sun",
    "calendar",
    "light",
    "lock",
    "siren",
)
SIGNAL_ENUM_DOMAINS: Final = ("sensor",)
SIGNAL_WORLD_CLASSES: Final = (
    "aqi",
    "atmospheric_pressure",
    "distance",
    "humidity",
    "illuminance",
    "irradiance",
    "moisture",
    "pm25",
    "precipitation",
    "precipitation_intensity",
    "pressure",
    "sound_pressure",
    "speed",
    "temperature",
    "uv_index",
    "wind_speed",
)
# Stamina's signal_picker: device classes that describe a device's own health
# rather than anything happening in the house (not offered).
SIGNAL_SELF_REPORTING: Final = frozenset(
    {
        "battery",
        "battery_charging",
        "connectivity",
        "problem",
        "running",
        "tamper",
        "update",
    }
)

# Ours, from the owner's second week (2026-11-04, v0.47.1: 36 marks in 7 days):
# a kind seen this many times on a camera is known there, and no longer raises a
# score for being that kind ("Doorbell at all on Doorbell — 12th time in 7
# days"). Lasting shorter than usual no longer raises one either, and only what
# can be marked is ever "what fired before" (not motion).
KNOWN_AFTER: Final = 10
# (v0.47.5) "More, including borderline ones" knows a value only after twice as
# many: on a busy property known-after-10 leaves little that can be marked.
KNOWN_AFTERS: Final = {
    SENSITIVITY_FEW: KNOWN_AFTER,
    SENSITIVITY_BALANCED: KNOWN_AFTER,
    SENSITIVITY_MANY: 2 * KNOWN_AFTER,
}
# And from its third (2026-11-04, v0.47.3: 37 marks, 39 without the cap): this
# applies to every signal, not kinds alone (a time, a length, a day, what fired
# before); and only "nothing fired first" can raise a score.
