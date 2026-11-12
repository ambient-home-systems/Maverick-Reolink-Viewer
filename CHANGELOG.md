# Changelog

What each release of Reolink Viewer brings. A release's notes on GitHub are its
entry here.

## 0.63.6

From the owner's playback check of 0.63.5 in Safari on the Mac, over the LAN, on
Front Yard Right in the daytime. Most rows passed, including two Safari failures
from earlier versions: going back from HD to SD, and moving on to the next
recording. Dragging beside a second viewer was tested for the first time and
passed. But letting go after a drag showed no video for 20 s, and the report
couldn't say why.

- **A release that shows nothing says why:** if letting go of a drag shows no video
  within 20 s, the check now says what the video was doing: paused or waiting,
  where it was, what it had loaded, whether more was on its way, and whether the
  browser refused to play it. It then presses play itself, and says whether that
  started it, was refused, or still had nothing to show. The address, server and
  Home Assistant lines for that start are printed too; before, they were skipped
  when it failed.
- **A refused play is kept:** when the browser refuses to play a video or cuts a
  play short, the player now keeps the reason. Before, it dropped it silently.
  Technical details shows it, along with Safari asking the player to pause
  fetching.
- **Mac Safari setups:** the check's setups now include "Mac Safari" for the LAN,
  Tailscale and Nabu Casa. Safari picks the LAN one by default.

## 0.63.5

From the owner's playback check of 0.63.4 in Chrome through Nabu Casa, on Front Yard
Right. The check named what had held Home Assistant up in earlier runs: Spook,
another integration, reading through templates for over a second at a time. During
one hold a cached jump that took Home Assistant 2 ms reached the browser after 2.5 s,
and the check marked it as failed.

- **The check names the integration in plain words:** "held by the Spook
  integration", "Reolink Viewer itself", or "Home Assistant's Recorder integration",
  then the file and line. "In short" says whether it was Reolink Viewer or not. Home
  Assistant now finds the integration however deep in a library the work is, and
  times each hold to its end instead of to when it was first noticed.
- **It adds up the holds:** the line after a start gives how many times Home Assistant
  was held up in the last 10 s and for how long in all, as well as the longest.
- **A start another integration slowed isn't failed:** if it took longer than it
  should while another integration held Home Assistant up, the check gives its time
  as "slowed by the Spook integration" and doesn't judge it. If Reolink Viewer itself
  held Home Assistant up, it's reported as a problem.

## 0.63.4

From the owner's playback check of 0.63.3 in Chrome through Nabu Casa, on Front Yard
Right. Everything passed, and Home Assistant was held up for 0.2 s at most.

- **Jumping within a recording is quicker over a slow link:** after a start from the
  recorder's direct video, a jump into the part already downloaded took two trips to
  Home Assistant: one for the video, then one for a short header the browser needed
  first. Through Nabu Casa that took about 0.4 s on every run. The header now comes
  with the video, in one trip, which should bring the jump down to about 0.25 s. A
  jump the other way, from the downloaded part to the recorder's direct video, saves
  the same trip.
- **Shorter holds are named:** Home Assistant now notes what held it up from 0.15 s,
  where it waited for 0.3 s before, and it looks twice as often. The run's longest
  hold was 0.2 s, too short to be named.

## 0.63.3

From the owner's playback check of 0.63.2 in Chrome through Nabu Casa. Everything
passed, and a deep start into an hour not yet downloaded took 0.64 s. But Home
Assistant was held up by other work for up to 1.3 s, and the report couldn't say by
what.

- **The check says what held Home Assistant up:** while the check or Technical details
  is open, Home Assistant notes where it was busy each time it is held up for more
  than about a third of a second, down to the file, line and function. The check
  shows it after each start ("held by …"), so the next run can tell whether it's
  Reolink Viewer's own work, and which part, or another integration.
- **The summary names where it happened:** "In short" now names the rows whose starts
  found Home Assistant held up. Some rows don't print a line for their start, and the
  1.3 s hold in that run wasn't on any line.

## 0.63.2

From the owner's playback checks of 0.63.1 through Nabu Casa, on Front Yard Right and
Front Yard Left.

- **The check carries on when a row fails:** on Front Yard Left the page lost its
  connection to Home Assistant partway through, and the whole check ended with
  "Check failed: [object Object]". Now that row is reported as failed, with the reason
  in plain words ("Connection lost"), and the rest of the check runs.
- **A slow start says when Home Assistant was busy:** if Home Assistant was held up
  for half a second or more while a video started, that start's own line now says so.
  Before, only the summary said it, without saying which start.
- **Cameras with a full picture only every few seconds start sooner:** for a video the
  recorder sends directly, the first stretch now also includes the part after the
  moment you asked for. On Front Yard Left, which has a full picture every 4 s, the
  video had waited for a second stretch.

## 0.63.1

From the owner's playback check of 0.63.0 in Chrome through Nabu Casa. Partway through,
the Playback tab stopped showing video and pictures. The cause was a fault in Home
Assistant's handling of the recorder that was there before 0.63.0; this run hit the
one situation that triggers it.

- **Switching quickly between recordings no longer mixes them up:** when you jump to
  another recording of a camera while the recorder is still sending the last one, the
  end of the last one can arrive first. Home Assistant took it for the start of the
  new one and put the new recording's video at the wrong times, in that run past the
  end of the hour. Home Assistant now recognises the old recording's leftovers and
  drops them.
- **The player no longer gets stuck asking for the same moment:** if the video that
  comes back doesn't cover the moment it asked for, the player stops after three tries
  and starts again, instead of asking forever. In that run it asked 2,353 times.
- **Pictures while dragging always get an answer:** if the camera or Home Assistant is
  too busy, the picture now comes back within 4 s saying so, instead of no answer.
- **Videos the recorder sends directly start sooner:** the first stretch now holds a
  little more than the moment itself, so the video can show it without asking again.
  This gives these starts the saving 0.63.0 brought to starts from saved video.

## 0.63.0

From the owner's playback check of 0.62.2 in Chrome through Nabu Casa. Every check
passed, and the slow starts of the run before did not come back. The new figures show
that Home Assistant did its own part of each start in milliseconds. The rest was the
trip through Nabu Casa: 0.2 to 0.5 s for each request.

