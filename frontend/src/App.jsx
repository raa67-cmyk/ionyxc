import { useState, useCallback, useRef, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";

// ── Brand tokens ──────────────────────────────────────────────────────────
const API = "https://ionyxc-production.up.railway.app";
const B = {
  ion:     "#00ffe7",
  ionDim:  "#00ffe711",
  ionMid:  "#00ffe744",
  red:     "#ff3e6c",
  bg:      "#03050a",
  panel:   "#080c14",
  border:  "#0e1a2e",
  text:    "#c8deff",
  muted:   "#3a5070",
  mono:    "'Share Tech Mono', monospace",
  display: "'Orbitron', monospace",
  body:    "'Rajdhani', sans-serif",
};

const PALETTE = ["#00ffe7", "#ff3e6c", "#a8ff3e", "#ffb347", "#c77dff", "#39ffb0"];

// ── Hex Icon ──────────────────────────────────────────────────────────────
function HexIcon({ size = 32, glow = true }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none"
      style={{ filter: glow ? "drop-shadow(0 0 8px #00ffe766)" : "none" }}>
      <polygon points="50,4 93,27 93,73 50,96 7,73 7,27" fill={B.bg} stroke={B.ion} strokeWidth="2.5"/>
      <polygon points="50,18 79,34 79,66 50,82 21,66 21,34" fill="none" stroke={B.ionMid} strokeWidth="1"/>
      <line x1="50" y1="18" x2="50" y2="82" stroke={B.ionDim} strokeWidth="1"/>
      <line x1="21" y1="34" x2="79" y2="66" stroke={B.ionDim} strokeWidth="1"/>
      <line x1="79" y1="34" x2="21" y2="66" stroke={B.ionDim} strokeWidth="1"/>
      <circle cx="50" cy="50" r="6" fill={B.ion}/>
      <circle cx="50" cy="18" r="2.5" fill={B.ion} opacity="0.7"/>
      <circle cx="79" cy="34" r="2.5" fill={B.red} opacity="0.9"/>
      <circle cx="79" cy="66" r="2.5" fill={B.ion} opacity="0.7"/>
      <circle cx="50" cy="82" r="2.5" fill={B.ion} opacity="0.7"/>
      <circle cx="21" cy="66" r="2.5" fill={B.red} opacity="0.9"/>
      <circle cx="21" cy="34" r="2.5" fill={B.ion} opacity="0.7"/>
    </svg>
  );
}

