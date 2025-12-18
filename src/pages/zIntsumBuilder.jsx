import { useState, useMemo, useEffect } from "react";
import { generateDocx } from "../components/documentBuilder"; 

export default function IntsumBuilder({ initialReports }) {
  // --- State ---
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [customStart, setCustomStart] = useState(""); 
  const [customEnd, setCustomEnd] = useState("");
  
  const [reports, setReports] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [generatedRangeLabel, setGeneratedRangeLabel] = useState("");

  const [summary, setSummary] = useState("");
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [summaryErr, setSummaryErr] = useState(null);

  // New State for Captions (Key: reportId, Value: string)
  const [captions, setCaptions] = useState({});

  const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
  const API_KEY = import.meta.env.VITE_API_KEY;
  const IMG_API_KEY = import.meta.env.VITE_IMAGE_UPLOAD_API_KEY;

  // --- Effect: Load imported reports if they exist ---
  useEffect(() => {
    if (initialReports && initialReports.length > 0) {
      setReports(initialReports);
      setGeneratedRangeLabel("Imported Search Results");
      setErr(null);
      setSummary("");
      setCaptions({});
    }
  }, [initialReports]);

  // --- Configuration: Category Definitions ---
  const CATEGORY_DEFINITIONS = {
    "Israel-Hamas Ceasefire": ["ISRAEL", "GAZA", "GAZA STRIP", "WEST BANK", "PALESTINE", "PALESTINIAN TERRITORY", "ISR", "PSE", "XGZ", "XWB"],
    "Levant": ["LEBANON", "SYRIA", "JORDAN", "TURKEY", "CYPRUS", "LBN", "SYR", "JOR", "TUR", "CYP"],
    "Iranian Threat Network": ["IRAN", "IRN"],
    "Iraq": ["IRAQ", "IRQ"],
    "Arabian Peninsula": ["YEMEN", "SAUDI ARABIA", "QATAR", "UAE", "KUWAIT", "OMAN", "BAHRAIN", "UNITED ARAB EMIRATES", "YEM", "SAU", "QAT", "ARE", "KWT", "OMN", "BHR"],
    "Pakistan": ["PAKISTAN", "PAK"]
  };

  const SECTION_ORDER = ["Israel-Hamas Ceasefire", "Levant", "Iranian Threat Network", "Iraq", "Arabian Peninsula", "Pakistan", "Additional Reporting"];

  // --- Helper: Categorize Report ---
  const getCategory = (r) => {
    const country = (r.country || "").toUpperCase().trim();
    for (const [section, keywords] of Object.entries(CATEGORY_DEFINITIONS)) {
        if (keywords.includes(country)) return section;
        if (keywords.some(k => country.includes(k))) return section;
    }
    return "Additional Reporting";
  };

  // --- Helper: Parse DTG ---
  const parseDtgFromTitle = (title) => {
    if (!title) return null;
    const regex = /^(\d{2})(\d{4})Z([A-Z]{3})(\d{2})_/i;
    const match = title.match(regex);
    if (!match) return null;
    const [_, day, time, monStr, yearShort] = match;
    const hours = time.substring(0, 2);
    const mins = time.substring(2, 4);
    const months = { JAN:0, FEB:1, MAR:2, APR:3, MAY:4, JUN:5, JUL:6, AUG:7, SEP:8, OCT:9, NOV:10, DEC:11 };
    const month = months[monStr.toUpperCase()];
    const year = 2000 + parseInt(yearShort, 10);
    return new Date(Date.UTC(year, month, parseInt(day), parseInt(hours), parseInt(mins)));
  };

  const toApiDate = (dateObj) => dateObj.toISOString().split("T")[0];

  // --- Fetch Logic ---
  const handleFetch = async (startObj, endObj, label) => {
    setLoading(true);
    setErr(null);
    setReports([]);
    setSummary(""); 
    setCaptions({});
    setGeneratedRangeLabel(label);

    try {
      const apiFrom = toApiDate(startObj);
      const apiTo = toApiDate(endObj);
      const url = `${API_URL}/reports?created_from=${apiFrom}&created_to=${apiTo}&limit=500`;

      const res = await fetch(url, {
        headers: { "x-api-key": API_KEY, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rawRows = data.results || [];

      const validReports = rawRows.filter(r => {
        const dtgDate = parseDtgFromTitle(r.title);
        if (!dtgDate) return false;
        return dtgDate >= startObj && dtgDate <= endObj;
      });

      validReports.sort((a, b) => {
        const da = parseDtgFromTitle(a.title);
        const db = parseDtgFromTitle(b.title);
        return da - db;
      });

      setReports(validReports);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  };

  // --- Summary Generation ---
  const handleGenerateSummary = async () => {
    if (reports.length === 0) return;
    setGeneratingSummary(true);
    setSummaryErr(null);

    try {
      const reportBodies = reports.map(r => r.report_body);
      const res = await fetch(`${API_URL}/intsum`, {
        method: "POST",
        headers: { "x-api-key": API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ reports: reportBodies })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.summary) setSummary(data.summary);
      else throw new Error("No summary returned");
    } catch (e) {
      setSummaryErr(String(e));
    } finally {
      setGeneratingSummary(false);
    }
  };

  // --- Download Handler ---
  const handleDownloadDocx = () => {
    generateDocx({
      reports,
      displayList,
      summary,
      rangeLabel: generatedRangeLabel,
      uniqueRequirements,
      hasUsper,
      captions,
      reportCitationMap,
      apiKey: API_KEY,
      imageApiKey: IMG_API_KEY
    });
  };

  // --- Standard Ranges ---
  const fetchLast24 = () => {
    const now = new Date();
    const end = new Date(now);
    end.setUTCHours(16, 0, 0, 0);
    if (now < end) end.setUTCDate(end.getUTCDate() - 1);
    const start = new Date(end);
    start.setUTCDate(end.getUTCDate() - 1);
    handleFetch(start, end, `Last 24 Hours (${fmtDateTime(start)} - ${fmtDateTime(end)})`);
  };

  const fetchLast12 = () => {
    const end = new Date();
    const start = new Date(end.getTime() - (12 * 60 * 60 * 1000));
    handleFetch(start, end, `Last 12 Hours (${fmtDateTime(start)} - ${fmtDateTime(end)})`);
  };

  const fetchCustom = () => {
    if (!customStart || !customEnd) return;
    handleFetch(new Date(customStart), new Date(customEnd), "Custom Range");
  };

  // --- Sorting & Categorization Logic ---
  const displayList = useMemo(() => {
    if (reports.length === 0) return [];
    
    // === NEW LOGIC: Single Group for Imports ===
    if (generatedRangeLabel === "Imported Search Results") {
        return [
            { type: "HEADER", title: "RFI Results" },
            ...reports.map(r => ({ type: "REPORT", data: r }))
        ];
    }

    // === ORIGINAL LOGIC: Regional Grouping ===
    const groups = {};
    SECTION_ORDER.forEach(sec => groups[sec] = []);
    reports.forEach(r => {
        const cat = getCategory(r);
        if (groups[cat]) groups[cat].push(r);
        else groups["Additional Reporting"].push(r);
    });

    const flatList = [];
    SECTION_ORDER.forEach(sec => {
        flatList.push({ type: "HEADER", title: sec });
        if (groups[sec].length > 0) groups[sec].forEach(r => flatList.push({ type: "REPORT", data: r }));
        else flatList.push({ type: "NSTR" });
    });
    return flatList;
  }, [reports, generatedRangeLabel]);

  const reportCitationMap = useMemo(() => {
      const map = new Map();
      let counter = 1;
      displayList.forEach(item => {
          if (item.type === "REPORT") map.set(item.data.id, counter++);
      });
      return map;
  }, [displayList]);

  const uniqueRequirements = useMemo(() => {
    const set = new Set();
    reports.forEach(r => {
      let reqs = r.requirements;
      if (typeof reqs === "string") {
        if (reqs.startsWith("{")) reqs = reqs.slice(1, -1).split(",");
        else reqs = [reqs];
      }
      if (Array.isArray(reqs)) reqs.forEach(req => { if(req) set.add(req.trim().replace(/^"|"$/g, '')); });
    });
    return Array.from(set).join("; ");
  }, [reports]);

  const hasUsper = useMemo(() => reports.some(r => r.is_usper || r.has_uspi), [reports]);

  // --- Caption Update Helper ---
  const updateCaption = (id, text) => {
    setCaptions(prev => ({ ...prev, [id]: text }));
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      
      {/* --- Controls --- */}
      <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 space-y-4">
        <div className="flex justify-between items-start">
            <h2 className="text-lg font-bold text-slate-100">INTSUM Builder</h2>
            <div className="flex flex-col items-end gap-2">
                <div className="flex gap-2">
                    <button
                        onClick={handleDownloadDocx}
                        disabled={reports.length === 0}
                        className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        Download .docx
                    </button>

                    <button
                        onClick={handleGenerateSummary}
                        disabled={reports.length === 0 || generatingSummary || loading}
                        className="px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {generatingSummary ? "Generating..." : "Generate Summary"}
                    </button>
                </div>
                {summaryErr && <span className="text-xs text-red-400 mt-1">{summaryErr}</span>}
            </div>
        </div>
        
        <div className="flex flex-wrap gap-4 items-end">
          <button onClick={fetchLast24} disabled={loading} className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded font-medium disabled:opacity-50">
            Last 24 hours (1600Z - 1600Z)
          </button>
          <button onClick={fetchLast12} disabled={loading} className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded font-medium disabled:opacity-50 ml-2">
            Last 12 Hours
          </button>
          <div className="h-8 w-px bg-slate-600 mx-2 hidden sm:block"></div>
          <button onClick={() => setUseCustomRange(!useCustomRange)} className="text-sm text-blue-400 underline self-center">
            {useCustomRange ? "Hide Custom Range" : "Use Custom Range"}
          </button>
        </div>

        {useCustomRange && (
          <div className="flex flex-wrap gap-4 items-end bg-slate-900/50 p-3 rounded">
            <input type="datetime-local" className="bg-slate-700 border border-slate-600 text-white text-sm rounded px-2 py-1" onChange={e => setCustomStart(e.target.value)} />
            <input type="datetime-local" className="bg-slate-700 border border-slate-600 text-white text-sm rounded px-2 py-1" onChange={e => setCustomEnd(e.target.value)} />
            <button onClick={fetchCustom} disabled={loading || !customStart || !customEnd} className="px-4 py-1.5 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded">Fetch</button>
          </div>
        )}
        {err && <div className="text-red-400 text-sm bg-red-900/20 p-2 rounded border border-red-900">{err}</div>}
      </div>

      {/* --- Document Output --- */}
      {reports.length > 0 && (
        <div className="bg-white text-black p-8 rounded shadow-xl font-['Arial'] text-[12pt] max-w-[21cm] mx-auto min-h-[29.7cm]">
          
          <div className="mb-6 border-b-2 border-black pb-4">
             <h1 className="text-xl font-bold text-center underline uppercase mb-2">513th OSINT Daily Reporting Roll-Up</h1>
             <p className="text-center text-sm font-bold text-gray-600 uppercase">{generatedRangeLabel}</p>
          </div>

          {uniqueRequirements && (
            <div className="mb-6 text-sm">
                <span className="font-bold">(CUI//REL TO USA, FVEY) REQUIREMENT NUMBER(S): </span>
                <span>{uniqueRequirements}</span>
            </div>
          )}

          <div className="mb-6 text-sm border border-black p-2 bg-gray-50">
            <span className="font-bold underline">WARNING:</span> This is an information report, not finally evaluated intelligence. MGRS locations are for general reference purposes only and do not represent the actual location of events unless otherwise specified.
            {hasUsper && (
              <span> This report or its enclosure(s) contains U.S. Person Information that has been deemed necessary for the intended mission, need to understand, assess, or act on the information provided, in accordance with (IAW) DoD Manual 5240.01 and Executive Order 12333. It should be handled IAW the recipient's intelligence oversight or information handling procedures.</span>
            )}
            <p className="mt-2 text-xs text-gray-500 italic">Summary produced via AI model; review for accuracy.</p>
          </div>

          {summary && (
            <div className="mb-6 text-justify leading-relaxed">
                <p><span className="font-bold">(CUI) SUMMARY: </span>{summary}</p>
            </div>
          )}

          <div className="space-y-4">
            {displayList.map((item, i) => {
              if (item.type === "HEADER") {
                  return <div key={`h-${i}`} className="pt-2"><h3 className="text-center font-bold underline uppercase text-sm">{item.title}</h3></div>;
              }
              if (item.type === "NSTR") {
                  return <div key={`nstr-${i}`} className="text-sm pl-0 mb-4">NSTR</div>;
              }

              const r = item.data;
              const citationId = reportCitationMap.get(r.id);
              return (
                  <ReportItem 
                      key={r.id || i} 
                      r={r} 
                      citationId={citationId} 
                      parseDtgFromTitle={parseDtgFromTitle} 
                      caption={captions[r.id] || ""} 
                      onCaptionChange={(txt) => updateCaption(r.id, txt)}
                  />
              );
            })}
          </div>

          <div className="mt-12 pt-4 border-t border-black text-xs">
            <h3 className="font-bold uppercase mb-2">Sources / Citations</h3>
            <ol className="list-decimal list-inside space-y-2">
                {displayList.filter(i => i.type === "REPORT").map((item, i) => {
                    const r = item.data;
                    return (
                        <li key={i} className="break-words">
                            (U) {cleanSourceType(r.source_platform)} | {r.is_usper ? "(USPER) " : ""}{r.source_name} | {r.uid || "N/A"} | {parseDtgFromTitle(r.title) ? makeDTGString(parseDtgFromTitle(r.title)) : "UNKNOWN"} | UNCLASSIFIED | U.S. Person: {r.is_usper || r.has_uspi ? "YES" : "NO"}
                        </li>
                    );
                })}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Report Item & Helpers (Unchanged) ---
function ReportItem({ r, citationId, parseDtgFromTitle, caption, onCaptionChange }) {
    const [imgUrl, setImgUrl] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    
    const IMG_API_KEY = import.meta.env.VITE_IMAGE_UPLOAD_API_KEY;

    useEffect(() => {
        if (!r.image_url) {
            setImgUrl(null);
            return;
        }

        let cancel = false;
        const fetchImage = async () => {
            try {
                const res = await fetch(r.image_url, { 
                    headers: { "x-api-key": IMG_API_KEY } 
                });
                if (!res.ok) throw new Error("Image fetch failed");
                const blob = await res.blob();
                if (!cancel) setImgUrl(URL.createObjectURL(blob));
            } catch (err) {
                console.error("Failed to load image for report", r.id, err);
            }
        };
        fetchImage();
        return () => { 
            cancel = true; 
            if (imgUrl) URL.revokeObjectURL(imgUrl);
        };
    }, [r.image_url, IMG_API_KEY]);

    const dtg = parseDtgFromTitle(r.title);
    const dtgStr = dtg ? makeDTGString(dtg) : "UNKNOWN";
    const classif = `(${classificationForOutput(r.overall_classification)})`;
    const collectorClassif = `(${classificationForOutput(r.collector_classification)})`;

    return (
        <div className="text-justify leading-relaxed mb-4 break-inside-avoid">
            <div className="mb-1">
                <span className="font-bold">{classif} On {dtgStr}, {cleanSourceType(r.source_platform)} {r.is_usper ? "(USPER)" : ""} {r.source_name} </span>
                <p><span>{r.did_what} {r.report_body}</span>
                <sup className="font-bold text-xs ml-0.5">[{citationId}]</sup>
                <div className="mt-1">({r.mgrs})</div></p>
            </div>

            <div className="mt-4">
                <span className="font-bold">{collectorClassif} COLLECTOR COMMENT: </span>
                {r.source_description} {r.additional_comment_text}
            </div>

            {imgUrl && (
                <div className="mt-4 flex flex-col items-center">
                    <img 
                        src={imgUrl} 
                        alt="Report attachment" 
                        className="max-w-[80%] max-h-[350px] object-contain border border-gray-200 shadow-sm" 
                    />
                    <div className="mt-1 text-center">
                        {isEditing ? (
                            <input 
                                autoFocus
                                className="text-[8pt] text-center border-b border-gray-400 outline-none w-64 bg-transparent"
                                value={caption}
                                onChange={(e) => onCaptionChange(e.target.value)}
                                onBlur={() => setIsEditing(false)}
                                onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
                            />
                        ) : (
                            <div 
                                onClick={() => setIsEditing(true)} 
                                className={`text-[8pt] cursor-pointer select-none ${caption ? "text-black font-bold uppercase" : "text-gray-400 italic"}`}
                            >
                                {caption || "Click to add caption"}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function classificationForOutput(val) {
    if (val === "U") return "U";
    if (val === "CUI") return "CUI";
    if (val === "CUIREL") return "CUI//REL TO USA, FVEY";
    return String(val || "U");
}
function makeDTGString(date) {
    if (!date) return "";
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    const mmm = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
    const yy = String(date.getUTCFullYear()).slice(-2);
    return `${dd}${hh}${mm}Z${mmm}${yy}`;
}
function cleanSourceType(t) { return t ? t.replace(/\s*User$/i, "").trim() : ""; }
function fmtDateTime(d) { return d.toISOString().replace("T", " ").slice(0, 16) + "Z"; }