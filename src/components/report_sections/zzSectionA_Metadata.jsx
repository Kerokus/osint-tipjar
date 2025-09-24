// SectionA_Metadata.stacked.grid.jsx
import { useEffect, useRef, useState } from "react";

function formatDDMMMYY(dateUtc) {
  const d = dateUtc.getUTCDate().toString().padStart(2, "0");
  const mon = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][dateUtc.getUTCMonth()];
  const y = dateUtc.getUTCFullYear().toString().slice(-2);
  return `${d}${mon}${y}`;
}
function formatHHmmUTC(dateUtc) {
  const h = dateUtc.getUTCHours().toString().padStart(2, "0");
  const m = dateUtc.getUTCMinutes().toString().padStart(2, "0");
  return `${h}${m}`;
}
async function loadSql() {
  const initSqlJs = (await import("sql.js")).default;
  return await initSqlJs({ locateFile: (f) => `/vendor/${f}` });
}
async function openCountryDb(country) {
  const encoded = encodeURIComponent(`${country}.db`);
  const res = await fetch(`/country_locations/${encoded}`);
  if (!res.ok) throw new Error(`DB fetch failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  const SQL = await loadSql();
  return new SQL.Database(new Uint8Array(buf));
}

export default function SectionA_Metadata() {
  const [dateStr, setDateStr] = useState("");
  const [timeStr, setTimeStr] = useState("");
  const [cin] = useState(() => localStorage.getItem("cin") || "");
  const [macoms, setMacoms] = useState(["CENTCOM"]);
  const [macom, setMacom] = useState("CENTCOM");
  const [countries, setCountries] = useState([]);
  const [country, setCountry] = useState("");
  const [location, setLocation] = useState("");
  const [mgrs, setMgrs] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [imgFile, setImgFile] = useState(null);

  useEffect(() => {
    const now = new Date();
    setDateStr(formatDDMMMYY(now));
    setTimeStr(formatHHmmUTC(now));
  }, []);
  useEffect(() => {
    fetch("/country_locations/country_list.json")
      .then((r) => r.json())
      .then((data) => {
        setMacoms(Object.keys(data));
        const def = data["CENTCOM"] || [];
        setCountries(def.slice().sort((a, b) => a.localeCompare(b)));
        if (def.length) setCountry(def[0]);
      });
  }, []);
  useEffect(() => {
    fetch("/country_locations/country_list.json")
      .then((r) => r.json())
      .then((data) => {
        const list = (data[macom] || []).slice().sort((a, b) => a.localeCompare(b));
        setCountries(list);
        if (!list.includes(country)) setCountry(list[0] || "");
      });
  }, [macom]);

  const debounceRef = useRef(null);
  useEffect(() => {
    if (!country || !location) { setResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const db = await openCountryDb(country);
        const stmt = db.prepare(`
          SELECT l.location as location, l.mgrs as mgrs, p.province as province
          FROM Locations l
          JOIN Provinces p ON l.province_id = p.id
          WHERE lower(l.location) LIKE '%' || lower(?) || '%'
          ORDER BY l.location ASC;
        `);
        const rows = [];
        stmt.bind([location]);
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free(); db.close();
        setResults(rows);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 800);
    return () => clearTimeout(debounceRef.current);
  }, [country, location]);

  const onDrop = (e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setImgFile(f); };
  const onChoose = (e) => { const f = e.target.files?.[0]; if (f) setImgFile(f); };
  const clearForm = () => { setMacom("CENTCOM"); setCountry(""); setLocation(""); setMgrs(""); setResults([]); setImgFile(null); };

  return (
    <section>
      <div className="grid grid-cols-12 gap-3">
        {/* Top row */}
        <div className="col-span-12 md:col-span-2">
          <label className="block text-xs">Date of Information (UTC)</label>
          <input value={dateStr} onChange={(e) => setDateStr(e.target.value)} className="w-full h-9 rounded-md bg-slate-900 border border-slate-700 px-3" />
        </div>
        <div className="col-span-6 md:col-span-1">
          <label className="block text-xs">Time (UTC)</label>
          <input value={timeStr} onChange={(e) => setTimeStr(e.target.value)} className="w-full h-9 rounded-md bg-slate-900 border border-slate-700 px-3" />
        </div>
        <div className="col-span-6 md:col-span-2">
          <label className="block text-xs">CIN</label>
          <input value={cin} readOnly className="w-full h-9 rounded-md bg-slate-800 border border-slate-700 px-3" />
        </div>
        <div className="col-span-12 md:col-span-3 flex gap-2 items-end">
          <button onClick={clearForm} className="flex-1 h-9 rounded-md bg-slate-800 border border-slate-600 text-red-500">Clear Form</button>
          <button className="flex-1 h-9 rounded-md bg-slate-800 border border-slate-600">Recall Last</button>
        </div>
        {/* Image uploader spans 2 rows */}
        <div className="col-span-12 md:col-span-4 md:row-span-2 flex flex-col h-full">
          <label className="block text-xs">Image</label>
          <div onDrop={onDrop} onDragOver={(e) => e.preventDefault()} className="flex-1 min-h-[152px] rounded-md border border-slate-600 bg-slate-900 grid place-items-center text-sm">
            {imgFile ? <div>{imgFile.name}</div> : <label className="cursor-pointer">Upload Image<input type="file" onChange={onChoose} className="hidden" /></label>}
          </div>
        </div>
        {/* Row 2 left stack */}
        <div className="col-span-12 md:col-span-4 md:row-start-2 flex flex-col h-full">
          <label className="block text-xs">MACOM</label>
          <select value={macom} onChange={(e) => setMacom(e.target.value)} className="w-full h-9 rounded-md bg-slate-900 border border-slate-700">
            {macoms.map(m => <option key={m}>{m}</option>)}
          </select>
          <label className="block text-xs mt-2">Country</label>
          <select value={country} onChange={(e) => setCountry(e.target.value)} className="w-full h-9 rounded-md bg-slate-900 border border-slate-700">
            {countries.map(c => <option key={c}>{c}</option>)}
          </select>
          <label className="block text-xs mt-2">Location</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full h-9 rounded-md bg-slate-900 border border-slate-700 px-3" />
          <label className="block text-xs mt-2">MGRS</label>
          <input value={mgrs} onChange={(e) => setMgrs(e.target.value)} className="w-full h-9 rounded-md bg-slate-900 border border-slate-700 px-3" />
        </div>
        {/* Row 2 MGRS results */}
        <div className="col-span-12 md:col-span-4 md:row-start-2 flex flex-col h-full">
          <label className="block text-xs text-center">MGRS Results</label>
          <div className="flex-1 min-h-[152px] overflow-auto rounded-md border border-slate-700 bg-slate-900">
            {loading ? <div>Searching…</div> : results.length === 0 ? <div>No results</div> : (
              <ul>
                {results.map((r, idx) => (
                  <li key={idx} className="px-2 py-1 hover:bg-slate-800 cursor-pointer" onClick={() => setMgrs(r.mgrs)}>
                    <div>{r.location}</div>
                    <div className="text-xs">Province: {r.province} • MGRS: {r.mgrs}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
