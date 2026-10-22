"""The live view service: go2rtc, its streams, the MSE feeds, the WebRTC sessions.

go2rtc starts on first use (the panel's first live request), not with the
entry, so an installation that never watches live never runs it.
"""

import asyncio
from collections.abc import Callable
from dataclasses import dataclass, field
import logging
from pathlib import Path
import secrets
from typing import Any

from aiohttp import ClientSession, ClientWebSocketResponse

from custom_components.reolink_viewer.scheduler import Scheduler
from homeassistant.core import HomeAssistant

from .go2rtc import Go2rtcServer
from .images import LiveImages
from .relay import MseRelay
from .streams import StreamRegistry

_LOGGER = logging.getLogger(__name__)

# Candidates a browser sends before go2rtc's websocket is open are kept.
MAX_EARLY_CANDIDATES = 50


@dataclass(slots=True)
class WebRtcSession:
    """A browser's WebRTC session with go2rtc, relayed through HA's websocket."""

    session_id: str
    # Which HA websocket connection owns it (only it may add candidates).
    owner: int
    ws: ClientWebSocketResponse | None = None
    early: list[str] = field(default_factory=list)


class LiveService:
    """Everything live view needs while the entry is loaded."""

    def __init__(
        self,
        hass: HomeAssistant,
        scheduler: Scheduler,
        directory: Path,
        session: Callable[[], ClientSession],
        *,
        ffmpeg: str | None,
        images_dir: Path | None = None,
        server: Go2rtcServer | None = None,
    ) -> None:
        """Initialize (nothing runs until first used)."""
        self.server = server or Go2rtcServer(hass, directory, session, ffmpeg=ffmpeg)
        self.registry = StreamRegistry(hass, scheduler, self.server)
        # Each camera's last picture (call images.async_setup before use).
        self.images = LiveImages(hass, scheduler, images_dir or directory / "images")
        self.registry.on_start = self.images.stream_started
        # MSE goes through the key-frame cache; it also keeps streams warm.
        self.relay = MseRelay(hass, self.registry, self.async_server)
        self.sessions: dict[str, WebRtcSession] = {}
        # One capacity test at a time (it holds a host for itself).
        self.capacity_lock = asyncio.Lock()

    async def async_server(self) -> Go2rtcServer:
        """Start go2rtc if needed and wait until it answers."""
        await self.server.async_start()
        await self.server.async_ready()
        return self.server

    def new_session(self, owner: int) -> WebRtcSession:
        """Open a WebRTC session for a websocket connection."""
        session = WebRtcSession(secrets.token_hex(12), owner)
        self.sessions[session.session_id] = session
        return session

    def status(self, *, admin: bool) -> dict[str, Any]:
        """Return go2rtc's state and the running streams, for the panel."""
        return {
            "go2rtc": self.server.status(log=admin),
            "running": self.registry.running(),
            "preloaded": self.relay.warm_streams(),
            "sessions": len(self.sessions),
        }

    async def async_shutdown(self) -> None:
        """Close sessions and stop go2rtc."""
        for session in list(self.sessions.values()):
            if session.ws is not None:
                await session.ws.close()
        self.sessions.clear()
        await self.images.async_shutdown()
        await self.relay.async_shutdown()
        await self.registry.async_shutdown()
        await self.server.async_stop()
