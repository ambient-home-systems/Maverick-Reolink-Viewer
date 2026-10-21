"""Live view: our own go2rtc instance, its streams, and the browser sessions.

- ``binary.py`` finds the go2rtc binary (Home Assistant's own, or a pinned
  download verified by its checksum);
- ``go2rtc.py`` runs and supervises it, and talks to its API;
- ``streams.py`` registers camera streams in it at runtime and counts each
  running stream against the host's stream budget;
- ``capacity.py`` measures how many live streams a host serves at once.
"""
