import { useEffect, useMemo, useState } from "react";
import events from "./data/events_phase0.json";
import races from "./data/races.json";


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
  const [view, setView] = useState("list"); // "list" | "calendar" | "map"
  const [section, setSection] = useState("community"); // ← ADD THIS

  

  // --- single-ended distance filter (max only) ---
  const distanceStats = useMemo(() => {
    const vals = events.flatMap(getDistances).filter(n => Number.isFinite(n));
    return {
      min: vals.length ? Math.floor(Math.min(...vals)) : 0,
      max: vals.length ? Math.ceil(Math.max(...vals)) : 20
    };
  }, []);

  const [distMax, setDistMax] = useState(distanceStats.max);

  const clubs = useMemo(() => {
    const set = new Map();
    events.forEach(e => { if (e.active !== false) set.set(e.club_slug, e.club); });
    return Array.from(set.entries()).sort((a,b) => a[1].localeCompare(b[1]));
  }, []);

  const filtered = useMemo(() => {
    return events
      .filter(e => e.active !== false)
      .filter(e => (clubFilter ? e.club_slug === clubFilter : true))
      .filter(e => (weekdayFilter ? e.weekday === weekdayFilter : true))
      .filter(e => eventWithinMaxDistance(e, distMax))   // ← single slider
      .sort((a,b) => {
        const wd = (weekdayOrder[a.weekday] ?? 99) - (weekdayOrder[b.weekday] ?? 99);
        if (wd !== 0) return wd;
        return (a.start_time || "").localeCompare(b.start_time || "");
      });
  }, [clubFilter, weekdayFilter, distMax]);