- **Videos start one round trip sooner:** to start a video, the panel asks Home
  Assistant for its header and then for its first stretch. It used to ask for the
  first stretch only once the header had arrived. Now it asks for both at once,
  which saves about 0.2 to 0.4 s on each start that isn't already loaded through
  Nabu Casa or the iPhone app away from home. On the home network the saving is
  small.

## 0.62.2

From the owner's playback check of 0.62.1 in Chrome through Nabu Casa. Several video
starts took 1.5 to 2.6 s, although the recorder answered within a fraction of a
second. Each time, Home Assistant was downloading or had just finished downloading an
hour of video. This release makes the check say where the time went, so the next run
can show the cause.

- **The server's own time for each video request:** the check now gives Home
  Assistant's own time beside each answer (for example "answer 1938 (server 612)"),
  and beside the request for the video's address. A big difference means the time
  went on the way between Home Assistant and the browser, not in Home Assistant's
  work on the request. It shows on pages served over https, such as through Nabu Casa.
- **How busy Home Assistant was:** after each start, the check says how long Home
  Assistant was held up by other work in the 10 s before, and how many downloads
  from the recorder and file rewrites it was running. "In short" says so when it
  was held up for half a second or more. Home Assistant only measures this for 5
  minutes after the check or Technical details last asked.

## 0.62.1

From the owner's playback checks of 0.62.0 in Chrome through Nabu Casa, on Front Yard
Right and Garage.

- **A video starts sooner near the end of a recording:** the next recording now
  starts loading once the video you asked for shows its first picture, not at the
  same moment. In that run, an event 2 minutes before its recording's end took 3.5 s
  to start, sharing the connection with the next recording's download.
- **The check says where a missing picture was:** on Garage, one moment of ten got
  no picture from the recorder, both times it was asked. The "pictures from the
  server" row now says where that moment is in its recording (for example, "1.2 s
  before the end of a 19 s recording"), so the next run can show the cause.
- **The user guide no longer says** unusual marks and their automation event "come
  in later versions": both are there.

## 0.62.0

Dragging along the timeline, from the owner's playback check in Chrome through Nabu
Casa, where a slow drag showed a new picture only every 0.65 s. Phase 5 is done: its
two-viewer check passed in Safari and in Chrome.

- **Dragging pauses the video:** the picture you drag to covers it anyway. Before,
  the video played on underneath, and when the recorder was sending it, the recorder
  had to take turns between that video and the pictures, so each picture waited
  longer. Let go and it plays from the new place; if the browser takes the drag (a
  page scroll, say), the video plays on where it was.
- **Letting go plays from the picture you see:** the video now starts on the frame
  shown, not up to a second or so after it. A picture that lags behind the pointer is
  passed over, and the video starts at the pointer.
- **Pictures come sooner when someone else is watching the same camera:** Home
  Assistant now sends each picture as soon as it has it, before the short pause it
  keeps so the other viewer's recording stays clean.
- **The playback check (v0.8.0) measures the slow drag twice:** once alone, against
  the 0.3 s target, and once while a second viewer plays another recording of the
  camera, where it checks that viewer never stalls. It also checks that the drag
  paused the video, and says where the video began after letting go.

## 0.61.3

Ready for Home Assistant 2026.11.2, which brings reolink-aio 0.23.0. That
reolink-aio release answers our report of the recorder's download cut
([reolink_aio#240](https://github.com/starkillerOG/reolink_aio/issues/240)).

- **The Doorbell's timeline pictures keep working on 2026.11.2:** reolink-aio
  0.23.0 takes out the step Reolink Viewer used to turn the Doorbell's past
  pictures into images. On 2026.11.2 the Doorbell's timeline would have shown no
  pictures, and the events check's picture samples would have failed. Reolink
  Viewer now does that step itself, with the same request to the Doorbell and the
  same ffmpeg conversion, so nothing changes on today's Home Assistant.
- **Tested on the next reolink-aio:** every change is now also tested with the
  reolink-aio that Home Assistant's next release will ship, so a change like this
  one shows up before that release does.

## 0.61.2

From the owner's run of the playback check in Safari on a Mac.

- **The check says why Safari failed, so it can be fixed:** in that run Safari did
  not move on to the next recording at the end of one, and going back from HD to SD
  failed ("media error 4"). Where either fails now, the report gives the video's
  state (where it stopped, what it had loaded, its error) and what the panel had
  fetched for it. Run it once more in Safari to find the cause.
- **Speeds not measured are not called a stutter:** with the window behind another,
  the browser plays nothing, and the check said "Playback stutters at 2×, 4×, 8×".
  It now says those speeds were not measured, and to keep the page in front.
- **A failed return from HD to SD is in "In short"** as a problem, where it was only
  in the lines below.

## 0.61.1

From the owner's first run of the new playback check (0.61.0's page on a Home
Assistant still running 0.60.0).

- **The panel says when an update is half done:** when the page and the Reolink Viewer
  Home Assistant runs are not the same version, a note over every page says which to
  do: restart Home Assistant (it has not restarted since HACS updated it), or reload
  the page (the browser kept the old one). The playback check says both versions at
  its top, and counts a difference as a problem.
- **The check passes nothing it could not read:** its V row passed "back at rest" on
  the Reolink protocol login alone when the NVR's list of users could not be read (the
  older Home Assistant did not have the command). It now says the list was not read,
  and why, with no ✓.
