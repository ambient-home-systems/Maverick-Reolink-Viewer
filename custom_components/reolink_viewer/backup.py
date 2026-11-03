"""Before Home Assistant's backup: the detection journal's log into its file.

The journal (journal.py) is a SQLite file in write-ahead mode. Its recent
changes may sit in the ``-wal`` file beside it; a backup taken then would hold
the main file without them. So the journal writes what is pending and
checkpoints the log into the file first.
"""

from homeassistant.core import HomeAssistant

from .const import DOMAIN


async def async_pre_backup(hass: HomeAssistant) -> None:
    """Write the journal's pending changes and its log into its file."""
    for entry in hass.config_entries.async_loaded_entries(DOMAIN):
        journal = entry.runtime_data.journal
        if journal is not None:
            await journal.async_checkpoint()


async def async_post_backup(hass: HomeAssistant) -> None:
    """Nothing to undo after the backup."""
