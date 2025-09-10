import { useEffect, useMemo, useState } from "react";
import events from "./data/events_phase0.json";

// --- Map deps ---
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

const WEEKDAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
const weekdayOrder = Object.fromEntries(WEEKDAYS.map((w,i)=>[w,i]));
const JS_DOW = { sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6 };

export default function App() {
  const [clubFilter, setClubFilter] = useState("");
  const [weekdayFilter, setWeekdayFilter] = useState("");
  const [hourFilter, setHourFilter] = useState("");      // "06", "18", etc
  const [view, setView] = useState("list");              // "list" | "calendar" | "map"

  // Distance stats from data
  const distanceStats = useMemo(() => {
    const vals = events.flatMap(getDistances).filter(n => Number.isFinite(n));
    return {
      min: vals.length ? Math.floor(Math.min(...vals)) : 0,
      max: vals.length ? Math.ceil(Math.max(...vals)) : 20
    };
  }, []);

  const [distMin, setDistMin] = useState(distanceStats.min);
  const [distMax, setDistMax] = useState(distanceStats.max);

  // Clubs (active only) for dropdown
  const clubs = useMemo(() => {
    const set = new Map();
    events.forEach(e => { if (e.active !== false) set.set(e.club_slug, e.club); });
    return Array.from(set.entries()).sort((a,b) => a[1].localeCompare(b[1]));
  }, []);

  // Hours present in data (active only)
  const hours = useMemo(() => {
    const set = new Set();
    events.forEach(e => {
      if (e.active === false) return;
      const hh = (e.start_time || "").split(":")[0];
      if (hh && /^\d{1,2}$/.test(hh)) set.add(hh.padStart(2, "0"));
    });
    return Array.from(set).sort((a,b) => a.localeCompare(b));
  }, []);

  // Main filtered list
  const filtered = useMemo(() => {
    return events
      .filter(e => e.active !== false)
      .filter(e => (clubFilter ? e.club_slug === clubFilter : true))
      .filter(e => (weekdayFilter ? e.weekday === weekdayFilter : true))
      .filter(e => (hourFilter ? (e.start_time || "").startsWith(hourFilter + ":") : true))
      .filter(e => eventWithinDistanceRange(e, distMin, distMax))
      .sort((a,b) => {
        const wd = (weekdayOrder[a.weekday] ?? 99) - (weekdayOrder[b.weekday] ?? 99);
        if (wd !== 0) return wd;
        return (a.start_time || "").localeCompare(b.start_time || "");
      });
  }, [clubFilter, weekdayFilter, hourFilter, distMin, distMax]);

  return (
    <div style={{ maxWidth: 1000, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ marginBottom: 8 }}>Zurich Running – Community Runs</h1>
      <p style={{ color: "#555", marginTop: 0 }}>
        Display-only MVP. Filter by club and weekday. List · Calendar · Map.
      </p>

      {/* View tabs */}
      <div style={{ display: "flex", gap: 8, margin: "8px 0 16px" }}>
        <TabButton active={view==="list"} onClick={()=>setView("list")}>List</TabButton>
        <TabButton active={view==="calendar"} onClick={()=>setView("calendar")}>Calendar</TabButton>
        <TabButton active={view==="map"} onClick={()=>setView("map")}>Map</TabButton>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, margin: "16px 0 24px", flexWrap: "wrap" }}>
        <select value={clubFilter} onChange={e => setClubFilter(e.target.value)}
          style={{ height: 32, fontSize: 14, padding: "4px 8px", borderRadius: 8 }}>
          <option value="">All clubs</option>
          {clubs.map(([slug, name]) => (
            <option key={slug} value={slug}>{name}</option>
          ))}
        </select>

        <select value={weekdayFilter} onChange={e => setWeekdayFilter(e.target.value)}
          style={{ height: 32, fontSize: 14, padding: "4px 8px", borderRadius: 8 }}>
          <option value="">All weekdays</option>
          {WEEKDAYS.map(w => (
            <option key={w} value={w}>{w.charAt(0).toUpperCase()+w.slice(1)}</option>
          ))}
        </select>

        <select
          value={hourFilter}
          onChange={(e)=>setHourFilter(e.target.value)}
          style={{ height: 32, fontSize: 14, padding: "4px 8px", borderRadius: 8 }}
        >
          <option value="">All times</option>
          {hours.map(h => (
            <option key={h} value={h}>{h}:00</option>
          ))}
        </select>

        {/* Distance range (single two-thumb control) */}
        <div style={{ display: "grid", gap: 6, minWidth: 320 }}>
          <label style={{ fontSize: 14, color: "#333" }}>
            Distance: <strong>{distMin}</strong> – <strong>{distMax}</strong> km
          </label>

          <DualRange
            min={distanceStats.min}
            max={distanceStats.max}
            step={0.5}
            valueMin={distMin}
            valueMax={distMax}
            onChange={({min, max})=>{ setDistMin(min); setDistMax(max); }}
          />

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="number" step="0.5"
              min={distanceStats.min} max={distanceStats.max}
              value={distMin}
              onChange={(e)=> setDistMin(Math.min(Math.max(Number(e.target.value), distanceStats.min), distMax))}
              style={{ width: 80 }}
            />
            <span>to</span>
            <input
              type="number" step="0.5"
              min={distanceStats.min} max={distanceStats.max}
              value={distMax}
              onChange={(e)=> setDistMax(Math.max(Math.min(Number(e.target.value), distanceStats.max), distMin))}
              style={{ width: 80 }}
            />
            <button onClick={() => { setDistMin(distanceStats.min); setDistMax(distanceStats.max); }}>All</button>
          </div>
        </div>

        {(clubFilter || weekdayFilter || hourFilter || (distMin !== distanceStats.min || distMax !== distanceStats.max)) && (
          <button onClick={() => {
            setClubFilter("");
            setWeekdayFilter("");
            setHourFilter("");
            setDistMin(distanceStats.min);
            setDistMax(distanceStats.max);
          }}>
            Clear filters
          </button>
        )}
      </div>

      {/* Views */}
      {view === "list" ? (
        <>
          <div style={{ marginBottom: 12, color: "#333" }}>
            Showing <strong>{filtered.length}</strong> session{filtered.length !== 1 ? "s" : ""}.
          </div>
          <ListView items={filtered} />
        </>
      ) : view === "calendar" ? (
        <CalendarView baseEvents={filtered} />
      ) : (
        <MapView baseEvents={filtered} />
      )}
    </div>
  );
}