// ── Starfield ─────────────────────────────────────────────────────────────
function Starfield() {
  const ref = useRef();
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    let stars = [], raf;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    const init = () => {
      stars = Array.from({ length: 140 }, () => ({
        x: Math.random() * canvas.width, y: Math.random() * canvas.height,
        r: Math.random() * 1.1, a: Math.random() * Math.PI * 2,
        speed: 0.002 + Math.random() * 0.003
      }));
    };
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        s.a += s.speed;
        const alpha = (Math.sin(s.a) + 1) / 2;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,255,231,${alpha * 0.45})`; ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    resize(); init(); draw();
    window.addEventListener("resize", () => { resize(); init(); });
    return () => { cancelAnimationFrame(raf); };
  }, []);
  return <canvas ref={ref} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.6 }} />;
}

// ── Arbin CSV parser ──────────────────────────────────────────────────────
function parseArbinCSV(text) {
  const lines = text.trim().split("\n");
  let hi = lines.findIndex(l =>
    l.toLowerCase().includes("cycle_index") || l.toLowerCase().includes("cycle index")
  );
  if (hi === -1) hi = 0;
  const headers = lines[hi].split(",").map(h =>
    h.trim().replace(/"/g, "").toLowerCase().replace(/ /g, "_")
  );
  const rows = [];
  for (let i = hi + 1; i < lines.length; i++) {
    const vals = lines[i].split(",");
    if (vals.length < 3) continue;
    const row = {};
    headers.forEach((h, j) => {
      row[h] = isNaN(vals[j]) ? vals[j]?.trim() : parseFloat(vals[j]);
    });
    rows.push(row);
  }
  return rows;
}

// ── Compute all metrics per cycle ─────────────────────────────────────────
function computeMetrics(rows) {
  const cycles = {};
  rows.forEach(r => {
    const c = r["cycle_index"] ?? r["cycle"] ?? r["cycle_number"];
    if (c == null || isNaN(c)) return;
    if (!cycles[c]) cycles[c] = { discharge: [], charge: [], v_max: [], v_min: [], esr: [] };

    const cd  = r["discharge_capacity(ah)"] ?? r["discharge_capacity"] ?? r["dchg_capacity(ah)"];
    const cc  = r["charge_capacity(ah)"]    ?? r["charge_capacity"]    ?? r["chg_capacity(ah)"];
    const vmax = r["voltage(v)"] ?? r["max_voltage(v)"] ?? r["charge_voltage(v)"];
    const vmin = r["min_voltage(v)"] ?? r["discharge_voltage(v)"];
    // ESR = ΔV / ΔI at the start of discharge pulse (if DCIR column exists)
    const esr = r["dcir(ohm)"] ?? r["internal_resistance(ohm)"] ?? r["esr(ohm)"];

    if (cd   != null && !isNaN(cd))   cycles[c].discharge.push(cd);
    if (cc   != null && !isNaN(cc))   cycles[c].charge.push(cc);
    if (vmax != null && !isNaN(vmax)) cycles[c].v_max.push(vmax);
    if (vmin != null && !isNaN(vmin)) cycles[c].v_min.push(vmin);
    if (esr  != null && !isNaN(esr))  cycles[c].esr.push(esr);
  });

  return Object.entries(cycles).map(([cyc, d]) => {
    const dCap  = d.discharge.length ? Math.max(...d.discharge) * 1000 : null;
    const cCap  = d.charge.length    ? Math.max(...d.charge)    * 1000 : null;
    const ce    = dCap && cCap && cCap > 0 ? (dCap / cCap) * 100 : null;
    const vMax  = d.v_max.length ? Math.max(...d.v_max) : null;
    const vMin  = d.v_min.length ? Math.min(...d.v_min) : null;
    const vMid  = vMax && vMin ? (vMax + vMin) / 2 : (vMax ?? vMin);
    const esrMean = d.esr.length
      ? d.esr.reduce((a, v) => a + v, 0) / d.esr.length * 1000  // → mΩ
      : null;

    return {
      cycle: parseInt(cyc),
      discharge_cap_mah: dCap,
      charge_cap_mah: cCap,
      coulombic_efficiency: ce,
      voltage_max: vMax,
      voltage_min: vMin,
      voltage_mid: vMid,
      esr_mohm: esrMean,
    };
  }).filter(r => r.discharge_cap_mah != null).sort((a, b) => a.cycle - b.cycle);
}

// ── Demo data (includes all metrics) ─────────────────────────────────────
function generateDemoData() {
  const metrics = [];
  let cap = 280, esr = 18;
  for (let i = 1; i <= 100; i++) {
    cap = cap * (1 - 0.0015 + (Math.random() - 0.5) * 0.0008);
    esr = esr * (1 + 0.003 + (Math.random() - 0.5) * 0.002);
    const ce   = i === 1 ? 73 + Math.random() * 4 : 98.6 + Math.random() * 1.1;
    const vMax = 2.0  - i * 0.0005 + (Math.random() - 0.5) * 0.005;
    const vMin = 0.01 + i * 0.0002 + (Math.random() - 0.5) * 0.003;
    metrics.push({
      cycle: i,
      discharge_cap_mah: cap,
      charge_cap_mah: cap / (ce / 100),
      coulombic_efficiency: ce,
      voltage_max: vMax,
      voltage_min: vMin,
      voltage_mid: (vMax + vMin) / 2,
      esr_mohm: esr,
    });
  }
  return {
    id: "demo-1",
    label: "Ti₃C₂Tₓ — DEMO",
    metadata: { cell_id: "DEMO-001", composition: "Ti₃C₂Tₓ", mass_mg: "3.2", electrolyte: "3M KOH", date: "2025-03-01" },
    metrics,
    filename: "demo_arbin.csv",
    isDemo: true,
  };
}

// ── Tooltip ───────────────────────────────────────────────────────────────
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: B.panel, border: `1px solid ${B.border}`, borderRadius: 8, padding: "10px 14px", fontFamily: B.mono, fontSize: 11 }}>
      <div style={{ color: B.muted, marginBottom: 5, letterSpacing: "0.1em" }}>CYCLE {label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <strong>{typeof p.value === "number" ? p.value.toFixed(3) : p.value}</strong>
        </div>
      ))}
    </div>
  );
};

// ── Stat card ─────────────────────────────────────────────────────────────
function StatCard({ label, value, unit, color }) {
  return (
    <div style={{ background: B.panel, border: `1px solid ${color}33`, borderRadius: 10, padding: "14px 18px", minWidth: 120, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${color}, transparent)`, opacity: 0.6 }} />
      <div style={{ fontFamily: B.mono, fontSize: 9, color: B.muted, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: B.display, fontSize: 19, fontWeight: 700, color, textShadow: `0 0 14px ${color}66` }}>{value ?? "—"}</div>
      {unit && <div style={{ fontFamily: B.mono, fontSize: 9, color: B.muted, marginTop: 3 }}>{unit}</div>}
    </div>
  );
}

