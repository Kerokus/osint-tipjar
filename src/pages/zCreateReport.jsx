// src/pages/CreateReport.jsx

import { useEffect, useRef, useState } from "react";
import SectionHeader from "../components/report_sections/SectionHeader";
import SectionA from "../components/report_sections/SectionA_Metadata";
import SectionB from "../components/report_sections/SectionB_Source";
import SectionC from "../components/report_sections/SectionC_Body";
import SectionD from "../components/report_sections/SectionD_Outputs";

// Helper functions that were previously in SectionA
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

export default function CreateReport() {
  // All state is now "lifted" to this parent component
  // State for Section A
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

  // State for Section B
  const [usper, setUsper] = useState(false);
  const [uspi, setUspi] = useState(false);
  const [sourceType, setSourceType] = useState("Website");
  const [sourceName, setSourceName] = useState("");
  const [didWhat, setDidWhat] = useState("reported");
  const [uid, setUid] = useState("");
  const [articleTitle, setArticleTitle] = useState("N/A");
  const [articleAuthor, setArticleAuthor] = useState("N/A");

  // Logic/effects that were previously in SectionA
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
      });
  }, []);
  useEffect(() => {
    fetch("/country_locations/country_list.json")
      .then((r) => r.json())
      .then((data) => {
        const list = (data[macom] || []).slice().sort((a, b) => a.localeCompare(b));
        setCountries(list);
        setCountry("");
      });
  }, [macom]);

  const debounceRef = useRef(null);
  useEffect(() => {
    if (!country || !location) { setResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      let db;
      try {
        db = await openCountryDb(country);
        const stmt = db.prepare(`
          SELECT l.location as location, l.mgrs as mgrs, p.province as province
          FROM Locations l
          JOIN Provinces p ON l.province_id = p.id
          WHERE lower(' ' || l.location || ' ') LIKE '% ' || lower(?) || ' %'
          ORDER BY l.location ASC;
        `);
        const rows = [];
        stmt.bind([location]);
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        setResults(rows);
      } catch (err) {
        console.error("Database error:", err);
        setResults([]);
      }
      finally {
        if (db) {
          db.close();
        }
        setLoading(false);
      }
    }, 800);
    return () => clearTimeout(debounceRef.current);
  }, [country, location]);

  const onDrop = (e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setImgFile(f); };
  const onChoose = (e) => { const f = e.target.files?.[0]; if (f) setImgFile(f); };

  // The clearForm function now resets state for both sections
  const clearForm = () => {
    // Section A state reset
    setMacom("CENTCOM"); setCountry(""); setLocation(""); setMgrs(""); setResults([]); setImgFile(null);
    // Section B state reset
    setUsper(false); setUspi(false); setSourceType("Website"); setSourceName("");
    setDidWhat("reported"); setUid(""); setArticleTitle("N/A"); setArticleAuthor("N/A");
  };

  return (
    <div>
      <SectionHeader />
      {/* Pass all necessary state and functions down to SectionA as props */}
      <SectionA
        dateStr={dateStr} setDateStr={setDateStr}
        timeStr={timeStr} setTimeStr={setTimeStr}
        cin={cin}
        macoms={macoms} macom={macom} setMacom={setMacom}
        countries={countries} country={country} setCountry={setCountry}
        location={location} setLocation={setLocation}
        mgrs={mgrs} setMgrs={setMgrs}
        results={results} loading={loading}
        imgFile={imgFile} setImgFile={setImgFile}
        onDrop={onDrop} onChoose={onChoose} clearForm={clearForm}
      />
      <hr className="my-6 w-full border-sky-300" />
      {/* Pass all necessary state and functions down to SectionB as props */}
      <SectionB
        usper={usper} setUsper={setUsper}
        uspi={uspi} setUspi={setUspi}
        sourceType={sourceType} setSourceType={setSourceType}
        sourceName={sourceName} setSourceName={setSourceName}
        didWhat={didWhat} setDidWhat={setDidWhat}
        uid={uid} setUid={setUid}
        articleTitle={articleTitle} setArticleTitle={setArticleTitle}
        articleAuthor={articleAuthor} setArticleAuthor={setArticleAuthor}
      />
      <hr className="my-6 w-full border-sky-300" />
      <SectionC />
      <SectionD />
    </div>
  );
}