# ARCHITECTURE.md — LILA BLACK Player Journey Visualizer

## What I Built and Why

**Stack: React + HTML5 Canvas + Python (data pipeline) → Vercel**

I chose this stack deliberately for the target user — a Level Designer who opens a URL and immediately gets value, without installing anything. React gives me component-driven state management for filters, Canvas gives me performant rendering of thousands of event points (DOM-based libraries choke above ~5K nodes), and Vercel gives me a zero-config deploy in under 2 minutes.

I specifically avoided heavy charting libraries (D3, Recharts) for the map view — they add abstraction I don't need and hurt render performance. Raw Canvas with requestAnimationFrame gives full control over every pixel, which matters for the playback animation.

---

## Data Flow: Parquet → Screen

```
.nakama-0 files (Apache Parquet, parquet-go v1)
        ↓
convert_data.py  (pandas + pyarrow)
        ↓
data.json  (~single file, placed in /public)
        ↓
React app fetches on load → in-memory state
        ↓
useMemo filters → filteredEvents[]
        ↓
Canvas renderer → pixels on screen
```

**Why JSON, not streaming parquet?**  
The data is ~26MB zipped. A pre-processed JSON of ~10–30MB loads once and then all filtering is instant (client-side). This keeps the tool fast for repeated filter changes — no round trips. With more time I'd use SQLite-wasm or DuckDB-wasm for in-browser parquet querying, which would scale better to months of data.

---

## Coordinate Mapping

This was the trickiest part. The parquet files contain world-space coordinates (X, Y floats in game units — likely Unreal Engine centimeters, ranging ±90,000+). There are no minimap images in the provided dataset, so I implemented **auto-fit coordinate normalization**:

```
canvas_x = margin + ((world_x - x_min) / (x_max - x_min)) * (canvas_width - 2*margin)
canvas_y = margin + ((world_y - y_min) / (y_max - y_min)) * (canvas_height - 2*margin)
```

Bounds are computed per-filter-state with 5% padding so points never touch edges. This means the view auto-adjusts when switching maps, dates, or matches — the coordinate space always fills the canvas correctly.

**If minimap images were provided**, I would: (1) use the README's coordinate-to-pixel mapping formula, (2) render the minimap as a background image on canvas, (3) apply the affine transform specified in the README rather than the auto-fit approach.

---

## Bot Detection

Bots have UUID-formatted user IDs (e.g. `10648aa3-b215-4c52-9577-5c5689a08939`).  
Humans have short numeric IDs (e.g. `1379`).

I detect this with a regex:  
```python
uuid_pattern = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
```

This is confirmed by the data: event types `BotPosition`, `BotKill`, `BotKilled` appear exclusively with UUID user IDs. The tool renders bots in indigo (`#6366f1`) and humans in cyan (`#22d3ee`).

---

## Assumptions Made

| Situation | Assumption | Reasoning |
|---|---|---|
| No minimap images in zip | Auto-fit coordinate normalization | Makes tool usable; trivially swappable if images are provided |
| Only February_14 folder in zip | Data pipeline scans all date subfolders | Future-proof; works if more dates are added |
| Multiple event type names for kills | Treat `Kill`, `KHKill`, `xHKill`, `BotKill` as kill family | All appear to represent elimination events based on naming |
| No explicit timestamp column found | Use file sequence order for playback | Playback shows relative progression, not wall-clock time |
| Coordinate system direction | Y increases downward (standard game convention) | Most extraction shooters use this; reversible in one line |

---

## Major Tradeoffs

| Decision | Alternative | Why I chose this |
|---|---|---|
| Single JSON file | SQLite-wasm / DuckDB-wasm | Simpler setup, no WASM bundle size cost; fine for 5-day dataset |
| Canvas rendering | SVG or WebGL | Canvas is the sweet spot: fast enough for 50K points, simpler than WebGL |
| Client-side filtering | Server-side API | No backend needed → zero infra cost, instant filter response |
| Pre-built JSON | Stream parquet in browser | parquet-wasm adds ~2MB bundle and parsing latency |

---

## What I'd Do Differently With More Time

1. **Real minimap images** — overlaying actual map textures makes spatial patterns instantly meaningful to designers
2. **DuckDB-wasm** — in-browser SQL on raw parquet means no conversion step and real-time aggregations
3. **Per-player highlighting** — click a player trail to isolate their journey across the full match
4. **Storm zone overlay** — animate the shrinking safe zone radius over the match timeline
5. **Zone annotation tool** — let designers draw polygons on the map and get instant stats for that zone
6. **Multi-day comparison** — side-by-side map view showing how behavior changed across the 5-day period