// ── Metadata form ─────────────────────────────────────────────────────────
function MetadataForm({ onSubmit, filename }) {
  const [form, setForm] = useState({
    cell_id: "", composition: "", mass_mg: "", electrolyte: "",
    date: new Date().toISOString().split("T")[0]
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const fields = [
    { k: "cell_id",      label: "Cell / Sample ID",    placeholder: "e.g. MX-007" },
    { k: "composition",  label: "MXene Composition",   placeholder: "e.g. Ti₃C₂Tₓ" },
    { k: "mass_mg",      label: "Electrode Mass (mg)", placeholder: "e.g. 3.5" },
    { k: "electrolyte",  label: "Electrolyte",         placeholder: "e.g. 3M KOH" },
    { k: "date",         label: "Date Run",             type: "date" },
  ];
  return (
    <div style={{ background: B.panel, border: `1px solid ${B.ion}33`, borderRadius: 12, padding: 24, maxWidth: 480 }}>
      <div style={{ fontFamily: B.mono, fontSize: 10, color: B.ion, letterSpacing: "0.2em", marginBottom: 4 }}>// NEW SAMPLE DETECTED</div>
      <div style={{ fontFamily: B.body, fontSize: 13, color: B.muted, marginBottom: 18 }}>{filename}</div>
      {fields.map(({ k, label, placeholder, type }) => (
        <div key={k} style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontFamily: B.mono, fontSize: 9, color: B.muted, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 5 }}>{label}</label>
          <input
            type={type || "text"} value={form[k]}
            onChange={e => set(k, e.target.value)} placeholder={placeholder}
            style={{ width: "100%", background: B.bg, border: `1px solid ${B.border}`, borderRadius: 6, color: B.text, fontSize: 13, padding: "8px 12px", outline: "none", boxSizing: "border-box", fontFamily: B.mono, transition: "border-color 0.2s" }}
            onFocus={e => e.target.style.borderColor = B.ion}
            onBlur={e  => e.target.style.borderColor = B.border}
          />
        </div>
      ))}
      <button onClick={() => onSubmit(form)}
        style={{ marginTop: 8, width: "100%", background: B.ion, color: B.bg, border: "none", borderRadius: 6, padding: "11px 0", fontFamily: B.display, fontWeight: 700, fontSize: 11, cursor: "pointer", letterSpacing: "0.15em" }}>
        PROCESS SAMPLE →
      </button>
    </div>
  );
}

