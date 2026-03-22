import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ─── Map config (from README) ─────────────────────────────────────────────────
const MAP_CONFIG = {
  GrandRift:     { image: '/GrandRift_Minimap.png',     scale: 581,  origin_x: -290, origin_z: -290 },
  AmbroseValley: { image: '/AmbroseValley_Minimap.png', scale: 900,  origin_x: -370, origin_z: -473 },
  Lockdown:      { image: '/Lockdown_Minimap.jpg',      scale: 1000, origin_x: -500, origin_z: -500 },
};

const EVENT_COLORS = {
  Position:      '#22d3ee',
  BotPosition:   '#6366f1',
  Kill:          '#f59e0b',
  Killed:        '#ef4444',
  BotKill:       '#f97316',
  BotKilled:     '#ef4444',
  KilledByStorm: '#8b5cf6',
  Loot:          '#10b981',
};

const EVENT_GROUPS = [
  { key: 'movement', label: 'Movement',    events: ['Position','BotPosition'],   color: '#22d3ee' },
  { key: 'kills',    label: 'Kills',       events: ['Kill','BotKill'],           color: '#f59e0b' },
  { key: 'deaths',   label: 'Deaths',      events: ['Killed','BotKilled'],       color: '#ef4444' },
  { key: 'storm',    label: 'Storm Deaths',events: ['KilledByStorm'],            color: '#8b5cf6' },
  { key: 'loot',     label: 'Loot',        events: ['Loot'],                     color: '#10b981' },
];

const MAPS = ['GrandRift', 'AmbroseValley', 'Lockdown'];
const MINIMAP_SIZE = 1024;

// ─── World → canvas pixel ─────────────────────────────────────────────────────
function worldToCanvas(wx, wz, mapName, canvasW, canvasH) {
  const cfg = MAP_CONFIG[mapName];
  if (!cfg || wx == null || wz == null) return null;
  const u = (wx - cfg.origin_x) / cfg.scale;
  const v = (wz - cfg.origin_z) / cfg.scale;
  const px = u * MINIMAP_SIZE;          // 0-1024 pixel space
  const py = (1 - v) * MINIMAP_SIZE;   // Y flipped
  // Scale from 1024px to canvas size
  return {
    x: (px / MINIMAP_SIZE) * canvasW,
    y: (py / MINIMAP_SIZE) * canvasH,
  };
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────
function drawHeatmap(ctx, points, w, h, colorFn) {
  if (!points.length) return;
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const oc = off.getContext('2d');
  const r = Math.max(20, Math.min(w, h) / 30);
  points.forEach(({ x, y }) => {
    const g = oc.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.22)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    oc.fillStyle = g;
    oc.beginPath(); oc.arc(x, y, r, 0, Math.PI*2); oc.fill();
  });
  const img = oc.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const t = d[i] / 255;
    if (t > 0) {
      const [rr,gg,bb,aa] = colorFn(t);
      d[i]=rr; d[i+1]=gg; d[i+2]=bb; d[i+3]=aa;
    }
  }
  oc.putImageData(img, 0, 0);
  ctx.drawImage(off, 0, 0);
}

