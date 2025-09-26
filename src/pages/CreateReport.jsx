import { useEffect, useRef, useState } from "react";
import SectionHeader from "../components/report_sections/SectionHeader";
import SectionA from "../components/report_sections/SectionA_Metadata";
import SectionB from "../components/report_sections/SectionB_Source";

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

// === New helpers for Chat Output auto-generation ===
function classificationForOutput(val) {
  if (val === "U") return "U";
  if (val === "CUI") return "CUI";
  if (val === "CUIREL") return "CUI//REL TO USA, FVEY";
  return String(val || "");
}

function makeDTG(dateStr, timeStr) {
  // Inputs expected as: dateStr = DDMMMYY, timeStr = HHmm (UTC)
  if (!dateStr || dateStr.length < 7 || !timeStr || timeStr.length < 4) return "";
  const DD = dateStr.slice(0, 2);
  const MMM = dateStr.slice(2, 5).toUpperCase();
  const YY = dateStr.slice(5, 7);
  // Assume 2000s for YY; preserves existing behavior of dateStr
  const HH = timeStr.slice(0, 2);
  const MM = timeStr.slice(2, 4);
  return `${DD}${HH}${MM}Z${MMM}${YY}`;
}

export default function CreateReport() {
  // Overall classification state
  const [overallClass, setOverallClass] = useState("U");
  const rank = { U: 0, CUI: 1, CUIREL: 2 }; // U < CUI < CUI//REL TO USA, FVEY
  const maxClass = (...vals) => vals.reduce((a, b) => (rank[b] > rank[a] ? b : a), "U");

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

  // New state for Column 1 under the second blue line
  const [reportBody, setReportBody] = useState("");
  const [collectorClass, setCollectorClass] = useState("U");
  const [sourceDescription, setSourceDescription] = useState("");
  const [additionalComment, setAdditionalComment] = useState("");

  // New state for Column 2
  const [chatChannel, setChatChannel] = useState("Placeholder 1");
  const [chatOutput, setChatOutput] = useState("");
  const [reportOutput, setReportOutput] = useState("");
  const [citationOutput, setCitationOutput] = useState("");

  useEffect(() => {
    setOverallClass((prev) => maxClass(prev, collectorClass));
  }, [collectorClass]);

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
    if (!country || !location) {
      setResults([]);
      return;
    }
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
      } finally {
        if (db) {
          db.close();
        }
        setLoading(false);
      }
    }, 800);
    return () => clearTimeout(debounceRef.current);
  }, [country, location]);

  const onDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) setImgFile(f);
  };
  const onChoose = (e) => {
    const f = e.target.files?.[0];
    if (f) setImgFile(f);
  };

  // Copy helper
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text ?? "");
    } catch (e) {
      console.error("Copy failed:", e);
    }
  };

  //helper function for Citation Report
  function cleanSourceType(t) {
    if (!t) return "";
    return t.replace(/\s*User$/i, "").trim();
  }

  // The clearForm function now resets state for all sections
  const clearForm = () => {
    // Section A state reset
    setMacom("CENTCOM");
    setCountry("");
    setLocation("");
    setMgrs("");
    setResults([]);
    setImgFile(null);
    // Section B state reset
    setUsper(false);
    setUspi(false);
    setSourceType("Website");
    setSourceName("");
    setDidWhat("reported");
    setUid("");
    setArticleTitle("N/A");
    setArticleAuthor("N/A");
    // Column 1 new state reset
    setReportBody("");
    setCollectorClass("U");
    setSourceDescription("");
    setAdditionalComment("");
    setOverallClass("U");
    // Column 2 new state reset
    setChatChannel("Placeholder 1");
    setChatOutput("");
    setReportOutput("");
    setCitationOutput("");
  };

  // === Auto-generate Chat Output from current form state ===
  useEffect(() => {
    const oc = classificationForOutput(overallClass);
    const cc = classificationForOutput(collectorClass);
    const dtg = makeDTG(dateStr, timeStr);
    const mgrsDisp = mgrs || "";
    const srcType = sourceType || "";
    const srcName = sourceName || "";
    const action = didWhat || "";
    const body = reportBody || "";
    const cinDisp = cin || "";
    const comment = sourceDescription || "";

    const chat = `(${oc}) ${dtg} (${mgrsDisp}) ${srcType} ${srcName} | (U) ${action} ${body} (MGRS FOR REFERENCE ONLY. PUBLICLY AVAILABLE INFORMATION: SOURCE IS UNVERIFIED) | ${cinDisp} | (${cc}) COLLECTOR COMMENT: ${comment} (${oc})`;
    setChatOutput(chat.trim());
  }, [
    overallClass,
    dateStr,
    timeStr,
    mgrs,
    sourceType,
    sourceName,
    didWhat,
    reportBody,
    cin,
    collectorClass,
    sourceDescription
  ]);
  // Auto-generate Report Output from current form state ===
  useEffect(() => {
    const oc = classificationForOutput(overallClass);
    const cc = classificationForOutput(collectorClass);
    const dtg = makeDTG(dateStr, timeStr);
    const srcType = sourceType || "";
    const usPerson = usper ? "(USPER) " : "";
    const srcName = sourceName || "";
    const action = didWhat || "";
    const body = reportBody || "";
    const mgrsDisp = mgrs || "";
    const desc = sourceDescription || "";

    const report = `(${oc}) On ${dtg}, ${srcType} ${usPerson}${srcName}\n${action} ${body}\n(${mgrsDisp})\n\n(${cc}) ${desc}`;
    setReportOutput(report.trim());
  }, [
    overallClass,
    collectorClass,
    dateStr,
    timeStr,
    sourceType,
    usper,
    sourceName,
    reportBody,
    mgrs,
    sourceDescription
  ]);

  // Auto-generate Citation Output from current form state ===
  useEffect(() => {
  const oc = classificationForOutput(overallClass);
  const dtg = makeDTG(dateStr, timeStr);
  const srcType = cleanSourceType(sourceType || "");
  const srcName = sourceName || "";
  const uidDisp = uid || "";
  const usPerson = (usper || uspi) ? "YES" : "NO";

  const citation = `(${oc}) ${srcType} | ${srcName} | ${uidDisp} | ${dtg} | UNCLASSIFIED | U.S. Person: ${usPerson}`;
  setCitationOutput(citation.trim());
}, [overallClass, dateStr, timeStr, sourceType, sourceName, uid, usper, uspi]);  


  // Badge logic
  const sourceBadge = (() => {
    if (usper) {
      return (
        <div className="ml-3 inline-flex shrink-0 items-center justify-center h-7 px-3 rounded-md bg-red-600 text-black text-xs font-bold select-none">
          SOURCE IS USPER
        </div>
      );
    }
    if (!sourceDescription.trim()) {
      return (
        <div className="ml-3 inline-flex shrink-0 items-center justify-center h-7 px-3 rounded-md bg-orange-500 text-black text-xs font-extrabold select-none">
          COMMENT NOT FOUND
        </div>
      );
    }
    return null;
  })();

  return (
    <div>
      <SectionHeader
        initialValue={overallClass}
        onChange={(p) => setOverallClass(maxClass(p.value, collectorClass))}
      />
      {/* Pass all necessary state and functions down to SectionA as props */}
      <SectionA
        dateStr={dateStr}
        setDateStr={setDateStr}
        timeStr={timeStr}
        setTimeStr={setTimeStr}
        cin={cin}
        macoms={macoms}
        macom={macom}
        setMacom={setMacom}
        countries={countries}
        country={country}
        setCountry={setCountry}
        location={location}
        setLocation={setLocation}
        mgrs={mgrs}
        setMgrs={setMgrs}
        results={results}
        loading={loading}
        imgFile={imgFile}
        setImgFile={setImgFile}
        onDrop={onDrop}
        onChoose={onChoose}
        clearForm={clearForm}
      />
      <hr className="my-6 w-full border-sky-300" />
      {/* Pass all necessary state and functions down to SectionB as props */}
      <SectionB
        usper={usper}
        setUsper={setUsper}
        uspi={uspi}
        setUspi={setUspi}
        sourceType={sourceType}
        setSourceType={setSourceType}
        sourceName={sourceName}
        setSourceName={setSourceName}
        didWhat={didWhat}
        setDidWhat={setDidWhat}
        uid={uid}
        setUid={setUid}
        articleTitle={articleTitle}
        setArticleTitle={setArticleTitle}
        articleAuthor={articleAuthor}
        setArticleAuthor={setArticleAuthor}
      />
      <hr className="my-6 w-full border-sky-300" />

      {/* === Two-column section === */}
      <div className="grid grid-cols-12 gap-4">
        {/* Column 1 */}
        <div className="col-span-12 lg:col-span-6 space-y-3">
          {/* Report Body */}
          <div>
            <label className="block text-xs">Report Body</label>
            <textarea
              value={reportBody}
              onChange={(e) => setReportBody(e.target.value)}
              className="w-full min-h-[130px] rounded-md bg-slate-900 border border-slate-700 px-3 py-2"
            />
          </div>

          {/* Collector Comment + Source Description container */}
          <div className="rounded-md border border-slate-700 bg-slate-900 p-3">
            <div className="flex items-center">
              <div className="flex-1">
                <label className="block text-xs">Collector Comment</label>
                <SectionHeader
                  initialValue={collectorClass}
                  onChange={(p) => {
                    setCollectorClass(p.value);
                    setOverallClass((prev) => maxClass(prev, p.value));
                  }}
                />
              </div>
            </div>

            <div className="mt-2">
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs">Source Description:</label>
                {sourceBadge}
              </div>
              <textarea
                value={sourceDescription}
                onChange={(e) => setSourceDescription(e.target.value)}
                disabled={usper}
                className={`w-full min-h-[120px] rounded-md border border-slate-700 px-3 py-2 ${
                  usper
                    ? "bg-slate-800 opacity-70 cursor-not-allowed"
                    : "bg-slate-900"
                }`}
              />
            </div>
          </div>

          {/* Additional Comment Text */}
          <div>
            <label className="block text-xs">Additional Comment Text</label>
            <textarea
              value={additionalComment}
              onChange={(e) => setAdditionalComment(e.target.value)}
              className="w-full min-h-[120px] rounded-md bg-slate-900 border border-slate-700 px-3 py-2"
            />
          </div>
        </div>

        {/* Column 2 */}
        <div className="col-span-12 lg:col-span-6 space-y-3">
          {/* 1. ChatSurfer Channel */}
          <div>
            <label className="block text-xs">ChatSurfer Channel</label>
            <select
              value={chatChannel}
              onChange={(e) => setChatChannel(e.target.value)}
              className="w-full h-9 rounded-md bg-slate-900 border border-slate-700"
            >
              <option>Placeholder 1</option>
              <option>Placeholder 2</option>
            </select>
          </div>

          {/* 2. Chat Output */}
          <div>
            <label className="block text-xs">Chat Output</label>
            <textarea
              value={chatOutput}
              onChange={(e) => setChatOutput(e.target.value)}
              className="w-full min-h-[160px] rounded-md bg-slate-900 border border-slate-700 px-3 py-2"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="flex-1 h-9 rounded-md bg-slate-800 border border-blue-500 text-blue-500"
                onClick={() => {}}
              >
                Send to ChatSurfer
              </button>
              <button
                type="button"
                className="flex-1 h-9 rounded-md bg-slate-800 border border-green-400 text-green-400"
                onClick={() => copy(chatOutput)}
              >
                Copy Chat Output
              </button>
            </div>
          </div>

          {/* 3. Report Output */}
          <div>
            <label className="block text-xs">Report Output</label>
            <textarea
              value={reportOutput}
              onChange={(e) => setReportOutput(e.target.value)}
              className="w-full min-h-[140px] rounded-md bg-slate-900 border border-slate-700 px-3 py-2"
            />
            <div className="mt-2">
              <button
                type="button"
                className="w-full h-9 rounded-md bg-slate-800 border border-green-400 text-green-400"
                onClick={() => copy(reportOutput)}
              >
                Copy Report Output
              </button>
            </div>
          </div>

          {/* 4. Citation Output */}
          <div>
            <label className="block text-xs">Citation Output</label>
            <textarea
              value={citationOutput}
              onChange={(e) => setCitationOutput(e.target.value)}
              className="w-full min-h-[120px] rounded-md bg-slate-900 border border-slate-700 px-3 py-2"
            />
            <div className="mt-2">
              <button
                type="button"
                className="w-full h-9 rounded-md bg-slate-800 border border-green-400 text-green-400"
                onClick={() => copy(citationOutput)}
              >
                Copy Citation Output
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* === End of two-column section === */}
    </div>
  );
}