return (
  <div style={{ maxWidth: 1000, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
    <h1 style={{ marginBottom: 8 }}>
      Zurich Running – {section === "community" ? "Community Runs" : "Races"}
    </h1>
    <p style={{ color: "#555", marginTop: 0 }}>
      Display-only MVP. Filter by club and weekday. List · Calendar · Map.
    </p>

    {/* Top-level sections */}
    <div style={{ display: "flex", gap: 8, margin: "4px 0 12px" }}>
      <TabButton active={section==="community"} onClick={()=>setSection("community")}>Community runs</TabButton>
      <TabButton active={section==="races"} onClick={()=>setSection("races")}>Races</TabButton>
    </div>

    {section === "community" ? (
      <>
        {/* --- Community tabs --- */}
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

          {/* Distance (one slider: "up to X km") */}
          <div style={{ display: "grid", gap: 6, minWidth: 260 }}>
            <label style={{ fontSize: 14, color: "#333" }}>
              Distance (up to): <strong>{distMax}</strong> km
            </label>

            <input
              type="range"
              min={distanceStats.min}
              max={distanceStats.max}
              step="0.5"
              value={distMax}
              onChange={(e) => setDistMax(Number(e.target.value))}
            />

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="number" step="0.5"
                min={distanceStats.min} max={distanceStats.max}
                value={distMax}
                onChange={(e)=> setDistMax(Number(e.target.value))}
                style={{ width: 80 }}
              />
              <button onClick={() => setDistMax(distanceStats.max)} title="Show all distances">
                All
              </button>
            </div>
          </div>

          {(clubFilter || weekdayFilter) && (
            <button onClick={() => { setClubFilter(""); setWeekdayFilter(""); }}>
              Clear filters
            </button>
          )}
        </div>

        {/* View switch */}
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
      </>
    ) : (
      <RacesSection />
    )}
  </div>
);


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

                  if (srcIsIG) {
                    return <a href={ig} target="_blank" rel="noreferrer">Instagram</a>;
                  }
                  return (
                    <>
                      {src && <a href={src} target="_blank" rel="noreferrer">More info</a>}
                      {ig && (
                        <>
                          {" "}·{" "}
                          <a href={ig} target="_blank" rel="noreferrer">Instagram</a>
                        </>
                      )}
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

function RacesSection() {
  const [raceView, setRaceView] = useState("list"); // "list" | "calendar"
  const [typeFilter, setTypeFilter] = useState(""); // "", "city", "mountain", "mix"
  const raceDistanceStats = useMemo(() => {
    const vals = races.flatMap(r => (Array.isArray(r.distances_km) ? r.distances_km : [])).filter(n => Number.isFinite(+n)).map(Number);
    return {
      min: vals.length ? Math.floor(Math.min(...vals)) : 0,
      max: vals.length ? Math.ceil(Math.max(...vals)) : 50
    };
  }, []);
  const [raceDistMax, setRaceDistMax] = useState(raceDistanceStats.max);
  const [includePast, setIncludePast] = useState(false);

  const todayISO = new Date().toISOString().slice(0,10);

  const filtered = useMemo(() => {
    return races
      .filter(r => (typeFilter ? (r.type || "mix") === typeFilter : true))
      .filter(r => raceWithinMaxDistance(r, raceDistMax))
      .filter(r => includePast ? true : ((r.end_date || r.start_date || "") >= todayISO))
      .sort((a,b) => (a.start_date || "").localeCompare(b.start_date || ""));
  }, [typeFilter, raceDistMax, includePast]);

  return (
    <div>
      {/* Races sub-tabs */}
      <div style={{ display: "flex", gap: 8, margin: "8px 0 16px" }}>
        <TabButton active={raceView==="list"} onClick={()=>setRaceView("list")}>List</TabButton>
        <TabButton active={raceView==="calendar"} onClick={()=>setRaceView("calendar")}>Calendar</TabButton>
      </div>

      {/* Races filters */}
      <div style={{ display: "flex", gap: 12, margin: "16px 0 24px", flexWrap: "wrap" }}>
        <select
          value={typeFilter}
          onChange={(e)=>setTypeFilter(e.target.value)}
          style={{ height: 32, fontSize: 14, padding: "4px 8px", borderRadius: 8 }}
        >
          <option value="">All types</option>
          <option value="city">City / Road</option>
          <option value="mountain">Mountain / Trail</option>
          <option value="mix">Mix</option>
        </select>

        <div style={{ display: "grid", gap: 6, minWidth: 260 }}>
          <label style={{ fontSize: 14, color: "#333" }}>
            Distance (up to): <strong>{raceDistMax}</strong> km
          </label>
          <input
            type="range"
            min={raceDistanceStats.min}
            max={raceDistanceStats.max}
            step="1"
            value={raceDistMax}
            onChange={(e)=>setRaceDistMax(Number(e.target.value))}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="number" step="1"
              min={raceDistanceStats.min} max={raceDistanceStats.max}
              value={raceDistMax}
              onChange={(e)=>setRaceDistMax(Number(e.target.value))}
              style={{ width: 80 }}
            />
            <button onClick={()=>setRaceDistMax(raceDistanceStats.max)}>All</button>
          </div>
        </div>

        <label style={{ display:"inline-flex", alignItems:"center", gap:8, fontSize:14 }}>
          <input type="checkbox" checked={includePast} onChange={(e)=>setIncludePast(e.target.checked)} />
          Include past
        </label>
      </div>

      {raceView === "list" ? (
        <>
          <div style={{ marginBottom: 12, color: "#333" }}>
            Showing <strong>{filtered.length}</strong> race{filtered.length !== 1 ? "s" : ""}.
          </div>
          <RacesListView items={filtered} />
        </>
      ) : (
        <RacesCalendarView items={filtered} />
      )}
    </div>
  );
}

function RacesListView({ items }) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
      {items.map((r, idx) => (
        <li key={`${r.id}-${idx}`} style={{
          border: "1px solid #e5e7eb", borderRadius: 12, padding: 14,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>{r.name}</h3>
            <span style={{
              fontSize: 12, padding: "2px 8px", borderRadius: 999,
              border: "1px solid #e5e7eb", background: "#fff", color: "#555"
            }}>
              {capitalize(r.type || "mix")}
            </span>
          </div>

          <div style={{ marginTop: 6, color: "#555" }}>
            {formatRaceDateRange(r)}{(r.place || r.canton) ? " · " : ""}{[r.place, r.canton].filter(Boolean).join(", ")}
          </div>

          {formatCoursesLine(r) && (
            <div style={{ marginTop: 6 }}>
              <strong>Courses:</strong> {formatCoursesLine(r)}
            </div>
          )}

          {(r.website || r.guide_url || r.instagram_url) && (
            <div style={{ marginTop: 6 }}>
              {r.website && <a href={r.website} target="_blank" rel="noreferrer">Website</a>}
              {r.guide_url && <> · <a href={r.guide_url} target="_blank" rel="noreferrer">Guide</a></>}
              {r.instagram_url && <> · <a href={r.instagram_url} target="_blank" rel="noreferrer">Instagram</a></>}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function RacesCalendarView({ items }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const firstOfMonth = new Date(year, month, 1);
  const offsetToMonday = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = startOfDay(new Date(year, month, 1 - offsetToMonday));
  const gridEnd = new Date(gridStart); gridEnd.setDate(gridStart.getDate() + 42);

  // bucket races by each day in their range
  const byDay = new Map();
  items.forEach(r => {
    const s = parseISODate(r.start_date);
    if (!s) return;
    const e = parseISODate(r.end_date) || s;
    const start = startOfDay(s), end = startOfDay(e);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = ymd(d);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(r);
    }
  });
  for (const list of byDay.values()) list.sort((a,b) => (a.name || "").localeCompare(b.name || ""));

  const labels = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const cells = [];
  const cursor = new Date(gridStart);
  for (let i = 0; i < 42; i++) {
    const d = new Date(cursor);
    const key = ymd(d);
    cells.push({ date: d, inMonth: d.getMonth() === month, items: byDay.get(key) || [] });
    cursor.setDate(cursor.getDate() + 1);
  }

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
              {c.items.slice(0,4).map((r, idx) => (
                <div key={idx} style={{ fontSize: 13, lineHeight: 1.25, padding: "6px 8px",
                  borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff" }}>
                  <div style={{ fontWeight: 600 }}>{r.name}</div>
                  <div style={{ color: "#555" }}>
                    {formatCoursesLine(r, 2)}
                  </div>
                </div>
              ))}
              {c.items.length > 4 && <div style={{ fontSize: 12, color: "#aaa" }}>+{c.items.length - 4} more…</div>}
              {c.items.length === 0 && <div style={{ fontSize: 12, color: "#aaa" }}>—</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
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
function isToday(d) {
  const t = new Date(); return d.getFullYear()===t.getFullYear() && d.getMonth()===t.getMonth() && d.getDate()===t.getDate();
}
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
function sameUrl(a, b) {
  return normalizeUrl(a) === normalizeUrl(b);
}
function getInstagramUrl(e) {
  if (e?.instagram_url) return e.instagram_url;
  if (typeof e?.source_url === "string" && e.source_url.includes("instagram.com")) return e.source_url;
  return "";
}


function getDistances(e) {
  // Prefer array
  if (Array.isArray(e.distances_km)) return e.distances_km.filter(x => Number.isFinite(+x)).map(Number);
  // Fallback: single number
  if (Number.isFinite(+e.distance_km)) return [Number(e.distance_km)];
  // Fallback: string like "5;7"
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

function eventWithinMaxDistance(e, maxKm) {
  const d = getDistances(e);
  if (d.length === 0) return true;      // include unknown distances
  return d.some(x => x <= maxKm);
}

function parseISODate(iso) {
  if (!iso) return null;
  const [y,m,d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m-1, d);
}

function raceWithinMaxDistance(r, maxKm) {
  const d = Array.isArray(r.distances_km) ? r.distances_km : [];
  if (!d.length) return true; // include if unknown
  return d.some(x => Number(x) <= maxKm);
}

function zipCourses(r) {
  const d = (r.distances_km || []).map(Number).filter(n=>Number.isFinite(n));
  const e = (r.elevation_gain_m || []).map(Number).filter(n=>Number.isFinite(n));
  if (!d.length) return [];
  const n = e.length ? Math.min(d.length, e.length) : d.length;
  const arr = [];
  for (let i=0;i<n;i++) arr.push({ km: d[i], elev: e.length ? e[i] : null });
  return arr;
}

function fmtNum(n) {
  // strip trailing .0
  return (Math.abs(n - Math.round(n)) < 1e-9) ? String(Math.round(n)) : String(n);
}

function formatCoursesLine(r, maxItems = 99) {
  const pairs = zipCourses(r);
  if (!pairs.length) return "";
  const parts = pairs.slice(0, maxItems).map(p => p.elev != null ? `${fmtNum(p.km)} km ↑${fmtNum(p.elev)} m` : `${fmtNum(p.km)} km`);
  const extra = pairs.length - maxItems;
  return extra > 0 ? parts.join(" · ") + ` · +${extra} more` : parts.join(" · ");
}

function formatRaceDateRange(r) {
  if (!r.start_date) return "Date TBA";
  if (!r.end_date || r.end_date === r.start_date) return r.start_date;
  return `${r.start_date} – ${r.end_date}`;
}


function TabButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: 32,                 // ← force height
        padding: "2px 10px",
        fontSize: 14,               // ← smaller text
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
}