/* ---------- List View ---------- */
function ListView({ items }) {
  return (
    <>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
        {items.map((e, idx) => (
          <li key={`${e.id}-${idx}`} style={{
            border: "1px solid #e5e7eb", borderRadius: 12, padding: 14,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0 }}>{e.club}</h3>
              <div style={{ color: "#555" }}>
                {capitalize(e.weekday)} · {e.start_time || "—"} {e.duration_min ? `· ${e.duration_min} min` : ""}
              </div>
            </div>

            <div style={{ marginTop: 6 }}>
              <strong>Location:</strong> {e.location_name || "—"}{" "}
              {hasCoords(e) && (<> · <a href={mapsUrl(e)} target="_blank" rel="noreferrer">Open in Maps</a></>)}
            </div>

            {e.pace_groups_min_per_km && (
              <div style={{ marginTop: 6 }}>
                <strong>Pace groups:</strong> {e.pace_groups_min_per_km.replaceAll(";", " / ")} min/km
              </div>
            )}

            {formatDistances(e) && (
              <div style={{ marginTop: 6 }}>
                <strong>Distance:</strong> {formatDistances(e)}
              </div>
            )}

            {(e.source_url || getInstagramUrl(e)) && (
              <div style={{ marginTop: 6 }}>
                {(() => {
                  const ig = getInstagramUrl(e);
                  const src = e.source_url;
                  const srcIsIG = ig && sameUrl(ig, src);
                  if (srcIsIG) return <a href={ig} target="_blank" rel="noreferrer">Instagram</a>;
                  return (
                    <>
                      {src && <a href={src} target="_blank" rel="noreferrer">More info</a>}
                      {ig && <> · <a href={ig} target="_blank" rel="noreferrer">Instagram</a></>}
                    </>
                  );
                })()}
              </div>
            )}
          </li>
        ))}
      </ul>
      {items.length === 0 && <p style={{ color: "#777", marginTop: 24 }}>No sessions found for the selected filters.</p>}
    </>
  );
}

