"""Unusual events: learning what is normal for each camera (Phase 8 step 2).

Of the hundreds of detections a day, the few that are unusual for their camera
are found by counting, not by recognising anything: per camera and subject,
how often it is seen at that time of day, that far from sunset, for that long,
on that day of the week, after what other camera. An event is scored by how
much rarer than chance each of those is (added up, naive Bayes), and marked
when it passes its camera's own line, an absolute floor and the property's
daily cap (ours: a busy property is kept to about so many a day). It ranks by rarity,
never by danger.

The model is ported from Reolink Stamina's ``relevance`` package (v1.9.2,
<https://github.com/marl1w/reolink-stamina-ha>, MIT, Copyright (c) 2026
marl1w; licence in
LICENSE-reolink-stamina.txt), adapted to our journal (``journal.py``), our
camera ids and our hosts. Each ported module says what changed.
"""