- **The check says where a release's start spent its time:** letting go took 4.7 s in
  that run, where a start from cold takes 1.0 s; the P row's release line now gives
  the start's steps and the server's side (the recorder's cut, its slot, its reply), to
  find out why.

## 0.61.0

The rest of the checks you ran by hand now run themselves (after 0.60.0's drag
rows): the owner's ask, "It's confusing for me to follow with the steps".

- **Two viewers on one camera (the playback check's new V row):** the check plays a
  recording on the camera, starts a second viewer off screen in another, then far
  into the first one's, and watches the first for stalls; then it stops both, the
  second as a closed tab, and waits for the NVR's list of users to be back at rest
  (it reads the list itself). Each with ✓ or ✗; about a minute and a half.
- **The learning check (Devices → Learning what is normal → Run the check):** from
  this update on, Home Assistant keeps each unusual event it fires and which
  automations ran on it. The check compares them with the panel's marks: each mark
  fired once, within 2 s of the detection; nothing fired that is not marked; the
  house-wide signals chosen are there and learned with; an automation listens and
  ran on every event. Each with ✓ or ✗, and a report to copy.
- **A clean install, checked on every change:** the release zip is installed as HACS
  installs it into an empty Home Assistant (the oldest supported and the newest),
  added and set up, and every part of the panel loads.

## 0.60.0

Dragging along the timeline works, and the playback check now tests it for you.

- **Dragging shows the pictures** (from the owner's first drag on 0.59.0: no picture
  came): a drag's time comes from the pointer's position, in fractions of a
  millisecond, and Home Assistant took such a time for no request and never
  answered; the panel then waited on that first picture for the rest of the day.
  The panel now asks in whole milliseconds, Home Assistant takes fractions too, and
  a picture not answered within 5 s no longer holds up the next. (The playback
  check's F row asked in whole milliseconds, so it passed.)
- **The playback check drags the timeline itself (its new P row):** over what the
  video has loaded, then slowly over a recording not cached, the same stretch again,
  and fast, with another recording of the camera playing meanwhile; then it lets
  go. It reports, each with ✓ or ✗: how often a new picture came and how near the
  pointer, whether a fast drag catches up when the pointer stops, whether the
  picture stays until the video starts, whether the recording playing stalled, that
  hovering fetched no thumbnail, and the NVR's logins. Run it from Details →
  playback check, as before; on the iPhone app and the wall tablet too.
- **Technical details says how pictures are painted** while dragging: WebCodecs,
  or MSE and why (e.g. a page over plain HTTP).

## 0.59.0

Dragging along the timeline shows the recording at the pointer (Phase 10's step 2).

- **The picture under the pointer while you drag:** where the video on screen has
  the moment, it shows it as before; elsewhere the panel asks Home Assistant for the
  key frame there and shows it over the video, with its own time in the corner. One
  picture is asked for at a time, always the newest place the pointer reached, so a
  steady drag keeps showing pictures. The arrow keys show them too as they step.
- **Release plays from there:** the picture stays until the video's first frame,
  so the screen goes from the picture straight to the video.
- **A picture that lags is dimmed:** one further from the pointer than the camera's
  key-frame interval (a second on Front Yard Right, 4 s on the others) is shown
  dimmed until the next one comes.
- **Hovering is as before:** without a press, the thumbnail above the timeline.
  While dragging, that box shows only the time, and no thumbnail is fetched.
- **Where the browser cannot show them:** the picture is decoded with WebCodecs,
  or played through MSE where the browser has no WebCodecs. Where it has neither,
  or the session will not open, a drag shows what the video has buffered, as in
  0.58. **Technical details** says how many pictures were shown, or why there
  are none.

## 0.58.1

From the owner's check of 0.58.0 (the playback check's F row on Front Yard Right).

- **A scrub's picture is the one at the moment:** the recorder starts a cut a few
  seconds early, and 0.58.0 kept its first key frame, up to 3.9 s before the moment
  on a camera with a key frame every second. The key frame at or before the moment
  is kept now: within one key-frame interval of it.
- **Pictures found before answer again:** the second pass over the same moments came
  from the recorder again for 6 of 10; a picture found earlier now answers any moment
  within the camera's key-frame interval after it.

## 0.58.0

Pictures for scrubbing, from the server (Phase 10's step 1). Nothing changes on
screen yet: the next step shows them as you drag along the timeline.

- **The picture at any moment of a recording:** Home Assistant hands the panel the
  key frame at the moment asked for: from the recording if it is cached, else from a
  2-second cut the recorder sends (about 0.2 s on the owner's NVR); it keeps the
  pictures it found for the next pass over them. A camera that does not take the
  Reolink protocol gives its thumbnail instead.
- **A recording playing on the same camera goes on:** a picture's cut takes its
  turn as another viewer's would, and what it sends after its end does not reach the
  recording that plays.
- **The playback check's F row:** it asks for the pictures at 10 moments of the day,
  twice, and says how long each took, where it came from, and that each decodes.

## 0.57.0

Measuring before scrubbing shows the picture (Phase 10's first step). Nothing
changes in how the panel plays; two diagnostics gain what the next step is
decided on.

- **The hardware probe's scrub cuts:** under **Test replay over the Reolink app's
  own protocol**, a new **Scrub cuts** box times short recording cuts at 20 moments
  through each camera's sub recording: one at a time, back to back as a drag would
  ask, and taking turns with a recording that plays. Each stream's report also gives
  its key frames' size and how far apart they are.
- **The playback check's K row:** it reads the key frames of the recording it plays
  and decodes each one on its own (WebCodecs), as showing pictures while dragging
  would, and says how long that takes on the device, for SD and, with HD, the main
  stream.
- **Phase 9, the Wall, is done:** both checklists passed on the owner's desktop and
  wall tablet.

## 0.56.0

The Wall as a kiosk, and on a dashboard.

- **The pointer hides** after 3 seconds still over the Wall, and comes back when it
  moves.
- **The screen stays awake** while the Wall shows, where the browser can (over
  https); in Fully Kiosk, Fully's own settings do it, and with its JavaScript
  interface on, the Wall's video stops while Fully's screen is off or its
  screensaver shows.
- **Reolink Wall**, a dashboard card: one of your saved layouts on a dashboard, as
  the Wall shows it, with or without its bar. Choose the layout in its settings; a
  tap on a detection opens its recording in the panel.

## 0.55.0

The latest detections on the Wall.

- **A tile lights up** with a red frame and what its camera sees (Person, Vehicle…)
  the moment one of its detection sensors turns on in Home Assistant.
- **A strip along the bottom** holds each camera's newest detection: a picture, what
  and when, **New** until you open it, **Unusual** when it stood out. A tap opens the
  recording. A detection going on leads it as **Now**; tap it to see the camera large.
- **Layouts can leave out the floodlight and siren buttons** on their feeds (Layout ⌄
  → Show), and the strip too. The cameras' other controls stay.

## 0.54.1

From the capacity test with 2 and 3 full-resolution streams.

- **Two HD tiles per NVR:** the NVR played six SD streams, three full-resolution ones
  and a recording at once without slowing, so it now serves up to 9 streams (was 7),
  and the Wall plays two tiles in HD on it at once (was one).
- **The capacity test no longer blames the NVR** for a camera whose full-resolution
  stream sends nothing while a stream added after it plays: it says that is the
  camera's (the Duo 3's 16 MP stream), and counts the streams that did play.

## 0.54.0

HD in the Wall's large tiles.

- **The large tile plays in HD:** the large slot of 1 + 5 and 1 + 7, a camera alone on
  the screen, and any tile shown larger than its camera's SD picture. It says **Live
  HD**; the SD video plays until the HD video's first picture, as in full screen.
- **One at a time per NVR**, the large slot first; the other tiles stay in SD, and
  their ⓘ says why.
- **It gives way:** HD in a tile takes a stream only when the NVR has one free, and
  gives it back as soon as another screen, full screen or a recording needs it (SD
  for a minute, then it tries again). Away from home the tiles stay in SD, unless you
  chose HD on that device.
- **The capacity test** can open 2 or 3 full-resolution streams at once (**Full-
  resolution streams in it**, in the live check), to see whether an NVR could play more
  than one HD tile.

## 0.53.0

Arranging the Wall.

- **Move cameras between cells:** drag a tile onto another; on a touch screen, tap
  **Arrange**, then a camera and where it goes. A saved layout keeps the new order for
  every device you sign in on.
- **A double tap** puts a camera in the large slot of 1 + 5 and 1 + 7, or shows it
  alone on the screen and back.
- **Pages and tours:** more cameras than cells make pages (‹ 1 / 2 › in the bar), and a
  layout can turn them by itself, every 10 seconds to every 2 minutes.
- **From the keyboard:** the arrows move between cells, Shift with an arrow moves a
  camera, Enter makes it larger, Esc brings it back; each move is said to a screen
  reader.

## 0.52.0

The Wall: the Live page as a monitor.

- **Wall**, on the board: the cameras' video only, large, fitted to the screen with
  nothing to scroll, under a thin bar with the layout, the time, full screen and the
  way back to the board.
- **Layouts:** All cameras (packed by shape, as the board), 1, 2 × 2, 3 × 3, 4 × 4,
  1 + 5 and 1 + 7, named and saved for your user, so every device you sign in on can
  show them; each has its own address (`#wall/<name>`) for a kiosk's start page.
- **Each device remembers** whether it shows the board or the Wall, and which layout.

## 0.51.0

Unusual events for automations.

- **Each detection is scored as it begins** (and again when it ends, for one that
  lingered), against what its camera has learned.
- **`reolink_viewer_unusual`**, an event on Home Assistant's bus, once per incident: the
  camera, what it was, the score and the sentence saying why. The user guide has a
  notification automation using it.
- **"<Camera> unusual activity"**, a sensor per camera on the Reolink Viewer device, on
  while something unusual is going on; and a "Something unusual seen on <camera>" trigger
  in the automation editor.

## 0.50.0

House-wide signals: what the house says beside each detection.

- **House-wide signals to learn with**, in the options: anyone home, the alarm, a gate
  or door lock, the light outside... Each detection is learned with what they stood
  at, so a person on the drive with everyone away can stand out where the same person
  with someone home does not. Their last days come from Home Assistant's history.
- **Said where it counts:** a mark's sentence ("…, and with House alarm armed away"),
  Why it is unusual, Devices → Learning what is normal ("Learned with …"), and each
  camera's What it has learned.
- A signal that is offline or starting up says nothing either way.

## 0.49.0

- **What it has learned**, on each camera's Overview: per kind of thing it sees, when
  (each hour), on which days, for how long and what fired first, with what it has seen
  too few times to know marked **Can stand out**. The way to spot a camera that learned
  something wrong.
- **A mark's count is a total:** "Package on Doorbell — seen 8 times in 10 days".
  Marks of the past are scored against today's model, so two packages a day apart both
  said "8th time"; and "Package at all on" now reads "Package on".
- **The numbers behind it** name the daily cap as the line only when it is above the
  floor; at or under it, it holds nothing back.

## 0.48.0

Unusual events in the panel.

- **Marked events on the timetable.** On the home view and Events, an event marked
  unusual has an **Unusual** tag, and **Why it is unusual** under it: its sentence,
  then each signal (what it was, the time of day, how long...) in words, with a bar
  for how far it pushed the event towards rare or usual.
- **Events → Marked: Unusual** shows only the day's marked events ("Learning…" until a
  camera marks).
- **A marked event the camera does not list** gets a row of its own, seen by Home
  Assistant's sensors.

## 0.47.5

- **Balanced marks a few a day again.** With what is known no longer standing out
  (0.47.4), its line sat too high: it marked about 1 a day. It now marks whatever is
  new enough to be rarer than chance, at most 3 a day across the property.
- **More, including borderline ones** now counts as new what a camera has seen fewer
  than 20 times (rather than 10), at most about 6 a day; **Only the strangest** marks
  under one a day.

## 0.47.4

Unusual events, tuned on the third week of marks: what happens most days is not unusual.

- **Whatever a camera has seen 10 times is known there:** a time of day, a length, a
  day of the week, as kinds already were. "Vehicle lasting about 16 s — 14th time in 8
  days" is no longer marked; a mark's sentence now says "2nd time", "7th time", never
  "14th". Expect fewer marks; **More** in the options marks more.
- **What fired first only counts when nothing did:** someone appearing without what
  usually comes first still stands out, but "21s after Dogs" no longer does (on a busy
  property, which camera fired last is mostly chance).

## 0.47.3

- **A mark never says "usual" any more.** One person crossing several cameras counted
  each step from one camera to the next as "what fired first", a rare step, which alone
  could mark them ("Person at 16:56 — usual for Back Yard, Front Yard Left, …"). Now
  the later cameras of an incident take what fired before the whole incident, and a
  mark always says what stood out.
- **A restart shows what it learned at once:** the model is kept beside the journal
  between restarts (and deleted with it), instead of being learned again each time.

## 0.47.2

Unusual events, tuned on the second week of marks: fewer that are not worth a look.

- **Only lasting longer than usual stands out.** A detection briefer than usual (a
  passing car, a false one: "Vehicle lasting about 1 s") is no longer marked for
  being brief; someone lingering still is.
- **A kind a camera has seen 10 times is known there:** the doorbell on the doorbell
  camera, or a package, no longer stands out just for being one. It still does at a
  strange hour or for a strange length, and a kind new to a camera still stands out.
- **What fired first** now means another camera's detection, not its motion: with
  motion on several cameras most of the day, which camera came last was close to
  random ("9s after Dogs").
- **"Learned … in N s"** now also says how much of that was computing, and how much
  waiting behind Home Assistant.

## 0.47.1

Unusual events, tuned on the first week of marks.

- **Motion is no longer marked.** It still counts toward what is normal (what fired
  first, what a camera usually sees), but the marks go to people, vehicles, animals,
  doorbell presses and the like. Motion was 10 of the first 25 marks.
- **One mark per incident:** the same kind of thing on several cameras within a
  minute is one mark, naming every camera: "Animal at 02:25 on Front Yard Right,
  Front Yard Left and Doorbell". The daily allowance counts incidents, so more
  different things get through.
- **The time of day counts once.** The time of day and the time from sunset were
  counted as two signals though they say nearly the same thing, so night-time events
  stood out twice over. Now each counts half, and a sentence says the time once.
- **The journal's size is right again:** the one-time compaction in 0.47.0 left a
  write-ahead file of a few megabytes beside it; it is now emptied at the next start,
  and kept small.
- **"Learned … in N s"** now shows how long the learning took, not counting its wait
  for a free thread at Home Assistant's start.

## 0.47.0

Phase 8, step 2: Reolink Viewer learns what is normal for each camera, and marks what
is not.

- **Unusual events:** with **Learn what is normal** on, each camera learns from its
  journal how often it sees each kind of thing at each time of day, how long after
  sunset, for how long, on which days, and after which other camera. An event that is
  rare for its camera is marked, with a sentence saying why: "Person at 03:12 on
  Doorbell — 2nd time in 3 weeks, and nothing fired first."
- **Devices → Learning what is normal** shows whether each camera marks yet (a week of
  history and 200 detections), the last 7 days' marks with their sentences, and the
  numbers behind them.
- **Two new options:** how much to mark (only the strangest, balanced, or more: at
  most about 2, 4 or 9 a day across the property) and what each camera is compared
  with (all cameras together, each NVR or Hub, or each camera on its own).
- **It learns again each night,** at 03:17.
- Unusual means rare for that camera, never dangerous. Marks on the timetable and an
  event for automations come next.
- The model is ported from [Reolink Stamina](https://github.com/marl1w/reolink-stamina-ha)
  (MIT, by marl1w), with its tests; see
  [THIRD_PARTY.md](https://github.com/ambient-home-systems/Maverick-Reolink-Viewer/blob/v0.47.0/THIRD_PARTY.md).
- See [What is unusual](https://github.com/ambient-home-systems/Maverick-Reolink-Viewer/blob/v0.47.0/docs/user-guide.md#what-is-unusual).

## 0.46.1

Learning what is normal keeps the journal smaller.

- **Motion is kept as bursts:** a motion sensor that goes off and back on within
  30 seconds (a tree in the wind, passing headlights) is now one burst, from its
  first start to its last stop. Motion was 85% of the journal. People, vehicles,
  animals, doorbell presses and the other detections are kept as they come.
- **The journal you have is compacted once,** at the first start after the update,
  the same way: its motion counts, and its size, go down.
- **A year of history:** what is older than 12 months is deleted, each day.
- See [Learning what is normal](https://github.com/ambient-home-systems/Maverick-Reolink-Viewer/blob/v0.46.1/docs/user-guide.md#learning-what-is-normal).

## 0.46.0

Phase 7 is done. Phase 8, step 1: learning what is normal starts with a journal.

- **Learn what is normal (off unless you turn it on):** in Reolink Viewer's options,
  it keeps a journal of what each camera detects (people, vehicles, animals, motion,
  doorbell presses and more) and when, so a later version can mark what is unusual
  for each camera. It starts with the last 10 days of Home Assistant's own history.
- **It stays on this Home Assistant:** a small file in the config folder, a few
  megabytes a month, included in backups and never sent anywhere. Turning the option
  off deletes it, and so does removing Reolink Viewer.
- **Devices → Learning what is normal** shows since when it learns, and how many
  detections it has from each camera.
- See [Learning what is normal](https://github.com/ambient-home-systems/Maverick-Reolink-Viewer/blob/v0.46.0/docs/user-guide.md#learning-what-is-normal).

## 0.45.2

- **No more "Detected blocking call" warning at startup.** Reolink Viewer read the
  Reolink library's version from disk while Home Assistant was starting; it now reads
  it once, in the background.
- **The Dashboard cards report shows a camera's video switching over.** When a card
  could not start over WebRTC and fell back to MSE (after a Home Assistant restart,
  say), the report now says so, with how long WebRTC took and why it gave up.

## 0.45.1

From the wall tablet's test.

- **A doorbell's card now really fills the screen when it rings.** Without a tap, the
  tablet's browser refuses its own full screen, and the card's stand-in stayed in its
  place on the dashboard. It now covers the whole screen, whatever the dashboard's
  layout. The same goes for a card's full screen in the iPhone app.
- **A card's full screen shows SD without the note** explaining why over the picture
  (the Doorbell's main stream is H.265, which the tablet cannot decode at its size).
- **The editor's warnings** say what the tablet measured: a camera not kept warm takes
  a few seconds to start.

## 0.45.0

Phase 7, step 2: the camera card on a wall tablet.

- **When the doorbell rings,** a doorbell's card can go full screen for a while
  (**When it rings**, in the card's settings; 30 seconds to start with), and back.
  On a Fully Kiosk tablet it wakes the screen first. No browser_mod needed.
- **Fully Kiosk's screensaver and screen off stop the cards' video,** so a wall
  tablet stays cool while nobody looks, and it starts again when the screen is back.
  This needs Fully's JavaScript interface (**Settings → Advanced Web Settings →
  Enable JavaScript Interface**, a Fully PLUS feature).
- **Devices → Dashboard cards:** what the cards saw on each device, the screen going
  off and on, how soon video came back, whether any played while nobody could see
  it, the rings. A tablet's night can be read the next morning on any device, and
  downloaded.
- See [A camera on a dashboard](https://github.com/ambient-home-systems/Maverick-Reolink-Viewer/blob/v0.45.0/docs/user-guide.md#a-camera-on-a-dashboard).

## 0.44.0

Phase 7, step 1: a camera on any dashboard.

- **The Reolink camera card.** Edit a dashboard, **Add card**, and search for
  **Reolink camera**: it shows one camera the way the panel's board does, with its
  last picture at once, then live video. On a camera kept warm, the video starts in a
  fraction of a second. There is nothing to add to the dashboard's resources: the
  card comes with Reolink Viewer.
- **Its settings:** the camera; SD, or HD on the card itself; what a tap does (full
  screen in HD, open the camera in the Reolink panel, or nothing); whether the name
  and state show over the picture; and whether the picture fills the card or shows
  whole. The editor says when the camera is not kept warm, with its **Keep warm**
  switch beside it.
- **For every user,** admin or not. Like the board, it plays only while it is on
  screen and the page is visible, a battery camera waits for a tap, and while one card
  is full screen the others on the page pause.
- **Lighter on the cameras:** a card keeps only its own camera's picture fresh, not
  every camera's.
- The panel's files are split differently, so the card and the panel share them; the
  panel's first download is about the same.
- See [A camera on a dashboard](https://github.com/ambient-home-systems/Maverick-Reolink-Viewer/blob/v0.44.0/docs/user-guide.md#a-camera-on-a-dashboard).

## 0.43.0

Phase 6, step 3: pictures of the Doorbell's events.

- **Tapping one of the Doorbell's events opens it as pictures.** Its **Playback**
  tab shows the event: a picture from every 5 seconds of it (up to 15), with buttons
  to step through them or play them one a second, and the day's other events beside
  it, with the days before. Its recordings still play only in the Reolink app.
- **The Doorbell's events have thumbnails** on the home view and the **Events** tab.
- **Why they had none:** the doorbell sends its pictures in a form Home Assistant's
  Reolink library does not read. Reolink Viewer now reads them itself (as it already
  does for a start deep in an NVR's recording).
- The same goes for any camera whose recordings are kept where Reolink Viewer cannot
  play them.

## 0.42.0

Phase 6, step 2: the Doorbell on the Events page.

- **A battery doorbell that keeps its recordings on its SD card now lists its
  events**: on the home view under the board, on the **Events** tab and in its
  calendar, beside the other cameras. The Doorbell speaks only the Reolink app's
  protocol and its recordings cannot be played in the panel, so it was left out
  before; its events now come from its own search.
- **Only while it runs on wired power.** On its battery it is left out, since
  asking it for events every few minutes would wake it.
- **Its first look at a day takes about 15 seconds** (the doorbell searches slowly
  over Wi-Fi); after that the day comes at once.
- **Its events are at the right times**: it uses Home Assistant's time zone, which
  the doorbell's own clock matches.
- Tapping one of its rows opens its **Playback** tab, which says its recordings are
  on its SD card; play them in the Reolink app. Pictures of its events come in a
  later release.

## 0.41.1

- **The doorbell events test now runs on the Doorbell.** In 0.41.0 it stopped at
  its first step on a camera that speaks only the Reolink app's protocol, as the
  battery Doorbell does: it could not read the camera's clock ("cannot read device
  time"), so it searched nothing. It now asks the camera's own clock over that
  protocol, and uses Home Assistant's clock if that fails too. The file says which
  clock it used.
- **The file also records what the camera says about its time zone.** Listing the
  Doorbell's events at the right times needs its zone, which Home Assistant's
  Reolink integration does not have for such a camera.

## 0.41.0

Phase 6, step 1: finding out whether a doorbell's events can be listed.

- **A new test in the hardware probe** (Devices → Hardware probe, for
  administrators): "Test the events of cameras that record where Reolink Viewer
  cannot play it". It is for cameras like the battery Doorbell, which keeps its
  recordings on its SD card and is left off the Events page today. On each such
  camera it asks for this month's days with recordings, today's and yesterday's
  events in SD and HD, and a picture from the newest events, and says how long
  each took. It only reads.
- **A battery camera on wired power is tested without ticking "Include battery
  cameras"**, since it never sleeps; one on its battery still needs the tick.
- **The file says what was found, not when:** it holds the counts, types and
  lengths of the events, never their times of day.
- The result decides how the Doorbell's events come to the Events page in the next
  release.

## 0.40.1

Fixes from a review of the deep starts over the Reolink protocol (Phases 5b and
5c).

- **Closing a tab during an HD start no longer keeps Home Assistant signed in to
  the recorder.** A tab closed, the iPhone app killed or the network gone sent no
  word, and the recorder's answer waited for it forever between two parts: the
  extra sign-in stayed on the recorder's list of online users until Home
  Assistant restarted, and its disk space stayed reserved. Now an answer nobody
  reads for 25 seconds ends, and the sign-in goes 30 seconds later. Coming back
  to the video asks the recorder again where it left off.
- **Two people watching one camera take turns within seconds.** One who had made
  way for the other could wait for the other's whole answer (about 20 s for an
  hour of SD) with only a few seconds of video ready; now each has the recorder
  for about a second at a time while the other waits.
- **A copy that fails no longer leaves the recorder's answer running**, which the
  next try could then overwrite.
- **A picture size the recorder gets wrong, or a lost network route, fails only
  that start** and falls back to the copy, instead of leaving a dead connection
  that made the next deep start wait 6 seconds.
- **The next part of an HD answer no longer makes the copy start over.** On a
  recorder with no stream free, each part took the copy's stream, and the copy
  then read the recording from its start again; now the copy stops where it is,
  and goes on only if you go back to the part it lacks.
- Smaller: a slow reply to "stop" from the recorder no longer cuts off the next
  part, and is no longer logged as an error; an interrupted stop always signs out
  and wakes the waiting player.
- **The hardware probe's Reolink protocol test** says that it signs in on a
  connection of its own (one more user on the recorder while it runs).

## 0.40.0

Phase 5c, step 5: two people watching the same camera's recordings at once.

- **A second viewer no longer stops the first.** Two starts deep in one camera's
  recordings (on two devices, or SD and HD) used to cancel each other's request
  to the recorder; now they take turns, the second going first for its first
  picture, and the first playing on from what it already has.
- **Jumping far in a recording someone else is watching** no longer takes their
  video away.
- **The playback check** (v0.4.5) says when a start gave way to another viewer.

## 0.39.1

- **Recordings at the right time after a DST change.** The recorder's time zone
  came from reolink-aio, which puts the start and end of daylight saving time on
  the wrong day in most years: in 2026 it ends DST on 8 November instead of the
  1st. From 1 to 8 November the timeline showed recordings an hour early (and a
  start deep in a recording fell back to placing its video by the time asked).
  The zone is now built from the recorder's own settings, read correctly.
- **Each camera's clock rate** is kept once measured over two minutes (five
  before, which a start near an hour's end never reached).

## 0.39.0

Phase 5c, step 3: the clock of a start deep in a recording.

- **Each camera's clock rate is kept.** The frames of the recorder's answer are
  placed on the camera's own clock, which runs up to 2 % off; that rate is now
  kept once measured, so the next start of that camera is on it from the first
  frame instead of after a minute.
- **The playback check** (v0.4.4) says how far apart the copy and the recorder's
  answer place the same moment where they meet, and how long Home Assistant spent
  turning the answer into video.

## 0.38.0

Phase 5c, step 2: starting deep in a recording over the Reolink protocol is on
by default.

- **On by default** for every recorder and camera that takes the protocol. It can
  be turned off in the options (Settings → Devices & services → Reolink Viewer →
  Configure); a setting already made is kept.
- **A device that does not take it is found out** at its first deep start (its
  port closed, or the sign-in or the request refused) and left alone for six
  hours: its starts wait for the copy, as with the option off. **Details** and the
  playback check say "not supported by this device" and why.
- **Dragging along the timeline is lighter**: the event list redraws only when the
  marked event changes, the timeline no longer measures the page at each step,
  and the day's name is not formatted afresh each time (a step a third cheaper on
  a slow processor).

## 0.37.1

- **The playback check** (v0.4.3): its link test reads the fragments the player
  reads, from what is copied, instead of the clip. Since 0.37.0 a clip of a
  recording copied in two pieces waits for the rest of the copy, so the test
  timed out ("signal is aborted").

## 0.37.0

Phase 5c, step 1: a start deep in a recording over the Reolink protocol (the
option) fetches the recording once and costs the recorder one stream.

- **Nothing is fetched twice.** The copy of the recording stops where the
  recorder's answer begins; the answer has the rest. An HD start no longer
  downloads the rest of the hour (about 2 GB) beside it. Downloading the clip,
  or the file player, fetches the rest of the copy first.
- **One stream per start.** With no stream free on the recorder, the start takes
  its own copy's, and the copy goes on after it (0.36 waited for a second
  stream, and on a busy recorder the start then waited for the copy).
- **Details** says how far the copy went ("copied to 57.0 min"); the playback
  check, where the copy stopped and when the start took its stream.

## 0.36.2

- **HD plays on from one recording to the next**: after moving on to the next
  recording in HD the viewer lost its place, so it did not get the one after
  ready and stopped at its end; a jump within an HD recording also reloaded it
  instead of seeking.
- **The playback check** (v0.4.2) runs its SD rows in SD when the tab was left
  on HD (its HD row switches to HD itself), and a jump that played while the
  recording was still being copied is reported as not judged rather than "did
  not play".

## 0.36.1

What the hardware check of 0.36.0 asked for:

- **HD starts over the Reolink protocol fetch only what you will watch**: a few
  minutes ahead at a time, more as you play, and the rest from the normal copy
  once it has it (0.36.0 fetched the whole rest of the recording, about 2 GB an
  hour, beside the copy).
- **The first HD start of a day starts sooner**: the day's HD recordings are
  looked up in the background when the day opens (that lookup took 8 seconds
  when HD was first pressed).
- While the recorder sends the moment asked for, the player says so ("Asking the
  recorder for this moment…") instead of showing the copy's progress.
- **Details** shows why HD last failed; the playback check names what served
  each start and jump.

## 0.36.0

- **Start deep in recordings over the Reolink protocol** (an option, off by
  default: Settings → Devices & services → Reolink Viewer → Configure). A start
  or a jump more than 30 seconds past what is copied of a recording asks the
  recorder for that moment over its own protocol, so the first picture shows
  in about a second instead of after the copy reaches it (7 to 13 seconds 45
  minutes into an hour on an NVR). The recording is still copied; speeds,
  pausing and jumping work as before; any failure waits for the copy as
  without the option. While in use the recorder counts one more signed-in
  user, for about 30 seconds after the last such start. A prototype (Phase 5b):
  the owner's hardware check decides what comes next.
- **The playback check** (v0.4.0) and **Details** under the player say what
  served a start: the Reolink protocol cut (with its first fragment and login)
  or the recording's download.

## 0.35.5

- **The Baichuan probe's session test** runs its second replay on the same
  connection under that connection's stream slot, so live view holding the
  other slots no longer skips it; and the frame counter's rate is read from the
  key frames alone on newer cameras (their frames' extra headers were mistaken
  for clocks).

## 0.35.4

From the first Phase 5b report:

- **The Baichuan probe reads newer cameras' recordings.** Their frames carry an
  extra header the reader did not expect, so a quarter to a half of the bytes
  were skipped and the key frames in them missed. The reader now takes the
  header the stream shows, and the report keeps a few raw samples of anything
  it still cannot read.
- **A download cut of the HD recording asks for the HD stream** (the recorder
  answered with the lighter one before).
- **A camera without a long recording is measured on its longest clip**, and
  the report says so.
- **The session test skips a part it cannot get a stream slot for** instead of
  stopping.

## 0.35.3

- **The Baichuan probe no longer waits without end for a stream slot.** Each
  of its streams takes a slot of the recorder's stream budget, which live view
  and cameras kept warm also hold; with none free the probe looked frozen.
  It now says so in its progress line, gives up after a minute with the
  reason, and the report records the budget's state.

## 0.35.2

- **Hardware probe → Test replay over the Reolink app's own protocol** gains
  **Only this test**, on by default: the probe skips the live video and
  recording checks on every camera (six minutes on an NVR) and runs the
  Baichuan measurement alone. Its **Cameras** field now matches camera
  models ("Duo 3, CX810") as well as the names given to the channels.

## 0.35.1

- **The Baichuan probe runs again.** In 0.35.0 the panel's new options for it
  (HD recordings, the download cut, the session test, cameras, hold) were not
  accepted on the server, so the probe stopped at once with "not a valid
  option". Nothing else changes.

## 0.35.0

A measurement release for Phase 5b, nothing changes in daily use:

- **Hardware probe → Test replay over the Reolink app's own protocol** now
  measures what a deep start over that protocol would need: on every camera
  of the recorder you choose (or all of them), on the sub recordings and, if
  ticked, the HD ones, it replays 75 % into a long recording and, new, asks
  for a download cut from the same point (the way the Reolink client saves a
  clip), and times both to the first picture. It decodes what arrives (the
  video codec and its parameter sets, picture types, timestamps, the audio
  format) without keeping any video, and counts the recorder's logged-in
  users around each stream. An optional session test holds a replay open
  beside a full-speed download, then two replays at once. Read-only, a few
  seconds of video per camera.

Tested on Home Assistant 2026.10.1 to 2026.10.4.

## 0.34.1

- **Hardware probe → Test replay over the Reolink app's own protocol** now looks
  through every channel of the recorder, today's recordings included, for a
  long recording instead of giving up when the first channel only has motion
  clips. The report lists what was searched per channel. Cameras added directly
  are skipped without a device call.

## 0.34.0

A measurement release for Phase 5a, nothing changes in daily use:

- **Hardware probe → Test replay over the Reolink app's own protocol.** An opt-in
  check that replays a long recording of a recorder 45 minutes in over Baichuan,
  the protocol the Reolink app uses, and over HTTP, and compares how fast each
  reaches the first picture. Read-only: it opens its own connection, plays a few
  seconds, stops and logs out, and asks the recorder how many clients were
  logged in before, during and after. Its numbers decide whether Phase 5
  continues.
- The developer tool behind it, `scripts/baichuan`, turns a Wireshark capture of
  the Reolink client into a redacted message log, and `docs/baichuan-playback.md`
  records what the captures showed.

Tested on Home Assistant 2026.10.1 to 2026.10.4.

## 0.33.0

Choose how full screen plays on each device:

- **Devices → This device** sets whether full screen starts in HD or SD at home, and
  in HD or the lighter SD away from home or on mobile data. Until now that was only
  what you last tapped in full screen.
- **Remember HD or SD when I tap it in full screen** is on, as before: a tap changes
  the setting. Turn it off and a tap lasts until you leave full screen, so full
  screen starts as set every time.

Each phone and computer keeps its own settings. Tested on Home Assistant 2026.10.1 to
2026.10.4.

## 0.32.3

Fixes from trying the panel on an iPhone:

- **Full screen shows the whole picture at once.** Until HD took over, full screen
  showed the camera's lighter stream cropped to fill the screen, as tiles on the
  board are. Now it shows all of it, in SD as in HD. Away from home, where full
  screen stays in SD until you tap HD, that was the whole time.
- **Full screen keeps clear of the iPhone's corners.** The HD button, the camera's
  name and the full-screen button no longer sit under the rounded corners or the
  notch.
- **Pinching the recordings timeline keeps following your fingers** on the iPhone,
  where a pinch could stop after its first step, as if the page had started to
  scroll.

Tested on Home Assistant 2026.10.1 to 2026.10.4.

## 0.32.2

The live check's NVR capacity test no longer blames the NVR for a camera stream that
does not play:

- The test adds, last, the full-resolution stream of the camera that sends the most.
  When that stream sent no video at all, even on its own, the check said the NVR
  struggled with that many streams and suggested keeping fewer cameras warm. Now the
  test first checks that the stream plays on its own, uses the next camera's if not,
  and says which camera's full-resolution stream sent no video, and what to try.

Tested on Home Assistant 2026.10.1 to 2026.10.4.

## 0.32.1

Live video starts sooner on networks that block one of its two ways of streaming:

- On some networks, often at work, a camera that is not kept warm (a doorbell, say)
  took about 16 seconds to start: Reolink Viewer first tried its quicker way of
  streaming (WebRTC), which these networks block, and only after 15 seconds used the
  other. Now, once that happens, the device remembers it for a week for that Home
  Assistant address, and its cameras start the other way at once. If the quicker way
  works again, it is used again.
- A camera's ⓘ view says so: "Network: WebRTC does not connect from here, so MSE goes
  first until …".

Tested on Home Assistant 2026.10.1 to 2026.10.4.

## 0.32.0

Guides for everyone who uses the panel, in plain words, and the way to them from the
panel:

- **[User guide](https://github.com/ambient-home-systems/Maverick-Reolink-Viewer/blob/v0.32.0/docs/user-guide.md):**
  what each part of the panel does and how to use it, on a computer and on a phone,
  with pictures.
- **[Troubleshooting](https://github.com/ambient-home-systems/Maverick-Reolink-Viewer/blob/v0.32.0/docs/troubleshooting.md):**
  every message the panel can show, word for word, with what it means and what to
  do, and what to include when you ask for help.
- **[Cameras and NVRs](https://github.com/ambient-home-systems/Maverick-Reolink-Viewer/blob/v0.32.0/docs/cameras.md):**
  what to expect from each Reolink model tested so far, and the camera settings that
  make live view start sooner.
- In the panel, **Devices → Help** opens them, for the version you have installed,
  and messages about a problem have a **More help** link to the part of
  Troubleshooting about them.

Tested on Home Assistant 2026.10.1 to 2026.10.4.

## 0.31.0

The first release through HACS. Reolink Viewer adds a **Reolink** panel to Home
Assistant's sidebar for the cameras, NVRs and Home Hubs set up in Home Assistant's
Reolink integration:

- **Live:** every camera on one board, each starting from its last picture; full
  screen in HD; picture-in-picture; the camera's own controls (pan and tilt, zoom,
  presets, floodlight, siren).
- **Events:** today's events from every camera as a timetable under the board, and
  any day's in the Events tab, filtered by camera and by what was seen.
- **Recordings:** each day on a timeline with the camera's own detections and
  thumbnails, from the NVR or the camera's SD card, in HD or SD, slow or fast.
- **Devices and settings:** every detail and setting the Reolink integration has,
  each explained in plain words.
- **Checks:** a live check, a playback check and a 24-hour soak report say in plain
  words how well it works on your devices, and what to do when it does not.
- On a computer and in the Home Assistant app on a phone, light and dark, from the
  keyboard and with a screen reader.

New in this release:

- Each release comes packaged: for HACS, and as `reolink_viewer.zip` to install by
  hand.
- Tested on every Home Assistant release from 2026.10.1 to 2026.10.4; a weekly
  check tries the newest. It needs 2026.10.1 or newer: 2026.10.0's Reolink library
  cannot search the recorder's days, so there it would run without live view,
  recordings and events, and HACS no longer installs it there.

Earlier versions were not released; the
[README](https://github.com/ambient-home-systems/Maverick-Reolink-Viewer#readme) says
what each one added.