const HEATMAP_COLORS = {
  kills:   t => [255, Math.floor(80+t*80), 0,   Math.floor(t*230)],
  deaths:  t => [180, 0,                   255, Math.floor(t*220)],
  loot:    t => [0,   Math.floor(180+t*75),80,  Math.floor(t*200)],
  storm:   t => [120, 0,                   255, Math.floor(t*220)],
  traffic: t => [0,   Math.floor(100+t*155),255,Math.floor(t*180)],
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  app:     { display:'flex', flexDirection:'column', height:'100vh', width:'100vw', background:'#050708', color:'#c8d8e8', fontFamily:"'Rajdhani',sans-serif", overflow:'hidden' },
  header:  { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 24px', height:52, borderBottom:'1px solid #1a2535', background:'linear-gradient(90deg,#060b14,#070d18)', flexShrink:0 },
  logo:    { fontFamily:"'Orbitron',monospace", fontSize:16, fontWeight:900, letterSpacing:4, color:'#00c8ff', textShadow:'0 0 20px rgba(0,200,255,0.5)' },
  meta:    { fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:'#4a6080', letterSpacing:1 },
  body:    { display:'flex', flex:1, overflow:'hidden' },
  sidebar: { width:252, flexShrink:0, borderRight:'1px solid #1a2535', background:'#060b14', overflowY:'auto', display:'flex', flexDirection:'column' },
  sec:     { padding:'12px 16px', borderBottom:'1px solid #0f1e30' },
  slbl:    { fontFamily:"'JetBrains Mono',monospace", fontSize:9, letterSpacing:2, color:'#2a4a6a', textTransform:'uppercase', marginBottom:8 },
  mapBtn:  a => ({ display:'block', width:'100%', textAlign:'left', padding:'7px 12px', marginBottom:4, background: a?'rgba(0,200,255,0.12)':'transparent', border:`1px solid ${a?'rgba(0,200,255,0.4)':'transparent'}`, borderRadius:4, color:a?'#00c8ff':'#6888a8', fontFamily:"'Rajdhani',sans-serif", fontSize:14, fontWeight:a?600:400, cursor:'pointer', letterSpacing:1 }),
  row:     { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 },
  flbl:    { fontSize:13, color:'#8898b8', display:'flex', alignItems:'center', gap:6 },
  dot:     c => ({ width:8, height:8, borderRadius:'50%', background:c, boxShadow:`0 0 6px ${c}` }),
  tog:     on => ({ width:32, height:16, borderRadius:8, cursor:'pointer', border:'none', background:on?'rgba(0,200,255,0.6)':'#1a2535', position:'relative', flexShrink:0 }),
  sel:     { width:'100%', padding:'6px 10px', marginBottom:6, background:'#0a1525', border:'1px solid #1a2535', borderRadius:4, color:'#8898b8', fontFamily:"'Rajdhani',sans-serif", fontSize:13, cursor:'pointer', outline:'none' },
  canvas:  { flex:1, position:'relative', overflow:'hidden', background:'#050910' },
  bbar:    { height:48, borderTop:'1px solid #1a2535', background:'#060b14', display:'flex', alignItems:'center', padding:'0 16px', gap:12, flexShrink:0 },
  playBtn: { padding:'4px 16px', background:'rgba(0,200,255,0.15)', border:'1px solid rgba(0,200,255,0.4)', borderRadius:3, color:'#00c8ff', fontFamily:"'Rajdhani',sans-serif", fontWeight:600, fontSize:13, letterSpacing:2, cursor:'pointer' },
  statBox: { padding:'12px 16px', borderBottom:'1px solid #0f1e30', display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 },
  stat:    { display:'flex', flexDirection:'column', gap:2 },
  statN:   c => ({ fontFamily:"'Orbitron',monospace", fontSize:15, fontWeight:700, color:c||'#00c8ff' }),
  statL:   { fontSize:9, color:'#2a4a6a', letterSpacing:1, textTransform:'uppercase', fontFamily:"'JetBrains Mono',monospace" },
  tip:     { position:'fixed', background:'rgba(6,11,20,0.96)', border:'1px solid #1a3050', borderRadius:6, padding:'10px 14px', pointerEvents:'none', zIndex:100, minWidth:180, fontFamily:"'JetBrains Mono',monospace", fontSize:11, boxShadow:'0 4px 24px rgba(0,0,0,0.6)' },
};

export default function App() {
  const canvasRef    = useRef(null);
  const containerRef = useRef(null);
  const animRef      = useRef(null);
  const playheadRef  = useRef(0);
  const playingRef   = useRef(false);
  const mapImgRef    = useRef({});

  const [allEvents,  setAllEvents]  = useState([]);
  const [meta,       setMeta]       = useState(null);
  const [loading,    setLoading]    = useState(true);

  const [selectedMap,   setSelectedMap]   = useState('GrandRift');
  const [selectedDate,  setSelectedDate]  = useState('all');
  const [selectedMatch, setSelectedMatch] = useState('all');
  const [showHumans,    setShowHumans]    = useState(true);
  const [showBots,      setShowBots]      = useState(true);
  const [activeEvents,  setActiveEvents]  = useState({
    Position:true, BotPosition:true, Kill:true, Killed:true,
    BotKill:true, BotKilled:true, KilledByStorm:true, Loot:true,
  });
  const [heatmapMode, setHeatmapMode] = useState(null);
  const [playing,     setPlaying]     = useState(false);
  const [playhead,    setPlayhead]     = useState(0);
  const [tooltip,     setTooltip]     = useState(null);

  // ── Preload minimap images ────────────────────────────────────────────────
  useEffect(() => {
    MAPS.forEach(name => {
      const cfg = MAP_CONFIG[name];
      const img = new Image();
      img.src = cfg.image;
      img.onload = () => { mapImgRef.current[name] = img; };
    });
  }, []);

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/data.json')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(({ meta, events }) => {
        setMeta(meta);
        setAllEvents(events);
        setLoading(false);
        if (meta?.maps?.length) setSelectedMap(meta.maps[0]);
      })
      .catch(() => { loadDemo(); });
  }, []);

  const loadDemo = () => {
    const events = [];
    MAPS.forEach((mapName, mi) => {
      const cfg = MAP_CONFIG[mapName];
      for (let p = 0; p < 15; p++) {
        const isBot = p > 9;
        const uid = isBot ? `${1379+p}` : `uuid-human-${p}`;
        const matchId = `demo-match-${mi}`;
        let wx = cfg.origin_x + Math.random()*cfg.scale;
        let wz = cfg.origin_z + Math.random()*cfg.scale;
        for (let t = 0; t < 50; t++) {
          wx += (Math.random()-0.5)*30; wz += (Math.random()-0.5)*30;
          const ev = t%15===0?'Kill':t%20===0?'KilledByStorm':t%12===0?'Loot':isBot?'BotPosition':'Position';
          const u = (wx-cfg.origin_x)/cfg.scale, v = (wz-cfg.origin_z)/cfg.scale;
          events.push({ user_id:uid, match_id:matchId, map_name:mapName, map_id:mapName,
            event:ev, is_bot:isBot, date:'February 14',
            wx:round2(wx), wz:round2(wz), px:round2(u*1024), py:round2((1-v)*1024), sequence:t });
        }
      }
    });
    const meta = { maps:MAPS, dates:['February 14'], match_ids:['demo-match-0','demo-match-1','demo-match-2'], event_types:Object.keys(EVENT_COLORS), total_events:events.length, total_files:0 };
    setMeta(meta); setAllEvents(events); setLoading(false); setSelectedMap('GrandRift');
  };

  const round2 = v => Math.round(v*100)/100;

  // ── Filtered events ───────────────────────────────────────────────────────
  const filtered = useMemo(() => allEvents.filter(e =>
    e.map_name === selectedMap &&
    (selectedDate  === 'all' || e.date     === selectedDate) &&
    (selectedMatch === 'all' || e.match_id === selectedMatch) &&
    (showHumans || e.is_bot) && (showBots || !e.is_bot) &&
    activeEvents[e.event] && e.px != null
  ), [allEvents, selectedMap, selectedDate, selectedMatch, showHumans, showBots, activeEvents]);

  // ── Player paths ──────────────────────────────────────────────────────────
  const playerPaths = useMemo(() => {
    const m = {};
    filtered.forEach(e => {
      if (!m[e.user_id]) m[e.user_id] = { events:[], is_bot:e.is_bot };
      m[e.user_id].events.push(e);
    });
    return m;
  }, [filtered]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    kills:  filtered.filter(e=>['Kill','BotKill'].includes(e.event)).length,
    deaths: filtered.filter(e=>['Killed','BotKilled'].includes(e.event)).length,
    loots:  filtered.filter(e=>e.event==='Loot').length,
    storm:  filtered.filter(e=>e.event==='KilledByStorm').length,
    humans: new Set(filtered.filter(e=>!e.is_bot).map(e=>e.user_id)).size,
    bots:   new Set(filtered.filter(e=>e.is_bot).map(e=>e.user_id)).size,
  }), [filtered]);

  const availableMatches = useMemo(() =>
    [...new Set(allEvents.filter(e=>e.map_name===selectedMap&&(selectedDate==='all'||e.date===selectedDate)).map(e=>e.match_id))]
  , [allEvents, selectedMap, selectedDate]);

  // ── Playback ──────────────────────────────────────────────────────────────
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => {
    if (!playing) return;
    let last = null;
    const tick = ts => {
      if (!playingRef.current) return;
      if (last !== null) {
        playheadRef.current = Math.min(1000, playheadRef.current + (ts-last)*0.07);
        setPlayhead(Math.round(playheadRef.current));
        if (playheadRef.current >= 1000) { setPlaying(false); return; }
      }
      last = ts;
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [playing]);

  // ── Resize observer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        if (canvasRef.current) {
          canvasRef.current.width  = e.contentRect.width;
          canvasRef.current.height = e.contentRect.height;
        }
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Canvas draw ───────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    if (!W || !H) return;
    ctx.clearRect(0, 0, W, H);

    // Draw minimap image background
    const mapImg = mapImgRef.current[selectedMap];
    if (mapImg) {
      ctx.globalAlpha = 0.75;
      ctx.drawImage(mapImg, 0, 0, W, H);
      ctx.globalAlpha = 1;
    } else {
      // Grid fallback
      ctx.fillStyle = '#050910';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#0c1a2a'; ctx.lineWidth = 1;
      for (let x=80; x<W; x+=80) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
      for (let y=80; y<H; y+=80) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    }

    // Helper: convert px/py (0-1024) to canvas coords
    const toCanvas = (px, py) => ({
      x: (px / MINIMAP_SIZE) * W,
      y: (py / MINIMAP_SIZE) * H,
    });

    const cutoff = (playhead / 1000) * filtered.length;

    // Heatmap overlay
    if (heatmapMode) {
      const evMap = {
        kills:   filtered.filter(e=>['Kill','BotKill'].includes(e.event)),
        deaths:  filtered.filter(e=>['Killed','BotKilled'].includes(e.event)),
        loot:    filtered.filter(e=>e.event==='Loot'),
        storm:   filtered.filter(e=>e.event==='KilledByStorm'),
        traffic: filtered.filter(e=>['Position','BotPosition'].includes(e.event)),
      };
      const pts = (evMap[heatmapMode]||[]).map(e=>toCanvas(e.px,e.py));
      drawHeatmap(ctx, pts, W, H, HEATMAP_COLORS[heatmapMode]||HEATMAP_COLORS.kills);
      return;
    }

    // Draw paths + events
    let count = 0;
    Object.entries(playerPaths).forEach(([uid, { events, is_bot }]) => {
      const color = is_bot ? '#6366f1' : '#22d3ee';
      const posEvs = events.filter(e=>['Position','BotPosition'].includes(e.event));

      // Path line
      if (posEvs.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = is_bot ? 'rgba(99,102,241,0.35)' : 'rgba(34,211,238,0.3)';
        ctx.lineWidth = 1.5;
        let started = false;
        posEvs.forEach(e => {
          if (count > cutoff) return;
          const p = toCanvas(e.px, e.py);
          if (!started) { ctx.moveTo(p.x, p.y); started=true; }
          else ctx.lineTo(p.x, p.y);
          count++;
        });
        ctx.stroke();
      }

      // Event dots
      events.forEach(e => {
        if (count > cutoff) return;
        const p = toCanvas(e.px, e.py);
        const evColor = EVENT_COLORS[e.event] || color;
        const isMove = ['Position','BotPosition'].includes(e.event);
        const r = isMove ? 2 : 5;

        if (!isMove) {
          // Glow
          const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r+8);
          grd.addColorStop(0, evColor+'88'); grd.addColorStop(1,'transparent');
          ctx.fillStyle = grd;
          ctx.beginPath(); ctx.arc(p.x, p.y, r+8, 0, Math.PI*2); ctx.fill();
        }
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2);
        ctx.fillStyle = evColor; ctx.fill();
        count++;
      });
    });
  }, [filtered, playerPaths, playhead, heatmapMode, selectedMap]);

  // ── Tooltip on hover ──────────────────────────────────────────────────────
  const handleMouseMove = useCallback(e => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const W = canvas.width, H = canvas.height;
    let closest = null, minD = 14;
    filtered.forEach(ev => {
      const cx = (ev.px/MINIMAP_SIZE)*W, cy = (ev.py/MINIMAP_SIZE)*H;
      const d = Math.hypot(mx-cx, my-cy);
      if (d < minD) { minD=d; closest=ev; }
    });
    setTooltip(closest ? { x:e.clientX+14, y:e.clientY-10, ev:closest } : null);
  }, [filtered]);

  // ── Event group toggles ───────────────────────────────────────────────────
  const toggleGroup = evts => {
    const allOn = evts.every(k => activeEvents[k]);
    setActiveEvents(p => { const n={...p}; evts.forEach(k=>{n[k]=!allOn;}); return n; });
  };
  const isGroupOn = evts => evts.some(k => activeEvents[k]);

  const Toggle = ({ on, onClick }) => (
    <button style={S.tog(on)} onClick={onClick}>
      <span style={{ position:'absolute', top:2, left:on?18:2, width:12, height:12, borderRadius:'50%', background:'#fff', transition:'left 0.2s' }} />
    </button>
  );

  return (
    <div style={S.app}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:#060b14} ::-webkit-scrollbar-thumb{background:#1a2535;border-radius:2px}
        button:hover{opacity:0.85}
        input[type=range]{-webkit-appearance:none;appearance:none;background:#1a2535;border-radius:2px}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:#00c8ff;cursor:pointer}
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=JetBrains+Mono:wght@300;400&family=Orbitron:wght@700;900&display=swap');
      `}</style>

      {/* Header */}
      <div style={S.header}>
        <div style={S.logo}>LILA BLACK<span style={{color:'#2a5070',fontWeight:300}}> / TELEMETRY</span></div>
        <div style={S.meta}>{meta?`${meta.total_events?.toLocaleString()} EVENTS · ${meta.total_files} FILES`:'LOADING...'}</div>
        <div style={S.meta}>{selectedMap.toUpperCase()}</div>
      </div>

      <div style={S.body}>
        {/* Sidebar */}
        <div style={S.sidebar}>

          {/* Stats */}
          <div style={S.statBox}>
            {[['kills','#f59e0b',stats.kills],['deaths','#ef4444',stats.deaths],['loots','#10b981',stats.loots],['storm','#8b5cf6',stats.storm],['humans','#22d3ee',stats.humans],['bots','#6366f1',stats.bots]].map(([l,c,v])=>(
              <div key={l} style={S.stat}><span style={S.statN(c)}>{v}</span><span style={S.statL}>{l}</span></div>
            ))}
          </div>

          {/* Map */}
          <div style={S.sec}>
            <div style={S.slbl}>Map</div>
            {MAPS.map(m=><button key={m} style={S.mapBtn(selectedMap===m)} onClick={()=>{setSelectedMap(m);setSelectedMatch('all');}}>{m}</button>)}
          </div>

          {/* Date */}
          <div style={S.sec}>
            <div style={S.slbl}>Date</div>
            <select style={S.sel} value={selectedDate} onChange={e=>{setSelectedDate(e.target.value);setSelectedMatch('all');}}>
              <option value="all">All Dates</option>
              {(meta?.dates||[]).map(d=><option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Match */}
          <div style={S.sec}>
            <div style={S.slbl}>Match</div>
            <select style={S.sel} value={selectedMatch} onChange={e=>setSelectedMatch(e.target.value)}>
              <option value="all">All Matches ({availableMatches.length})</option>
              {availableMatches.map((id,i)=><option key={id} value={id}>Match {i+1} — {id.slice(0,8)}…</option>)}
            </select>
          </div>

          {/* Players */}
          <div style={S.sec}>
            <div style={S.slbl}>Players</div>
            <div style={S.row}><div style={S.flbl}><span style={S.dot('#22d3ee')}/>Humans</div><Toggle on={showHumans} onClick={()=>setShowHumans(v=>!v)}/></div>
            <div style={S.row}><div style={S.flbl}><span style={S.dot('#6366f1')}/>Bots</div><Toggle on={showBots} onClick={()=>setShowBots(v=>!v)}/></div>
          </div>

          {/* Events */}
          <div style={S.sec}>
            <div style={S.slbl}>Event Types</div>
            {EVENT_GROUPS.map(g=>(
              <div key={g.key} style={S.row}>
                <div style={S.flbl}><span style={S.dot(g.color)}/>{g.label}</div>
                <Toggle on={isGroupOn(g.events)} onClick={()=>toggleGroup(g.events)}/>
              </div>
            ))}
          </div>

          {/* Heatmap */}
          <div style={S.sec}>
            <div style={S.slbl}>Heatmap Overlay</div>
            {[{k:null,l:'None'},{k:'kills',l:'🔴 Kill Zones'},{k:'deaths',l:'🟣 Death Zones'},{k:'loot',l:'🟢 Loot Density'},{k:'storm',l:'💜 Storm Deaths'},{k:'traffic',l:'🔵 Traffic'}].map(({k,l})=>(
              <button key={String(k)} style={{...S.mapBtn(heatmapMode===k),fontSize:12,padding:'6px 10px'}} onClick={()=>setHeatmapMode(k)}>{l}</button>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div style={S.canvas} ref={containerRef}>
          {loading && (
            <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,background:'#050910'}}>
              <div style={{width:40,height:40,border:'2px solid #0a1a2a',borderTop:'2px solid #00c8ff',borderRadius:'50%',animation:'spin 1s linear infinite'}}/>
              <div style={{fontFamily:"'Orbitron',monospace",fontSize:18,color:'#00c8ff',letterSpacing:4}}>LILA BLACK</div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:'#2a5070'}}>LOADING TELEMETRY...</div>
            </div>
          )}
          <canvas ref={canvasRef} style={{display:'block',width:'100%',height:'100%',cursor:'crosshair'}}
            onMouseMove={handleMouseMove} onMouseLeave={()=>setTooltip(null)}/>

          {/* Legend */}
          <div style={{position:'absolute',top:12,right:12,background:'rgba(6,11,20,0.88)',border:'1px solid #1a2535',borderRadius:6,padding:'10px 14px',backdropFilter:'blur(4px)'}}>
            <div style={S.slbl}>Legend</div>
            {EVENT_GROUPS.map(g=>(
              <div key={g.key} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                <span style={S.dot(g.color)}/><span style={{fontSize:11,color:'#6888a8',fontFamily:"'JetBrains Mono',monospace"}}>{g.label}</span>
              </div>
            ))}
            <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid #0f1e30'}}>
              {[['#22d3ee','Human path'],['#6366f1','Bot path']].map(([c,l])=>(
                <div key={l} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                  <span style={{width:14,height:2,background:c,display:'inline-block',opacity:0.7}}/><span style={{fontSize:11,color:'#6888a8',fontFamily:"'JetBrains Mono',monospace"}}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Playback bar */}
      <div style={S.bbar}>
        <button style={S.playBtn} onClick={()=>{if(playhead>=1000){playheadRef.current=0;setPlayhead(0);}setPlaying(v=>!v);}}>
          {playing?'⏸ PAUSE':playhead>=1000?'↺ REPLAY':'▶ PLAY'}
        </button>
        <input type="range" min={0} max={1000} value={playhead} style={{flex:1,height:4,cursor:'pointer',accentColor:'#00c8ff'}}
          onChange={e=>{const v=Number(e.target.value);playheadRef.current=v;setPlayhead(v);setPlaying(false);}}/>
        <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:'#2a5070',minWidth:60,textAlign:'right'}}>{Math.round(playhead/10)}%</span>
        <span style={{...S.meta,paddingLeft:12,borderLeft:'1px solid #1a2535'}}>{filtered.length.toLocaleString()} events</span>
      </div>

      {/* Tooltip */}
      {tooltip&&(
        <div style={{...S.tip,left:tooltip.x,top:tooltip.y}}>
          <div style={{color:EVENT_COLORS[tooltip.ev.event]||'#00c8ff',marginBottom:6,fontWeight:600}}>{tooltip.ev.event}</div>
          <div style={{color:'#4a7090',marginBottom:3}}>Player: <span style={{color:'#8ab0d0'}}>{tooltip.ev.is_bot?'🤖':'👤'} {tooltip.ev.user_id.slice(0,16)}</span></div>
          <div style={{color:'#4a7090',marginBottom:3}}>World: <span style={{color:'#8ab0d0'}}>x={tooltip.ev.wx} z={tooltip.ev.wz}</span></div>
          <div style={{color:'#4a7090'}}>Pixel: <span style={{color:'#8ab0d0'}}>{Math.round(tooltip.ev.px)}, {Math.round(tooltip.ev.py)}</span></div>
          <div style={{color:'#4a7090',marginTop:3}}>Match: <span style={{color:'#8ab0d0'}}>{tooltip.ev.match_id.slice(0,8)}…</span></div>
        </div>
      )}
    </div>
  );
}
