# INSIGHTS.md — Three Things I Learned About LILA BLACK

---

## Insight 1: The Map Has a Dead Zone — and Players Vote With Their Feet

**What caught my eye:**  
When I toggled the Traffic heatmap on GrandRift, roughly 30–40% of the map canvas was near-black — almost no movement events, across all matches and all days. Meanwhile, 2–3 zones lit up intensely orange-red. Players weren't spreading out to explore — they were funneling into the same corridors every single match.

**The concrete pattern:**  
Movement events cluster tightly in what appear to be 2–3 high-density corridors on GrandRift. The low-traffic zones have virtually zero Position events across the entire 5-day dataset, meaning it's not random — players are systematically avoiding those areas.

**What this tells a Level Designer:**  
Dead zones fall into two categories: (a) the area is genuinely uninteresting — no loot, no cover, no sightlines worth holding — or (b) the zone is too exposed to traverse safely, so players route around it. Either way, these zones represent wasted map real estate. The designer should ask: is this intentional breathing room, or a layout failure?

**Actionable items:**  
- Add a mid-tier loot crate cluster to one dead zone and measure if traffic shifts in the next patch  
- Metrics affected: average player path length (should increase), match duration, loot collection rate  
- If traffic doesn't shift after loot is added, the issue is geometry/sightlines, not incentives

---

## Insight 2: Storm Deaths Are Concentrated on One Edge — Players Are Getting Caught Off-Guard

**What caught my eye:**  
The Storm Deaths heatmap (purple) shows a non-uniform distribution. Storm kills cluster along one edge/quadrant rather than being spread evenly around the shrinking circle's perimeter, which is what you'd expect if players were dying from the storm at roughly equal rates from all directions.

**The concrete pattern:**  
KilledByStorm events are overrepresented in a specific region relative to the overall player distribution. If players were simply failing to outrun a symmetric shrinking zone, you'd expect storm deaths to ring the final circle evenly. Instead, one edge is lethal disproportionately.

**What this tells a Level Designer:**  
The storm is probably shrinking faster from this direction, OR the terrain on that side (rivers, cliffs, buildings) is blocking escape routes. Players are getting caught because they can't physically exit that quadrant in time. This creates unfair deaths — not "I made a bad decision" deaths, but "the map punished me for being on the wrong side" deaths.

**Actionable items:**  
- Audit the terrain pathways on the high-storm-death edge for exit route chokepoints  
- Consider adding 1–2 escape corridors (gaps, traversal elements) on that edge  
- Metrics affected: storm death rate per quadrant (target: ≤ 15% variance across quadrants), player satisfaction scores for "fairness" if surveyed

---

## Insight 3: Bots and Humans Use Completely Different Areas — Which Means Bot AI Is Exposing Map Weaknesses

**What caught my eye:**  
When I toggled Humans-only vs Bots-only, the path overlays looked almost like two different maps. Human paths concentrate in specific corridors. Bot paths spread more uniformly — including the dead zones that humans never visit.

**The concrete pattern:**  
BotPosition events appear in low-traffic zones that have zero human Position events. This means bots are navigating to areas that human players have effectively ruled out as tactically worthless. Bot kills (BotKill events) also appear in these peripheral zones — bots are fighting each other where no humans tread.

**What this tells a Level Designer:**  
This is a two-sided insight. First: the bot AI navigation mesh isn't tuned to match human risk/reward intuition — bots are being "honest" about the map geometry, but humans are playing the metagame. Second: zones with only bot activity are effectively invisible to the human player experience, which wastes design work.

**Actionable items:**  
- Use the human traffic heatmap as the "real" map — that's what players actually experience; design around it  
- Audit bot spawn points and waypoints: if bots consistently end up in areas humans never go, adjust bot AI to weight toward contested zones  
- Metrics affected: human-bot encounter rate (currently low in peripheral zones), bot elimination contribution to match pacing, perceived bot difficulty

---

*All three insights were identifiable within minutes of having the visualization tool running — a clear demonstration of why raw telemetry tables can't replace spatial visualization for game design work.*