/* ---------- Calendar (month view) ---------- */
function CalendarView({ baseEvents }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const firstOfMonth = new Date(year, month, 1);
  const offsetToMonday = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = startOfDay(new Date(year, month, 1 - offsetToMonday));
  const gridEnd = new Date(gridStart); gridEnd.setDate(gridStart.getDate() + 42);

  const occ = expandOccurrencesInRange(baseEvents, gridStart, gridEnd);

  const byDay = new Map();
  occ.forEach(o => {
    const key = ymd(o.startDate);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(o);
  });
  for (const list of byDay.values()) list.sort((a,b) => (a.start_time||"").localeCompare(b.start_time||""));

  const cells = [];
  const cursor = new Date(gridStart);
  for (let i = 0; i < 42; i++) {
    const d = new Date(cursor);
    const key = ymd(d);
    cells.push({ date: d, inMonth: d.getMonth() === month, items: byDay.get(key) || [] });
    cursor.setDate(cursor.getDate() + 1);
  }

  const labels = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
        {labels.map(l => <div key={l} style={{ fontWeight: 600, color: "#555", padding: "6px 4px" }}>{l}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
        {cells.map((c, i) => (
          <div key={i} style={{
            minHeight: 110, border: "1px solid #e5e7eb", borderRadius: 10, padding: 8,
            background: isToday(c.date) ? "rgba(59,130,246,0.08)" : c.inMonth ? "#fff" : "#fafafa",
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontWeight: 600, color: c.inMonth ? "#111" : "#aaa" }}>{c.date.getDate()}</div>
              {!c.inMonth && <div style={{ fontSize: 12, color: "#bbb" }}>{c.date.toLocaleString(undefined, { month: "short" })}</div>}
            </div>
            <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
              {c.items.map((e, idx) => (
                <div key={idx} style={{ fontSize: 13, lineHeight: 1.25, padding: "6px 8px",
                  borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff" }}>
                  <div style={{ fontWeight: 600 }}>
                    {e.start_time || "—"} · {e.club} {formatDistancesInline(e)}
                  </div>
                  <div style={{ color: "#555" }}>
                    {e.location_name || "—"} {hasCoords(e) && (<> · <a href={mapsUrl(e)} target="_blank" rel="noreferrer">Maps</a></>)}
                  </div>
                </div>
              ))}
              {c.items.length === 0 && <div style={{ fontSize: 12, color: "#aaa" }}>—</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Map View ---------- */
function MapView({ baseEvents }) {
  const points = useMemo(() => {
    const m = new Map();
    baseEvents.forEach(e => {
      if (!hasCoords(e)) return;
      const key = `${+e.lat},${+e.lon}`;
      if (!m.has(key)) m.set(key, { lat: +e.lat, lon: +e.lon, items: [] });
      m.get(key).items.push(e);
    });
    for (const p of m.values()) {
      p.items.sort((a,b) => {
        const wd = (weekdayOrder[a.weekday] ?? 99) - (weekdayOrder[b.weekday] ?? 99);
        if (wd !== 0) return wd;
        return (a.start_time || "").localeCompare(b.start_time || "");
      });
    }
    return Array.from(m.values());
  }, [baseEvents]);

  const positions = points.map(p => [p.lat, p.lon]);
  const zurich = [47.3769, 8.5417];

  return (
    <div style={{ height: 560, borderRadius: 12, overflow: "hidden", border: "1px solid #e5e7eb" }}>
      <MapContainer center={zurich} zoom={12} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <AutoFitBounds points={positions} fallbackCenter={zurich} />
        {points.map((p, i) => (
          <Marker key={i} position={[p.lat, p.lon]}>
            <Popup>
              <div style={{ minWidth: 220 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>
                  {p.items[0]?.club || "Running club"}
                </div>
                <div style={{ display: "grid", gap: 4 }}>
                  {p.items.slice(0,6).map((e, j) => (
                    <div key={j} style={{ fontSize: 13 }}>
                      {capitalize(e.weekday)} {e.start_time || "—"} · <strong>{e.location_name || "—"}</strong> {formatDistancesInline(e)}
                    </div>
                  ))}
                  {p.items.length > 6 && (
                    <div style={{ fontSize: 12, color: "#666" }}>+{p.items.length - 6} more…</div>
                  )}
                </div>
                <div style={{ marginTop: 8 }}>
                  <a href={`https://www.google.com/maps?q=${p.lat},${p.lon}`} target="_blank" rel="noreferrer">Open in Google Maps</a>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

function AutoFitBounds({ points, fallbackCenter }) {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 1) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds.pad(0.2));
    } else {
      map.setView(fallbackCenter, 12);
    }
  }, [points, fallbackCenter, map]);
  return null;
}

/* ---------- Shared helpers ---------- */
function expandOccurrencesInRange(baseEvents, start, end) {
  const results = [];
  baseEvents.forEach(e => {
    const dow = JS_DOW[e.weekday];
    if (dow == null) return;
    const [hh, mm] = (e.start_time || "00:00").split(":").map(x => parseInt(x || "0", 10));
    const d0 = startOfDay(new Date(start));
    const delta = (dow - d0.getDay() + 7) % 7;
    d0.setDate(d0.getDate() + delta);
    for (let d = new Date(d0); d < end; d.setDate(d.getDate() + 7)) {
      const dt = new Date(d); dt.setHours(hh ?? 0, mm ?? 0, 0, 0);
      results.push({ ...e, startDate: dt, startISO: dt.toISOString() });
    }
  });
  results.sort((a,b) => a.startDate - b.startDate);
  return results;
}

function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function isToday(d) { const t = new Date(); return d.getFullYear()===t.getFullYear() && d.getMonth()===t.getMonth() && d.getDate()===t.getDate(); }
function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
function hasCoords(e) { return Number.isFinite(+e.lat) && Number.isFinite(+e.lon); }
function mapsUrl(e) { return `https://www.google.com/maps?q=${e.lat},${e.lon}`; }

function normalizeUrl(u = "") {
  try {
    const url = new URL(u);
    url.hash = "";
    if (url.pathname.endsWith("/")) url.pathname = url.pathname.slice(0, -1);
    return url.toString();
  } catch {
    return (u || "").trim();
  }
}
function sameUrl(a, b) { return normalizeUrl(a) === normalizeUrl(b); }
function getInstagramUrl(e) {
  if (e?.instagram_url) return e.instagram_url;
  if (typeof e?.source_url === "string" && e.source_url.includes("instagram.com")) return e.source_url;
  return "";
}

function getDistances(e) {
  if (Array.isArray(e.distances_km)) return e.distances_km.filter(x => Number.isFinite(+x)).map(Number);
  if (Number.isFinite(+e.distance_km)) return [Number(e.distance_km)];
  if (typeof e.distances_km === "string") {
    return e.distances_km.split(/[;,]/).map(s => s.trim()).filter(Boolean).map(Number).filter(n => Number.isFinite(n));
  }
  return [];
}
function formatDistances(e) {
  const d = getDistances(e);
  if (!d.length) return "";
  return d.join(" / ") + " km";
}
function formatDistancesInline(e) {
  const s = formatDistances(e);
  return s ? `· ${s}` : "";
}

function eventWithinDistanceRange(e, minKm, maxKm) {
  const d = getDistances(e);
  if (d.length === 0) return true; // include unknown distances
  return d.some(x => x >= minKm && x <= maxKm);
}

/* ---------- UI bits ---------- */
function TabButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: 32,
        padding: "2px 10px",
        fontSize: 14,
        lineHeight: 1,
        borderRadius: 8,
        border: active ? "1px solid #2563eb" : "1px solid #e5e7eb",
        background: active ? "rgba(37,99,235,0.08)" : "#fff",
        color: active ? "#1d4ed8" : "#111",
        fontWeight: 600,
        cursor: "pointer"
      }}
    >
      {children}
    </button>
  );
}

function DualRange({ min, max, step = 0.5, valueMin, valueMax, onChange }) {
  const pct = (v) => ((v - min) / (max - min)) * 100;

  return (
    <div style={{ position: "relative", height: 36, display: "grid" }}>
      {/* Track background */}
      <div style={{
        position: "absolute", left: 0, right: 0, top: 16,
        height: 6, borderRadius: 999, background: "#e5e7eb"
      }} />
      {/* Selected range fill */}
      <div style={{
        position: "absolute",
        left: `${pct(valueMin)}%`,
        right: `${100 - pct(valueMax)}%`,
        top: 16, height: 6, borderRadius: 999, background: "rgba(37,99,235,0.5)"
      }} />
      {/* Lower thumb */}
      <input
        type="range"
        min={min} max={max} step={step}
        value={valueMin}
        onChange={(e)=> {
          const v = Math.min(Number(e.target.value), valueMax);
          onChange({ min: v, max: valueMax });
        }}
        style={{
          position: "absolute", left: 0, right: 0, width: "100%",
          background: "transparent", WebkitAppearance: "none", appearance: "none"
        }}
      />
      {/* Upper thumb */}
      <input
        type="range"
        min={min} max={max} step={step}
        value={valueMax}
        onChange={(e)=> {
          const v = Math.max(Number(e.target.value), valueMin);
          onChange({ min: valueMin, max: v });
        }}
        style={{
          position: "absolute", left: 0, right: 0, width: "100%",
          background: "transparent", WebkitAppearance: "none", appearance: "none"
        }}
      />
      {/* Thumb styling */}
      <style>{`
        input[type="range"]::-webkit-slider-runnable-track { height: 6px; background: transparent; }
        input[type="range"]::-moz-range-track { height: 6px; background: transparent; }
        input[type="range"] { pointer-events: none; }
        input[type="range"]::-webkit-slider-thumb {
          pointer-events: auto; -webkit-appearance: none; appearance: none;
          width: 16px; height: 16px; border-radius: 50%; background: #2563eb; border: 2px solid white; box-shadow: 0 0 0 1px #93c5fd;
          margin-top: -5px;
        }
        input[type="range"]::-moz-range-thumb {
          pointer-events: auto;
          width: 16px; height: 16px; border-radius: 50%; background: #2563eb; border: 2px solid white; box-shadow: 0 0 0 1px #93c5fd;
        }
      `}</style>
    </div>
  );
}
