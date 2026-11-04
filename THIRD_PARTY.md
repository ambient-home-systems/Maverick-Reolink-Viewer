# Third-party code

Code ported into Reolink Viewer from other projects, with their licences.

## Reolink Stamina

<https://github.com/marl1w/reolink-stamina-ha>, v1.9.2 (commit `ec9aabf`), MIT.

Phase 8 step 2's model of what is normal for each camera is ported from its
`custom_components/reolink_stamina/relevance/` package and `const.py`, with
its tests (`tests/test_relevance_score.py`, `test_relevance_events.py`,
`test_relevance_analysis.py` and, for step 3, `test_relevance_shapes.py`):

| Ours | From Stamina |
| --- | --- |
| `custom_components/reolink_viewer/unusual/events.py` | `relevance/events.py`, and `detections.py`'s map of sensor keys to subjects |
| `custom_components/reolink_viewer/unusual/rates.py` | `relevance/rates.py` |
| `custom_components/reolink_viewer/unusual/score.py` | `relevance/score.py`, and `relevance/shapes.py`'s `informative` and `duration_phrase` |
| `custom_components/reolink_viewer/unusual/model.py` | `relevance/analysis.py` (adapted) |
| `custom_components/reolink_viewer/unusual/shapes.py` | `relevance/shapes.py` |
| `custom_components/reolink_viewer/unusual/const.py` | `const.py`'s relevance numbers |
| `tests/test_unusual_events.py`, `test_unusual_score.py`, `test_unusual_model.py`, `test_unusual_shapes.py` | `tests/test_relevance_events.py`, `test_relevance_score.py`, `test_relevance_analysis.py`, `test_relevance_shapes.py` |

Each ported file says what was changed. The licence ships with the
integration too, as `custom_components/reolink_viewer/unusual/LICENSE-reolink-stamina.txt`.

```text
MIT License

Copyright (c) 2026 marl1w

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