// ── Chart wrapper ─────────────────────────────────────────────────────────
function MetricChart({ title, dataKey, unit, yDomain, activeSamples }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontFamily: B.mono, fontSize: 9, color: B.muted, letterSpacing: "0.15em", marginBottom: 14 }}>
        // {title}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={B.border} />
          <XAxis dataKey="cycle" type="number" domain={["auto","auto"]}
            tick={{ fill: B.muted, fontSize: 10, fontFamily: "Share Tech Mono" }}
            label={{ value: "CYCLE", position: "insideBottom", offset: -2, fill: B.muted, fontSize: 9, fontFamily: "Share Tech Mono" }} />
          <YAxis domain={yDomain || ["auto","auto"]}
            tick={{ fill: B.muted, fontSize: 10, fontFamily: "Share Tech Mono" }}
            label={{ value: unit, angle: -90, position: "insideLeft", fill: B.muted, fontSize: 9, fontFamily: "Share Tech Mono" }} />
          <Tooltip content={<ChartTip />} />
          <Legend wrapperStyle={{ fontFamily: "Share Tech Mono", fontSize: 10, color: B.muted }} />
          {activeSamples.map((s, i) => (
            <Line key={s.id} data={s.metrics} type="monotone" dataKey={dataKey} name={s.label}
              stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot={false}
              activeDot={{ r: 4, fill: PALETTE[i % PALETTE.length], stroke: B.bg }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────
export default function App() {
  const [samples, setSamples]     = useState([generateDemoData()]);
  const [pending, setPending]     = useState(null);
  const [activeTab, setActiveTab] = useState("capacity");
  const [selectedIds, setSelectedIds] = useState(["demo-1"]);
  const fileRef = useRef();
  const dropRef = useRef();

  const handleFiles = useCallback((files) => {
    const file = files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => setPending({ text: e.target.result, filename: file.name });
    reader.readAsText(file);
  }, []);

  const onDrop = useCallback(e => {
    e.preventDefault();
    dropRef.current.style.borderColor = B.border;
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const processFile = async(metadata) => {
   const formData = new FormData();
formData.append("file", new Blob([pending.text], { type: "text/csv" }), pending.filename);
Object.entries(metadata).forEach(([k, v]) => formData.append(k, v));
const res = await fetch(`${API}/api/upload/`, { method: "POST", body: formData });
const data = await res.json();
const metrics = data.metrics;
    const id = `s-${Date.now()}`;
    setSamples(s => [...s, { id, label: metadata.cell_id || pending.filename, metadata, metrics, filename: pending.filename, isDemo: false }]);
    setSelectedIds(ids => [...ids, id]);
    setPending(null);
  };

  const toggleSelect = id => setSelectedIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  const removeSample = id => { setSamples(s => s.filter(x => x.id !== id)); setSelectedIds(ids => ids.filter(x => x !== id)); };

  const activeSamples = samples.filter(s => selectedIds.includes(s.id));
  const primary = activeSamples[0];
  const pm = primary?.metrics ?? [];

  // Summary stats
  const initCap   = pm[0]?.discharge_cap_mah;
  const finalCap  = pm[pm.length - 1]?.discharge_cap_mah;
  const retention = initCap && finalCap ? ((finalCap / initCap) * 100).toFixed(1) : null;
  const avgCE     = pm.length > 5
    ? (pm.slice(5).reduce((a, r) => a + (r.coulombic_efficiency ?? 0), 0) / (pm.length - 5)).toFixed(2)
    : null;
  const initESR   = pm[0]?.esr_mohm?.toFixed(1);
  const finalESR  = pm[pm.length - 1]?.esr_mohm?.toFixed(1);
  const initVmid  = pm[0]?.voltage_mid?.toFixed(3);
  const finalVmid = pm[pm.length - 1]?.voltage_mid?.toFixed(3);
  const maxCycles = pm[pm.length - 1]?.cycle;

  const TABS = [
    { id: "capacity", label: "CAPACITY" },
    { id: "voltage",  label: "VOLTAGE" },
    { id: "ce",       label: "COULOMBIC EFF" },
    { id: "esr",      label: "ESR" },
    { id: "summary",  label: "SUMMARY TABLE" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: B.bg, color: B.text, fontFamily: B.body, position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Share+Tech+Mono&family=Rajdhani:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; background: ${B.bg}; }
        ::-webkit-scrollbar-thumb { background: ${B.border}; border-radius: 3px; }
        .tab-btn { background: none; border: none; cursor: pointer; padding: 10px 16px; font-family: ${B.mono}; font-size: 9px; letter-spacing: 0.16em; transition: all 0.15s; border-bottom: 2px solid transparent; white-space: nowrap; }
        .tab-btn:hover { color: ${B.text} !important; }
        .upload-btn { background: ${B.ion}; color: ${B.bg}; border: none; border-radius: 6px; padding: 8px 18px; font-family: ${B.display}; font-weight: 700; font-size: 10px; letter-spacing: 0.12em; cursor: pointer; transition: box-shadow 0.2s; }
        .upload-btn:hover { box-shadow: 0 0 20px ${B.ion}66; }
        .sample-row { display: flex; align-items: center; gap: 8px; border-radius: 8px; padding: 8px 10px; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; }
        .sample-row:hover { border-color: ${B.muted}33; }
        .rm-btn { background: none; border: none; color: ${B.muted}; cursor: pointer; font-size: 12px; line-height: 1; padding: 0 0 0 4px; }
        .rm-btn:hover { color: ${B.red}; }
        @keyframes hexGlow { 0%,100%{filter:drop-shadow(0 0 8px #00ffe755)} 50%{filter:drop-shadow(0 0 20px #00ffe7aa)} }
        .hex-anim { animation: hexGlow 3s ease-in-out infinite; }
        @keyframes scanline { 0%,100%{opacity:0.3;transform:scaleX(0.5)} 50%{opacity:0.7;transform:scaleX(1)} }
      `}</style>

      <Starfield />

      {/* Header */}
      <div style={{ position: "relative", zIndex: 1, borderBottom: `1px solid ${B.border}`, padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 62 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="hex-anim"><HexIcon size={36} /></div>
          <div>
            <div style={{ fontFamily: B.display, fontWeight: 900, fontSize: 18, letterSpacing: "0.14em", lineHeight: 1 }}>
              <span style={{ color: B.ion,  textShadow: `0 0 20px ${B.ion}88` }}>ION</span>
              <span style={{ color: B.text }}>YX</span>
              <span style={{ color: B.red,  textShadow: `0 0 14px ${B.red}88` }}>·</span>
              <span style={{ color: B.ion,  textShadow: `0 0 20px ${B.ion}88` }}>C</span>
            </div>
            <div style={{ fontFamily: B.mono, fontSize: 8, color: B.muted, letterSpacing: "0.2em", marginTop: 2 }}>MXENE COIN CELL ANALYTICS</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontFamily: B.mono, fontSize: 9, color: B.muted, background: B.panel, border: `1px solid ${B.border}`, borderRadius: 20, padding: "3px 12px", letterSpacing: "0.1em" }}>
            {samples.filter(s => !s.isDemo).length} SAMPLES
          </div>
          <button className="upload-btn" onClick={() => fileRef.current.click()}>+ UPLOAD</button>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />
        </div>
      </div>

      {/* Scan line */}
      <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${B.ion}, transparent)`, animation: "scanline 4s ease-in-out infinite", position: "relative", zIndex: 1 }} />

      {/* Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "252px 1fr", minHeight: "calc(100vh - 63px)", position: "relative", zIndex: 1 }}>

        {/* Sidebar */}
        <div style={{ borderRight: `1px solid ${B.border}`, padding: 18, display: "flex", flexDirection: "column", gap: 18, overflowY: "auto" }}>

          {/* Drop zone */}
          <div ref={dropRef}
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); dropRef.current.style.borderColor = B.ion; }}
            onDragLeave={() => { dropRef.current.style.borderColor = B.border; }}
            onClick={() => fileRef.current.click()}
            style={{ border: `1.5px dashed ${B.border}`, borderRadius: 10, padding: "20px 14px", textAlign: "center", cursor: "pointer", transition: "border-color 0.2s", background: B.panel }}>
            <HexIcon size={28} glow={false} />
            <div style={{ fontFamily: B.mono, fontSize: 9, color: B.muted, letterSpacing: "0.12em", marginTop: 10, lineHeight: 1.9 }}>
              DROP ARBIN <span style={{ color: B.ion }}>.CSV</span> OR <span style={{ color: B.ion }}>.XLSX</span><br/>OR CLICK TO BROWSE
            </div>
          </div>

          {/* Sample list */}
          <div>
            <div style={{ fontFamily: B.mono, fontSize: 9, color: B.muted, letterSpacing: "0.2em", marginBottom: 10 }}>// SAMPLES</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {samples.map((s, i) => {
                const col    = PALETTE[i % PALETTE.length];
                const active = selectedIds.includes(s.id);
                return (
                  <div key={s.id} className="sample-row" onClick={() => toggleSelect(s.id)}
                    style={{ background: active ? `${col}0a` : "transparent", borderColor: active ? `${col}44` : "transparent" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: active ? col : B.border, boxShadow: active ? `0 0 8px ${col}` : "none", flexShrink: 0, transition: "all 0.2s" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: B.body, fontSize: 12, fontWeight: 600, color: active ? B.text : B.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</div>
                      <div style={{ fontFamily: B.mono, fontSize: 9, color: B.muted }}>{s.metadata?.composition} · {s.metrics.length}cy</div>
                    </div>
                    {s.isDemo && <span style={{ fontFamily: B.mono, fontSize: 8, color: B.muted, background: B.border, borderRadius: 3, padding: "1px 5px" }}>DEMO</span>}
                    {!s.isDemo && <button className="rm-btn" onClick={e => { e.stopPropagation(); removeSample(s.id); }}>✕</button>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sample info */}
          {primary && (
            <div style={{ background: B.panel, border: `1px solid ${B.border}`, borderRadius: 10, padding: 14 }}>
              <div style={{ fontFamily: B.mono, fontSize: 9, color: B.ion, letterSpacing: "0.2em", marginBottom: 12 }}>// SAMPLE INFO</div>
              {[
                ["CELL ID",      primary.metadata?.cell_id],
                ["COMPOSITION",  primary.metadata?.composition],
                ["MASS",         primary.metadata?.mass_mg ? `${primary.metadata.mass_mg} mg` : null],
                ["ELECTROLYTE",  primary.metadata?.electrolyte],
                ["DATE",         primary.metadata?.date],
              ].map(([k, v]) => v ? (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7, gap: 8 }}>
                  <span style={{ fontFamily: B.mono, fontSize: 8, color: B.muted, letterSpacing: "0.1em", flexShrink: 0 }}>{k}</span>
                  <span style={{ fontFamily: B.mono, fontSize: 10, color: B.text, textAlign: "right" }}>{v}</span>
                </div>
              ) : null)}
            </div>
          )}

          {/* Parser info */}
          <div style={{ fontFamily: B.mono, fontSize: 8, color: B.muted, lineHeight: 1.9, letterSpacing: "0.05em", padding: "10px 0", borderTop: `1px solid ${B.border}` }}>
            <span style={{ color: B.ion }}>PARSER v1.0</span> · ARBIN<br/>
            <span style={{ color: B.border }}>────────────────</span><br/>
            NEWARE · BIOLOGIC<br/>
            <span style={{ color: `${B.muted}66` }}>coming soon</span>
          </div>
        </div>

        {/* Main panel */}
        <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20, overflowY: "auto" }}>

          {/* Pending upload */}
          {pending && (
            <div style={{ marginBottom: 8 }}>
              <MetadataForm filename={pending.filename} onSubmit={processFile} />
            </div>
          )}

          {/* Stat cards */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <StatCard label="Init. Capacity"  value={initCap?.toFixed(1)}  unit="mAh"      color={B.ion} />
            <StatCard label="Cap. Retention"  value={retention}             unit="%"         color="#a8ff3e" />
            <StatCard label="Avg CE (cy5+)"   value={avgCE}                 unit="%"         color="#ffb347" />
            <StatCard label="Init. ESR"        value={initESR}               unit="mΩ"        color={B.red} />
            <StatCard label="Final ESR"        value={finalESR}              unit="mΩ"        color="#c77dff" />
            <StatCard label="Init. Vmid"       value={initVmid}              unit="V"         color="#39ffb0" />
            <StatCard label="Total Cycles"    value={maxCycles}             unit="cycles"    color={B.muted} />
          </div>

          {/* Tabs */}
          <div style={{ borderBottom: `1px solid ${B.border}`, display: "flex", gap: 0, overflowX: "auto" }}>
            {TABS.map(t => (
              <button key={t.id} className="tab-btn" onClick={() => setActiveTab(t.id)}
                style={{ color: activeTab === t.id ? B.ion : B.muted, borderBottomColor: activeTab === t.id ? B.ion : "transparent" }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab: Capacity */}
          {activeTab === "capacity" && (
            <MetricChart
              title="DISCHARGE CAPACITY vs CYCLE · mAh"
              dataKey="discharge_cap_mah"
              unit="mAh"
              activeSamples={activeSamples}
            />
          )}

          {/* Tab: Voltage */}
          {activeTab === "voltage" && (
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: B.mono, fontSize: 9, color: B.muted, letterSpacing: "0.15em", marginBottom: 14 }}>
                // VOLTAGE BEHAVIOR vs CYCLE · V (max, mid, min)
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke={B.border} />
                  <XAxis dataKey="cycle" type="number" domain={["auto","auto"]}
                    tick={{ fill: B.muted, fontSize: 10, fontFamily: "Share Tech Mono" }}
                    label={{ value: "CYCLE", position: "insideBottom", offset: -2, fill: B.muted, fontSize: 9, fontFamily: "Share Tech Mono" }} />
                  <YAxis tick={{ fill: B.muted, fontSize: 10, fontFamily: "Share Tech Mono" }}
                    label={{ value: "V", angle: -90, position: "insideLeft", fill: B.muted, fontSize: 9, fontFamily: "Share Tech Mono" }} />
                  <Tooltip content={<ChartTip />} />
                  <Legend wrapperStyle={{ fontFamily: "Share Tech Mono", fontSize: 10, color: B.muted }} />
                  {activeSamples.map((s, i) => {
                    const col = PALETTE[i % PALETTE.length];
                    return [
                      <Line key={`${s.id}-vmax`} data={s.metrics} type="monotone" dataKey="voltage_max" name={`${s.label} Vmax`} stroke={col} strokeWidth={1.5} strokeDasharray="4 2" dot={false} />,
                      <Line key={`${s.id}-vmid`} data={s.metrics} type="monotone" dataKey="voltage_mid" name={`${s.label} Vmid`} stroke={col} strokeWidth={2}   dot={false} />,
                      <Line key={`${s.id}-vmin`} data={s.metrics} type="monotone" dataKey="voltage_min" name={`${s.label} Vmin`} stroke={col} strokeWidth={1.5} strokeDasharray="1 3" dot={false} />,
                    ];
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tab: Coulombic Efficiency */}
          {activeTab === "ce" && (
            <MetricChart
              title="COULOMBIC EFFICIENCY vs CYCLE · %"
              dataKey="coulombic_efficiency"
              unit="CE %"
              yDomain={[60, 102]}
              activeSamples={activeSamples}
            />
          )}

          {/* Tab: ESR */}
          {activeTab === "esr" && (
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: B.mono, fontSize: 9, color: B.muted, letterSpacing: "0.15em", marginBottom: 8 }}>
                // EQUIVALENT SERIES RESISTANCE vs CYCLE · mΩ
              </div>
              <div style={{ fontFamily: B.mono, fontSize: 8, color: B.muted, marginBottom: 14, lineHeight: 1.7 }}>
                ESR computed from <span style={{ color: B.ion }}>DCIR(Ohm)</span> column · rising ESR indicates electrode degradation or electrolyte dry-out
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke={B.border} />
                  <XAxis dataKey="cycle" type="number" domain={["auto","auto"]}
                    tick={{ fill: B.muted, fontSize: 10, fontFamily: "Share Tech Mono" }}
                    label={{ value: "CYCLE", position: "insideBottom", offset: -2, fill: B.muted, fontSize: 9, fontFamily: "Share Tech Mono" }} />
                  <YAxis tick={{ fill: B.muted, fontSize: 10, fontFamily: "Share Tech Mono" }}
                    label={{ value: "mΩ", angle: -90, position: "insideLeft", fill: B.muted, fontSize: 9, fontFamily: "Share Tech Mono" }} />
                  <Tooltip content={<ChartTip />} />
                  <Legend wrapperStyle={{ fontFamily: "Share Tech Mono", fontSize: 10, color: B.muted }} />
                  {activeSamples.map((s, i) => (
                    <Line key={s.id} data={s.metrics} type="monotone" dataKey="esr_mohm" name={s.label}
                      stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot={false}
                      activeDot={{ r: 4, fill: PALETTE[i % PALETTE.length], stroke: B.bg }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tab: Summary table */}
          {activeTab === "summary" && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: B.mono, fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${B.border}` }}>
                    {["SAMPLE","COMP.","ELECTROLYTE","MASS mg","INIT mAh","FINAL mAh","RETENTION %","AVG CE %","1ST CE %","INIT ESR mΩ","FINAL ESR mΩ","INIT Vmid V","CYCLES"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: B.muted, fontSize: 8, letterSpacing: "0.1em", fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeSamples.map((s, i) => {
                    const m   = s.metrics;
                    const ic  = m[0]?.discharge_cap_mah;
                    const fc  = m[m.length - 1]?.discharge_cap_mah;
                    const col = PALETTE[i % PALETTE.length];
                    const vals = [
                      s.label,
                      s.metadata?.composition,
                      s.metadata?.electrolyte,
                      s.metadata?.mass_mg,
                      ic?.toFixed(2),
                      fc?.toFixed(2),
                      ic && fc ? ((fc / ic) * 100).toFixed(1) : "—",
                      m.length > 5 ? (m.slice(5).reduce((a, r) => a + (r.coulombic_efficiency ?? 0), 0) / (m.length - 5)).toFixed(2) : "—",
                      m[0]?.coulombic_efficiency?.toFixed(1) ?? "—",
                      m[0]?.esr_mohm?.toFixed(1) ?? "—",
                      m[m.length - 1]?.esr_mohm?.toFixed(1) ?? "—",
                      m[0]?.voltage_mid?.toFixed(3) ?? "—",
                      m[m.length - 1]?.cycle,
                    ];
                    return (
                      <tr key={s.id} style={{ borderBottom: `1px solid ${B.border}44` }}>
                        {vals.map((v, j) => (
                          <td key={j} style={{ padding: "9px 10px", color: j === 0 ? col : B.text, whiteSpace: "nowrap" }}>{v ?? "—"}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          <div style={{ marginTop: "auto", padding: "10px 14px", background: B.panel, border: `1px solid ${B.border}`, borderRadius: 8, fontFamily: B.mono, fontSize: 9, color: B.muted, lineHeight: 1.9, letterSpacing: "0.05em" }}>
            <span style={{ color: B.ion }}>ARBIN COLUMN MAPPING</span>{" · "}
            <code style={{ color: B.ion, background: B.bg, padding: "1px 4px", borderRadius: 3 }}>Cycle_Index</code>{" "}
            <code style={{ color: B.ion, background: B.bg, padding: "1px 4px", borderRadius: 3 }}>Discharge_Capacity(Ah)</code>{" "}
            <code style={{ color: B.ion, background: B.bg, padding: "1px 4px", borderRadius: 3 }}>Charge_Capacity(Ah)</code>{" "}
            <code style={{ color: "#ffb347", background: B.bg, padding: "1px 4px", borderRadius: 3 }}>Voltage(V)</code>{" "}
            <code style={{ color: B.red, background: B.bg, padding: "1px 4px", borderRadius: 3 }}>DCIR(Ohm)</code>
            {" · "}XLSX via backend · Neware / BioLogic adapters coming soon
          </div>
        </div>
      </div>
    </div>
  );
}
