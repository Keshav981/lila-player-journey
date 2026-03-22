import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────
const EVENT_COLORS = {
  Position:    '#22d3ee',
  BotPosition: '#6366f1',
  Kill:        '#f59e0b',
  BotKill:     '#f59e0b',
  KHKill:      '#f59e0b',
  xHKill:      '#f59e0b',
  KilledByStorm: '#8b5cf6',
  BotKilled:   '#ef4444',
  Loot:        '#10b981',
  LootN:       '#10b981',
};

const EVENT_LABELS = {
  Position: 'Movement',
  BotPosition: 'Bot Movement',
  Kill: 'Kill',
  BotKill: 'Bot Kill',
  KHKill: 'Kill',
  xHKill: 'Kill',
  KilledByStorm: 'Storm Death',
  BotKilled: 'Death',
  Loot: 'Loot',
  LootN: 'Loot',
};

const MAPS = ['GrandRift', 'AmbroseValley', 'Lockdown'];

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  app: {
    display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw',
    background: '#050708', color: '#c8d8e8', fontFamily: "'Rajdhani', sans-serif",
    overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 24px', height: 52, borderBottom: '1px solid #1a2535',
    background: 'linear-gradient(90deg, #060b14 0%, #070d18 100%)',
    flexShrink: 0,
  },
  logo: {
    fontFamily: "'Orbitron', monospace", fontSize: 16, fontWeight: 900,
    letterSpacing: 4, color: '#00c8ff',
    textShadow: '0 0 20px rgba(0,200,255,0.5)',
  },
  headerMeta: {
    fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
    color: '#4a6080', letterSpacing: 1,
  },
  body: {
    display: 'flex', flex: 1, overflow: 'hidden',
  },
  sidebar: {
    width: 260, flexShrink: 0, borderRight: '1px solid #1a2535',
    background: '#060b14', overflowY: 'auto', padding: '16px 0',
    display: 'flex', flexDirection: 'column', gap: 0,
  },
  sideSection: {
    padding: '12px 16px', borderBottom: '1px solid #0f1e30',
  },
  sideLabel: {
    fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: 2,
    color: '#2a4a6a', textTransform: 'uppercase', marginBottom: 10,
  },
  mapBtn: (active) => ({
    display: 'block', width: '100%', textAlign: 'left',
    padding: '8px 12px', marginBottom: 4,
    background: active ? 'rgba(0,200,255,0.12)' : 'transparent',
    border: `1px solid ${active ? 'rgba(0,200,255,0.4)' : 'transparent'}`,
    borderRadius: 4, color: active ? '#00c8ff' : '#6888a8',
    fontFamily: "'Rajdhani', sans-serif", fontSize: 14, fontWeight: active ? 600 : 400,
    cursor: 'pointer', letterSpacing: 1, transition: 'all 0.15s',
  }),
  filterRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
  },
  filterLabel: {
    fontSize: 13, color: '#8898b8', letterSpacing: 0.5,
    display: 'flex', alignItems: 'center', gap: 6,
  },
  dot: (color) => ({
    width: 8, height: 8, borderRadius: '50%', background: color,
    boxShadow: `0 0 6px ${color}`,
  }),
  toggle: (on) => ({
    width: 32, height: 16, borderRadius: 8, cursor: 'pointer', border: 'none',
    background: on ? 'rgba(0,200,255,0.6)' : '#1a2535', transition: 'all 0.2s',
    position: 'relative', flexShrink: 0,
  }),
  select: {
    width: '100%', padding: '6px 10px', marginBottom: 6,
    background: '#0a1525', border: '1px solid #1a2535', borderRadius: 4,
    color: '#8898b8', fontFamily: "'Rajdhani', sans-serif", fontSize: 13,
    letterSpacing: 0.5, cursor: 'pointer', outline: 'none',
  },
  canvas: {
    flex: 1, position: 'relative', background: '#050910', overflow: 'hidden',
  },
  bottomBar: {
    height: 48, borderTop: '1px solid #1a2535',
    background: '#060b14', display: 'flex', alignItems: 'center',
    padding: '0 16px', gap: 12, flexShrink: 0,
  },
  playBtn: {
    padding: '4px 16px', background: 'rgba(0,200,255,0.15)',
    border: '1px solid rgba(0,200,255,0.4)', borderRadius: 3,
    color: '#00c8ff', fontFamily: "'Rajdhani', sans-serif", fontWeight: 600,
    fontSize: 13, letterSpacing: 2, cursor: 'pointer',
  },
  slider: {
    flex: 1, height: 4, cursor: 'pointer', accentColor: '#00c8ff',
  },
  timeLabel: {
    fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#2a5070',
    minWidth: 60, textAlign: 'right',
  },
  heatBtn: (active) => ({
    padding: '4px 12px', background: active ? 'rgba(139,92,246,0.2)' : 'transparent',
    border: `1px solid ${active ? 'rgba(139,92,246,0.5)' : '#1a2535'}`,
    borderRadius: 3, color: active ? '#a78bfa' : '#4a6080',
    fontFamily: "'Rajdhani', sans-serif", fontWeight: 600,
    fontSize: 11, letterSpacing: 1, cursor: 'pointer',
  }),
  loading: {
    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 16,
    background: '#050910',
  },
  loadTitle: {
    fontFamily: "'Orbitron', monospace", fontSize: 18, fontWeight: 700,
    color: '#00c8ff', letterSpacing: 4,
  },
  loadSub: {
    fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#2a5070',
    letterSpacing: 1,
  },
  spinner: {
    width: 40, height: 40, border: '2px solid #0a1a2a',
    borderTop: '2px solid #00c8ff', borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  noData: {
    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  tooltip: {
    position: 'fixed', background: 'rgba(6,11,20,0.95)',
    border: '1px solid #1a3050', borderRadius: 6, padding: '10px 14px',
    pointerEvents: 'none', zIndex: 100, minWidth: 180,
    fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
    boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
  },
  statBox: {
    padding: '12px 16px', borderBottom: '1px solid #0f1e30',
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
  },
  stat: {
    display: 'flex', flexDirection: 'column', gap: 2,
  },
  statNum: {
    fontFamily: "'Orbitron', monospace", fontSize: 16, fontWeight: 700,
    color: '#00c8ff',
  },
  statLbl: {
    fontSize: 10, color: '#2a4a6a', letterSpacing: 1, textTransform: 'uppercase',
    fontFamily: "'JetBrains Mono', monospace",
  },
};

// ─── Heatmap renderer ─────────────────────────────────────────────────────────
function drawHeatmap(ctx, points, w, h, mode) {
  if (!points.length) return;
  const offscreen = document.createElement('canvas');
  offscreen.width = w; offscreen.height = h;
  const oc = offscreen.getContext('2d');

  const radius = 28;
  points.forEach(({ x, y }) => {
    const grd = oc.createRadialGradient(x, y, 0, x, y, radius);
    grd.addColorStop(0, 'rgba(255,255,255,0.18)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    oc.fillStyle = grd;
    oc.beginPath();
    oc.arc(x, y, radius, 0, Math.PI * 2);
    oc.fill();
  });

  // Colorize
  const imgData = oc.getImageData(0, 0, w, h);
  const d = imgData.data;
  const palette = {
    kills:  (t) => [255, 80 + t * 80, 0, t * 220],
    deaths: (t) => [180, 0, 255, t * 220],
    loot:   (t) => [0, 200 + t * 55, 100, t * 200],
    storm:  (t) => [100, 0, 255, t * 220],
  };
  const colorFn = palette[mode] || palette.kills;
  for (let i = 0; i < d.length; i += 4) {
    const alpha = d[i] / 255;
    if (alpha > 0) {
      const [r, g, b, a] = colorFn(alpha);
      d[i] = r; d[i+1] = g; d[i+2] = b; d[i+3] = a;
    }
  }
  oc.putImageData(imgData, 0, 0);
  ctx.drawImage(offscreen, 0, 0);
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const [allEvents, setAllEvents] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [selectedMap, setSelectedMap] = useState('GrandRift');
  const [selectedDate, setSelectedDate] = useState('all');
  const [selectedMatch, setSelectedMatch] = useState('all');
  const [showHumans, setShowHumans] = useState(true);
  const [showBots, setShowBots] = useState(true);
  const [activeEvents, setActiveEvents] = useState({
    Position: true, BotPosition: true,
    Kill: true, KHKill: true, xHKill: true, BotKill: true,
    KilledByStorm: true, BotKilled: true,
    Loot: true, LootN: true,
  });
  const [heatmapMode, setHeatmapMode] = useState(null); // null | 'kills' | 'deaths' | 'loot' | 'storm' | 'traffic'

  // Playback
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0); // 0–1000
  const playheadRef = useRef(0);
  const playingRef = useRef(false);

  // Tooltip
  const [tooltip, setTooltip] = useState(null);

  // Coordinate mapping state
  const [coordBounds, setCoordBounds] = useState(null);

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/data.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status} — did you run convert_data.py?`);
        return r.json();
      })
      .then(({ meta, events }) => {
        setMeta(meta);
        setAllEvents(events);
        setLoading(false);
        if (meta?.dates?.length) setSelectedDate('all');
        if (meta?.maps?.length) setSelectedMap(meta.maps[0] || 'GrandRift');
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
        // Load demo data so the UI still renders
        loadDemoData();
      });
  }, []);

  const loadDemoData = () => {
    // Generate synthetic demo events so the tool is usable without data.json
    const maps = ['GrandRift', 'AmbroseValley', 'Lockdown'];
    const eventTypes = ['Position','Kill','KilledByStorm','Loot','BotPosition','BotKilled'];
    const events = [];
    for (let m = 0; m < 3; m++) {
      const mapName = maps[m];
      for (let p = 0; p < 12; p++) {
        const isBot = p > 7;
        const uid = isBot ? `bot-uuid-${p}` : `${1379 + p}`;
        const matchId = `match-demo-${m}`;
        let x = (Math.random() * 180000) - 90000;
        let y = (Math.random() * 180000) - 90000;
        for (let t = 0; t < 60; t++) {
          x += (Math.random() - 0.5) * 5000;
          y += (Math.random() - 0.5) * 5000;
          const evType = t % 15 === 0 ? 'Kill' : t % 20 === 0 ? 'KilledByStorm' : t % 12 === 0 ? 'Loot' : isBot ? 'BotPosition' : 'Position';
          events.push({
            user_id: uid, match_id: matchId, map_name: mapName,
            map_id: `map-id-${m}`, event: evType,
            is_bot: isBot, date: 'February 14',
            x, y, z: 0, timestamp: `2025-02-14T${String(10+Math.floor(t/6)).padStart(2,'0')}:${String((t*10)%60).padStart(2,'0')}:00Z`,
          });
        }
      }
    }
    const meta = {
      maps, dates: ['February 14'],
      match_ids: ['match-demo-0','match-demo-1','match-demo-2'],
      event_types: eventTypes, total_events: events.length, total_files: 0,
    };
    setMeta(meta);
    setAllEvents(events);
    setLoading(false);
    setSelectedMap('GrandRift');
  };

  // ── Filter events ──────────────────────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    return allEvents.filter(e => {
      if (e.map_name !== selectedMap) return false;
      if (selectedDate !== 'all' && e.date !== selectedDate) return false;
      if (selectedMatch !== 'all' && e.match_id !== selectedMatch) return false;
      if (!showHumans && !e.is_bot) return false;
      if (!showBots && e.is_bot) return false;
      if (!activeEvents[e.event]) return false;
      if (e.x == null || e.y == null) return false;
      return true;
    });
  }, [allEvents, selectedMap, selectedDate, selectedMatch, showHumans, showBots, activeEvents]);

  // ── Compute coordinate bounds ──────────────────────────────────────────────
  useEffect(() => {
    if (!filteredEvents.length) { setCoordBounds(null); return; }
    const xs = filteredEvents.map(e => e.x);
    const ys = filteredEvents.map(e => e.y);
    const pad = 0.05;
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);
    const xRange = xMax - xMin || 1, yRange = yMax - yMin || 1;
    setCoordBounds({
      xMin: xMin - xRange * pad, xMax: xMax + xRange * pad,
      yMin: yMin - yRange * pad, yMax: yMax + yRange * pad,
    });
  }, [filteredEvents]);

  // ── Player paths (grouped) ─────────────────────────────────────────────────
  const playerPaths = useMemo(() => {
    const paths = {};
    filteredEvents.forEach(e => {
      if (!paths[e.user_id]) paths[e.user_id] = { events: [], is_bot: e.is_bot };
      paths[e.user_id].events.push(e);
    });
    return paths;
  }, [filteredEvents]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const kills = filteredEvents.filter(e => ['Kill','KHKill','xHKill','BotKill'].includes(e.event)).length;
    const deaths = filteredEvents.filter(e => ['BotKilled','KilledByStorm'].includes(e.event)).length;
    const loots = filteredEvents.filter(e => ['Loot','LootN'].includes(e.event)).length;
    const stormDeaths = filteredEvents.filter(e => e.event === 'KilledByStorm').length;
    const humans = new Set(filteredEvents.filter(e => !e.is_bot).map(e => e.user_id)).size;
    const bots = new Set(filteredEvents.filter(e => e.is_bot).map(e => e.user_id)).size;
    return { kills, deaths, loots, stormDeaths, humans, bots };
  }, [filteredEvents]);

  // ── Matches for selected map+date ─────────────────────────────────────────
  const availableMatches = useMemo(() => {
    const ids = [...new Set(
      allEvents.filter(e => e.map_name === selectedMap && (selectedDate === 'all' || e.date === selectedDate))
        .map(e => e.match_id)
    )];
    return ids;
  }, [allEvents, selectedMap, selectedDate]);

  // ── Coordinate → canvas mapping ────────────────────────────────────────────
  const toCanvas = useCallback((worldX, worldY, canvasW, canvasH) => {
    if (!coordBounds) return { x: canvasW / 2, y: canvasH / 2 };
    const { xMin, xMax, yMin, yMax } = coordBounds;
    const margin = 40;
    const cx = margin + ((worldX - xMin) / (xMax - xMin)) * (canvasW - margin * 2);
    const cy = margin + ((worldY - yMin) / (yMax - yMin)) * (canvasH - margin * 2);
    return { x: cx, y: cy };
  }, [coordBounds]);

  // ── Playback loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    if (!playing) return;
    let last = null;
    const tick = (ts) => {
      if (!playingRef.current) return;
      if (last !== null) {
        const dt = ts - last;
        playheadRef.current = Math.min(1000, playheadRef.current + dt * 0.08);
        setPlayhead(Math.round(playheadRef.current));
        if (playheadRef.current >= 1000) {
          setPlaying(false);
          playheadRef.current = 0;
          setPlayhead(0);
          return;
        }
      }
      last = ts;
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [playing]);

  // ── Canvas draw ────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !coordBounds) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = '#0c1a2a';
    ctx.lineWidth = 1;
    const gridStep = 80;
    for (let x = gridStep; x < W; x += gridStep) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = gridStep; y < H; y += gridStep) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Map label
    ctx.fillStyle = 'rgba(0,200,255,0.06)';
    ctx.font = "bold 72px 'Orbitron', monospace";
    ctx.textAlign = 'center';
    ctx.fillText(selectedMap.toUpperCase(), W / 2, H / 2 + 24);

    // Determine playback cutoff (0–1 normalized)
    const cutoff = playhead / 1000;

    // Heatmap mode
    if (heatmapMode) {
      const heatEvents = {
        kills:   filteredEvents.filter(e => ['Kill','KHKill','xHKill','BotKill'].includes(e.event)),
        deaths:  filteredEvents.filter(e => ['BotKilled'].includes(e.event)),
        loot:    filteredEvents.filter(e => ['Loot','LootN'].includes(e.event)),
        storm:   filteredEvents.filter(e => e.event === 'KilledByStorm'),
        traffic: filteredEvents.filter(e => ['Position','BotPosition'].includes(e.event)),
      }[heatmapMode] || [];

      const pts = heatEvents.map(e => toCanvas(e.x, e.y, W, H));
      drawHeatmap(ctx, pts, W, H, heatmapMode === 'traffic' ? 'kills' : heatmapMode);
      return;
    }

    // Player paths
    const allPlayers = Object.entries(playerPaths);
    const totalEvents = filteredEvents.length;
    const cutoffIdx = Math.floor(totalEvents * cutoff);
    let countSoFar = 0;

    allPlayers.forEach(([uid, { events, is_bot }]) => {
      const color = is_bot ? '#6366f1' : '#22d3ee';
      const posEvents = events.filter(e => ['Position','BotPosition'].includes(e.event));

      if (posEvents.length > 1) {
        // Draw path
        ctx.beginPath();
        ctx.strokeStyle = is_bot ? 'rgba(99,102,241,0.25)' : 'rgba(34,211,238,0.2)';
        ctx.lineWidth = 1;
        posEvents.forEach((e, i) => {
          if (countSoFar > cutoffIdx) return;
          const { x, y } = toCanvas(e.x, e.y, W, H);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          countSoFar++;
        });
        ctx.stroke();
      }

      // Draw events as dots
      events.forEach(e => {
        if (countSoFar > cutoffIdx) return;
        const { x, y } = toCanvas(e.x, e.y, W, H);
        const evColor = EVENT_COLORS[e.event] || color;
        const isMovement = ['Position','BotPosition'].includes(e.event);
        const r = isMovement ? 2.5 : 5;

        if (!isMovement) {
          // Glow ring
          ctx.beginPath();
          ctx.arc(x, y, r + 4, 0, Math.PI * 2);
          ctx.fillStyle = evColor.replace(')', ',0.15)').replace('rgb(', 'rgba(').replace('#', 'rgba(').replace(')', ',0.15)');
          // Simple glow
          const grd = ctx.createRadialGradient(x, y, 0, x, y, r + 6);
          grd.addColorStop(0, evColor + 'aa');
          grd.addColorStop(1, 'transparent');
          ctx.fillStyle = grd;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = evColor;
        ctx.fill();
        countSoFar++;
      });
    });
  }, [filteredEvents, playerPaths, coordBounds, playhead, heatmapMode, toCanvas, selectedMap]);

  // ── Canvas resize observer ─────────────────────────────────────────────────
  const containerRef = useRef(null);
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (canvasRef.current) {
          canvasRef.current.width = width;
          canvasRef.current.height = height;
        }
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Canvas mouse hover for tooltip ─────────────────────────────────────────
  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas || !coordBounds) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Find closest event within 15px
    let closest = null, minDist = 15;
    filteredEvents.forEach(ev => {
      if (ev.x == null) return;
      const { x, y } = toCanvas(ev.x, ev.y, canvas.width, canvas.height);
      const dist = Math.hypot(mx - x, my - y);
      if (dist < minDist) { minDist = dist; closest = ev; }
    });

    if (closest) {
      setTooltip({
        x: e.clientX + 14,
        y: e.clientY - 10,
        event: closest,
      });
    } else {
      setTooltip(null);
    }
  }, [filteredEvents, coordBounds, toCanvas]);

  // ── Event type toggles ─────────────────────────────────────────────────────
  const EVENT_GROUPS = [
    { key: 'movement', label: 'Movement', events: ['Position','BotPosition'], color: '#22d3ee' },
    { key: 'kills',    label: 'Kills',    events: ['Kill','KHKill','xHKill','BotKill'], color: '#f59e0b' },
    { key: 'deaths',   label: 'Deaths',   events: ['BotKilled'], color: '#ef4444' },
    { key: 'storm',    label: 'Storm Deaths', events: ['KilledByStorm'], color: '#8b5cf6' },
    { key: 'loot',     label: 'Loot',     events: ['Loot','LootN'], color: '#10b981' },
  ];

  const toggleEventGroup = (evts) => {
    const allOn = evts.every(k => activeEvents[k]);
    setActiveEvents(prev => {
      const next = { ...prev };
      evts.forEach(k => { next[k] = !allOn; });
      return next;
    });
  };

  const isGroupOn = (evts) => evts.some(k => activeEvents[k]);

  // ── Dates ──────────────────────────────────────────────────────────────────
  const dates = meta?.dates || [];

  return (
    <div style={S.app}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #060b14; }
        ::-webkit-scrollbar-thumb { background: #1a2535; border-radius: 2px; }
        button:hover { opacity: 0.85; }
        input[type=range] { -webkit-appearance: none; appearance: none; background: #1a2535; border-radius: 2px; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; background: #00c8ff; cursor: pointer; }
      `}</style>

      {/* ── Header ── */}
      <div style={S.header}>
        <div style={S.logo}>LILA BLACK<span style={{color:'#2a5070', fontWeight:300}}> / TELEMETRY</span></div>
        <div style={S.headerMeta}>
          {meta ? `${meta.total_events?.toLocaleString() ?? 0} EVENTS  ·  ${meta.total_files ?? 0} FILES` : 'LOADING...'}
        </div>
        <div style={S.headerMeta}>{error ? '⚠ DEMO MODE' : 'LIVE DATA'}</div>
      </div>

      <div style={S.body}>
        {/* ── Sidebar ── */}
        <div style={S.sidebar}>

          {/* Stats */}
          <div style={S.statBox}>
            <div style={S.stat}>
              <span style={S.statNum}>{stats.kills}</span>
              <span style={S.statLbl}>Kills</span>
            </div>
            <div style={S.stat}>
              <span style={S.statNum}>{stats.deaths}</span>
              <span style={S.statLbl}>Deaths</span>
            </div>
            <div style={S.stat}>
              <span style={S.statNum}>{stats.loots}</span>
              <span style={S.statLbl}>Loots</span>
            </div>
            <div style={S.stat}>
              <span style={{ ...S.statNum, color: '#8b5cf6' }}>{stats.stormDeaths}</span>
              <span style={S.statLbl}>Storm</span>
            </div>
            <div style={S.stat}>
              <span style={{ ...S.statNum, color: '#22d3ee', fontSize: 14 }}>{stats.humans}</span>
              <span style={S.statLbl}>Humans</span>
            </div>
            <div style={S.stat}>
              <span style={{ ...S.statNum, color: '#6366f1', fontSize: 14 }}>{stats.bots}</span>
              <span style={S.statLbl}>Bots</span>
            </div>
          </div>

          {/* Map selector */}
          <div style={S.sideSection}>
            <div style={S.sideLabel}>Map</div>
            {MAPS.map(m => (
              <button key={m} style={S.mapBtn(selectedMap === m)}
                onClick={() => { setSelectedMap(m); setSelectedMatch('all'); }}>
                {m}
              </button>
            ))}
          </div>

          {/* Date filter */}
          <div style={S.sideSection}>
            <div style={S.sideLabel}>Date</div>
            <select style={S.select} value={selectedDate}
              onChange={e => { setSelectedDate(e.target.value); setSelectedMatch('all'); }}>
              <option value="all">All Dates</option>
              {dates.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Match filter */}
          <div style={S.sideSection}>
            <div style={S.sideLabel}>Match</div>
            <select style={S.select} value={selectedMatch}
              onChange={e => setSelectedMatch(e.target.value)}>
              <option value="all">All Matches ({availableMatches.length})</option>
              {availableMatches.map((id, i) => (
                <option key={id} value={id}>Match {i + 1} — {id.slice(0, 8)}…</option>
              ))}
            </select>
          </div>

          {/* Player type */}
          <div style={S.sideSection}>
            <div style={S.sideLabel}>Players</div>
            <div style={S.filterRow}>
              <div style={S.filterLabel}>
                <span style={S.dot('#22d3ee')} />
                Humans
              </div>
              <button style={S.toggle(showHumans)} onClick={() => setShowHumans(v => !v)}>
                <span style={{
                  position:'absolute', top:2, left: showHumans ? 18 : 2,
                  width:12, height:12, borderRadius:'50%', background:'#fff', transition:'left 0.2s',
                }} />
              </button>
            </div>
            <div style={S.filterRow}>
              <div style={S.filterLabel}>
                <span style={S.dot('#6366f1')} />
                Bots
              </div>
              <button style={S.toggle(showBots)} onClick={() => setShowBots(v => !v)}>
                <span style={{
                  position:'absolute', top:2, left: showBots ? 18 : 2,
                  width:12, height:12, borderRadius:'50%', background:'#fff', transition:'left 0.2s',
                }} />
              </button>
            </div>
          </div>

          {/* Event types */}
          <div style={S.sideSection}>
            <div style={S.sideLabel}>Event Types</div>
            {EVENT_GROUPS.map(g => (
              <div key={g.key} style={S.filterRow}>
                <div style={S.filterLabel}>
                  <span style={S.dot(g.color)} />
                  {g.label}
                </div>
                <button style={S.toggle(isGroupOn(g.events))} onClick={() => toggleEventGroup(g.events)}>
                  <span style={{
                    position:'absolute', top:2, left: isGroupOn(g.events) ? 18 : 2,
                    width:12, height:12, borderRadius:'50%', background:'#fff', transition:'left 0.2s',
                  }} />
                </button>
              </div>
            ))}
          </div>

          {/* Heatmap */}
          <div style={S.sideSection}>
            <div style={S.sideLabel}>Heatmap Overlay</div>
            {[
              { key: null, label: 'None' },
              { key: 'kills', label: '🔴 Kill Zones' },
              { key: 'deaths', label: '🟣 Death Zones' },
              { key: 'loot', label: '🟢 Loot Density' },
              { key: 'storm', label: '💀 Storm Deaths' },
              { key: 'traffic', label: '🔵 Traffic' },
            ].map(({ key, label }) => (
              <button key={String(key)} style={{
                ...S.mapBtn(heatmapMode === key),
                fontSize: 12, padding: '6px 10px',
              }} onClick={() => setHeatmapMode(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Canvas area ── */}
        <div style={S.canvas} ref={containerRef}>
          {loading && (
            <div style={S.loading}>
              <div style={S.spinner} />
              <div style={S.loadTitle}>LILA BLACK</div>
              <div style={S.loadSub}>LOADING TELEMETRY DATA...</div>
            </div>
          )}

          {!loading && !filteredEvents.length && (
            <div style={S.noData}>
              <div style={{ fontFamily:"'Orbitron',monospace", fontSize:14, color:'#2a4a6a' }}>
                NO DATA FOR SELECTED FILTERS
              </div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:'#1a3050' }}>
                {error ? `⚠ ${error}` : 'Try adjusting your filters'}
              </div>
            </div>
          )}

          <canvas
            ref={canvasRef}
            style={{ display: 'block', width: '100%', height: '100%', cursor: 'crosshair' }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setTooltip(null)}
          />

          {/* Legend overlay */}
          <div style={{
            position:'absolute', top:12, right:12,
            background:'rgba(6,11,20,0.85)', border:'1px solid #1a2535',
            borderRadius:6, padding:'10px 14px', backdropFilter:'blur(4px)',
          }}>
            <div style={{ ...S.sideLabel, marginBottom:8 }}>Legend</div>
            {EVENT_GROUPS.map(g => (
              <div key={g.key} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                <span style={S.dot(g.color)} />
                <span style={{ fontSize:11, color:'#6888a8', fontFamily:"'JetBrains Mono',monospace" }}>
                  {g.label}
                </span>
              </div>
            ))}
            <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid #0f1e30' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                <span style={{ width:8, height:2, background:'#22d3ee', display:'inline-block', opacity:0.6 }} />
                <span style={{ fontSize:11, color:'#6888a8', fontFamily:"'JetBrains Mono',monospace" }}>Human path</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ width:8, height:2, background:'#6366f1', display:'inline-block', opacity:0.6 }} />
                <span style={{ fontSize:11, color:'#6888a8', fontFamily:"'JetBrains Mono',monospace" }}>Bot path</span>
              </div>
            </div>
          </div>

          {/* Map name overlay */}
          <div style={{
            position:'absolute', top:12, left:12,
            fontFamily:"'Orbitron',monospace", fontSize:11, fontWeight:700,
            color:'rgba(0,200,255,0.5)', letterSpacing:3,
          }}>
            {selectedMap.toUpperCase()}
          </div>
        </div>
      </div>

      {/* ── Bottom playback bar ── */}
      <div style={S.bottomBar}>
        <button style={S.playBtn}
          onClick={() => {
            if (playhead >= 1000) { playheadRef.current = 0; setPlayhead(0); }
            setPlaying(v => !v);
          }}>
          {playing ? '⏸ PAUSE' : playhead >= 1000 ? '↺ REPLAY' : '▶ PLAY'}
        </button>

        <input type="range" min={0} max={1000} value={playhead} style={S.slider}
          onChange={e => {
            const v = Number(e.target.value);
            playheadRef.current = v;
            setPlayhead(v);
            setPlaying(false);
          }} />

        <span style={S.timeLabel}>{Math.round(playhead / 10)}%</span>

        <span style={{ ...S.headerMeta, paddingLeft:12, borderLeft:'1px solid #1a2535' }}>
          {filteredEvents.length.toLocaleString()} events visible
        </span>
      </div>

      {/* ── Tooltip ── */}
      {tooltip && (
        <div style={{ ...S.tooltip, left: tooltip.x, top: tooltip.y }}>
          <div style={{ color: EVENT_COLORS[tooltip.event.event] || '#00c8ff', marginBottom:6, fontWeight:600 }}>
            {EVENT_LABELS[tooltip.event.event] || tooltip.event.event}
          </div>
          <div style={{ color:'#4a7090', marginBottom:3 }}>
            Player: <span style={{ color:'#8ab0d0' }}>
              {tooltip.event.is_bot ? '🤖 ' : '👤 '}{tooltip.event.user_id.slice(0,12)}
            </span>
          </div>
          <div style={{ color:'#4a7090', marginBottom:3 }}>
            X: <span style={{ color:'#8ab0d0' }}>{tooltip.event.x?.toFixed(0)}</span>
            {'  '}Y: <span style={{ color:'#8ab0d0' }}>{tooltip.event.y?.toFixed(0)}</span>
          </div>
          {tooltip.event.timestamp && (
            <div style={{ color:'#4a7090' }}>
              {String(tooltip.event.timestamp).slice(11,19)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
