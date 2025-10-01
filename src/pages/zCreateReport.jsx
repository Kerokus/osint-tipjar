import { useEffect, useRef, useState } from "react";
import SectionHeader from "../components/report_sections/SectionHeader";
import SectionA from "../components/report_sections/SectionA_Metadata";
import SectionB from "../components/report_sections/SectionB_Source";
import { findSourceByName, getDirtyWords } from "../components/supportFunctions";

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

// Basic sanitizer for building titles and filenames
function slugify(s) {
  return (s || "")
    .toString()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Helper to escape special regex characters from strings
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

  // State for auto-populating source info
  const [existingSourceId, setExistingSourceId] = useState(null);
  const [sourceExists, setSourceExists] = useState(false);
  const [matchingSources, setMatchingSources] = useState([]);
  const [showSourceModal, setShowSourceModal] = useState(false);

  // New state for Column 1 under the second blue line
  const [reportBody, setReportBody] = useState("");
  const [collectorClass, setCollectorClass] = useState("U");
  const [sourceDescription, setSourceDescription] = useState("");
  const [additionalComment, setAdditionalComment] = useState("");

  // New state for Column 2
  const [displayName, setDisplayName] = useState("");
  const [chatChannel, setChatChannel] = useState("513th-idsg-test");
  const [chatOutput, setChatOutput] = useState("");
  const [reportOutput, setReportOutput] = useState("");
  const [citationOutput, setCitationOutput] = useState("");
  const [chatMessageSent, setChatMessageSent] = useState(false);

  // State for dirty word search
  const [dirtyWords, setDirtyWords] = useState([]);
  const [filterWordFound, setFilterWordFound] = useState(false);
  
  // Submit state for main report form
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitOk, setSubmitOk] = useState("");
  
  // Submit state for chat message
  const [sendingChat, setSendingChat] = useState(false);
  const [chatError, setChatError] = useState("");

  useEffect(() => {
    setDisplayName(localStorage.getItem("display_name") || "");
  }, []);

  // Fetch dirty words on component mount
  useEffect(() => {
    async function fetchWords() {
        const words = await getDirtyWords();
        setDirtyWords(words);
    }
    fetchWords();
  }, []);

  // Effect to check for dirty words in the report body
  useEffect(() => {
    if (!dirtyWords.length || !reportBody) {
        setFilterWordFound(false);
        return;
    }

    let wordFound = false;
    let highestClassification = "U";

    for (const word of dirtyWords) {
        const escapedWord = escapeRegex(word.dirty_word);
        const regex = new RegExp(`\\b${escapedWord}\\b`, 'i');
        if (regex.test(reportBody)) {
            wordFound = true;
            highestClassification = maxClass(highestClassification, word.word_classification);
        }
    }

    setFilterWordFound(wordFound);
    if (wordFound) {
        setOverallClass(prev => maxClass(prev, highestClassification));
    }
  }, [reportBody, dirtyWords, maxClass]);

  useEffect(() => {
    setOverallClass((prev) => maxClass(prev, collectorClass));
  }, [collectorClass, maxClass]);

  //If the user selects "USPER" it will remove anything in the Source Description field.
  useEffect(() => {
    if (usper) {
      setSourceDescription("");
    }
  }, [usper]);

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

  const sourceSearchDebounceRef = useRef(null);
    useEffect(() => {
    // Clear status if sourceName is empty
    if (!sourceName.trim()) {
        setSourceExists(false);
        setExistingSourceId(null);
        return;
    }

    if (sourceSearchDebounceRef.current) {
        clearTimeout(sourceSearchDebounceRef.current);
    }

    // Set a 1-second debounce timer
    sourceSearchDebounceRef.current = setTimeout(async () => {
        try {
        const results = await findSourceByName(sourceName);
        
        if (results && results.length === 1) {
            // CASE 1: Exactly one match found
            const source = results[0];
            setSourceDescription(source.source_description || "");
            setSourceType(source.source_platform || "Website");
            setExistingSourceId(source.id);
            setSourceExists(true);
            setShowSourceModal(false); // Ensure modal is closed
        } else if (results && results.length > 1) {
            // CASE 2: Multiple matches found
            setMatchingSources(results);
            setShowSourceModal(true); // Open the modal
        } else {
            // CASE 3: No match found (or an error occurred)
            setSourceExists(false);
            setExistingSourceId(null);
        }
        } catch (error) {
        console.error("Error finding source:", error);
        // Optionally set an error state to show the user
        }
    }, 1000);

  return () => clearTimeout(sourceSearchDebounceRef.current);
}, [sourceName]);

const handleSourceSelect = (source) => {
    setSourceDescription(source.source_description || "");
    setSourceType(source.source_platform || "Website");
    setExistingSourceId(source.id);
    setSourceExists(true);
    setShowSourceModal(false); // Close the modal after selection
};

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
    // Trim the string FIRST, then perform the replacement.
    return t.trim().replace(/\s*User$/i, "");
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
    setChatChannel("513th-idsg-test");
    setChatOutput("");
    setReportOutput("");
    setCitationOutput("");
    setChatMessageSent(false); // Reset chat status
    setExistingSourceId(null);
    setSourceExists(false);
    setShowSourceModal(false);
    setMatchingSources([]);
  };

  // === Auto-generate Chat Output from current form state ===
  useEffect(() => {
    const oc = classificationForOutput(overallClass);
    const cc = classificationForOutput(collectorClass);
    const dtg = makeDTG(dateStr, timeStr);
    const usPerson = usper ? "(USPER) " : ""; 
    const mgrsDisp = mgrs || "";
    const srcType = sourceType || "";
    const srcName = sourceName || "";
    const action = didWhat || "";
    const body = reportBody || "";
    const cinDisp = cin || "";
    const comment = sourceDescription || "";

    const chat = `(${oc}) ${dtg} (${mgrsDisp}) ${srcType} ${usPerson}${srcName} | (U) ${action} ${body} (MGRS FOR REFERENCE ONLY. PUBLICLY AVAILABLE INFORMATION: SOURCE IS UNVERIFIED) | ${cinDisp} | (${cc}) COLLECTOR COMMENT: ${comment} (${oc})`;
    setChatOutput(chat.trim());
    setChatMessageSent(false); // Reset sent status if underlying data changes
  }, [
    overallClass,
    usper,
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

    const report = `(${oc}) On ${dtg}, ${srcType} ${usPerson}${srcName}\n${action} ${body}\n(${mgrsDisp})\n\n(${cc}) COLLECTOR COMMENT: ${desc}`;
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
    sourceDescription,
    didWhat
  ]);

  // Auto-generate Citation Output from current form state ===
  useEffect(() => {
    const oc = classificationForOutput(overallClass);
    const dtg = makeDTG(dateStr, timeStr);
    const srcType = cleanSourceType(sourceType || "");
    const usPersonRep = usper ? "(USPER) " : "";
    const srcName = sourceName || "";
    const uidDisp = uid || "";
    const usPerson = (usper || uspi) ? "YES" : "NO";
    const citationTitle = articleTitle || "";
    const citationAuthor = articleAuthor || "";

    let citation;
    if (didWhat === "published") {
      citation = `(${oc}) ${srcType} | ${usPersonRep}${srcName} | ${citationTitle} | ${citationAuthor} | ${uidDisp} | ${dtg} | UNCLASSIFIED | U.S. Person: ${usPerson}`;
    } else {
      citation = `(${oc}) ${srcType} | ${usPersonRep}${srcName} | ${uidDisp} | ${dtg} | UNCLASSIFIED | U.S. Person: ${usPerson}`;
    }
    setCitationOutput(citation.trim());
  }, [overallClass, dateStr, timeStr, sourceType, sourceName, uid, usper, uspi, articleAuthor, articleTitle, didWhat]);  

  // === CHAT SUBMIT HANDLER ===
  async function handleChatSubmit() {
    if (!reportBody.trim()) {
      alert("Please fill out the Report Body before sending a message.");
      return;
    }
    if (!displayName || displayName === "N/A") {
      alert("Please set your Display Name in Settings before sending a message.");
      return;
    }

    setChatError("");
    setSendingChat(true);

    try {
      const API_URL = "https://chatsurfer.nro.mil/api/chatserver/message";
      const API_KEY = import.meta.env.VITE_CHATSURFER_API_KEY;
      
      if (!API_KEY) {
        throw new Error("ChatSurfer API Key is missing from environment variables.");
      }
      
      const payload = {
        // The classification format "UNCLASSIFIED//FOUO" from the example may
        // differ from the form's logic. Using the form's classification for now.
        classification: "UNCLASSIFIED//FOUO",
        message: chatOutput,
        domainId: "chatsurferxmppunclass", // this is based on ChatSurfer's docs
        nickName: displayName,
        roomName: chatChannel
      };

      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": API_KEY, 
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Chat send failed: ${res.status} ${text}`);
      }

      setChatMessageSent(true);

    } catch (err) {
      console.error(err);
      setChatError(err?.message || "Failed to send chat message.");
    } finally {
      setSendingChat(false);
    }
  }

  // === REPORT SUBMIT HANDLER ===
  async function handleSubmit() {
    // 1. Check if the ChatSurfer message was sent and warn the user if not.
    if (!chatMessageSent) {
      const proceed = window.confirm(
        "ChatSurfer Message was not sent. Would you like to submit anyway?"
      );
      if (!proceed) {
        return; // Stop the submission if the user clicks "Cancel"
      }
    }

    setSubmitOk("");
    setSubmitError("");
    setSubmitting(true);
    try {
      // Build DTG and title
      const dtg = makeDTG(dateStr, timeStr);
      const titleParts = [
        slugify(dtg),
        slugify(country),
        slugify(location),
        slugify(cin),
      ].filter(Boolean);
      const report_title = titleParts.join("_") || "UNTITLED";
      const filename = `${report_title}_IMAGE`;

      // Environment
      const API_URL = import.meta.env.VITE_API_URL;
      const API_KEY = import.meta.env.VITE_API_KEY;
      const IMG_URL = import.meta.env.VITE_IMAGE_UPLOAD_URL;
      const IMG_API_KEY = import.meta.env.VITE_IMAGE_UPLOAD_API_KEY;

      if (!API_URL) throw new Error("VITE_API_URL missing");
      if (!API_KEY) throw new Error("VITE_API_KEY missing");
      if (imgFile && (!IMG_URL || !IMG_API_KEY)) {
        throw new Error("Image upload env vars missing");
      }

      // Optional image upload first to get stable URL
      let image_url = "";
      if (imgFile) {
        const uploadEndpoint = `${String(IMG_URL).replace(
          /\/+$/,
          ""
        )}/${encodeURIComponent(filename)}`;
        const putRes = await fetch(uploadEndpoint, {
          method: "PUT",
          headers: {
            "x-api-key": IMG_API_KEY,
            "Content-Type": imgFile.type || "application/octet-stream",
          },
          body: imgFile,
        });
        if (!putRes.ok) {
          const t = await putRes.text().catch(() => "");
          throw new Error(`Image upload failed: ${putRes.status} ${t}`);
        }
        image_url = uploadEndpoint; // use the upload URL as the reference
      }

      // Build payload for /reports
      const reportPayload = {
        overall_classification: overallClass,
        title: report_title,
        date_of_information: dateStr,
        time: timeStr,
        created_by: cin,
        macom,
        country,
        location,
        mgrs,
        is_usper: !!usper,
        has_uspi: !!uspi,
        source_platform: sourceType,
        source_name: sourceName,
        did_what: didWhat,
        uid,
        article_title: articleTitle,
        article_author: articleAuthor,
        report_body: reportBody,
        collector_classification: collectorClass,
        source_description: sourceDescription,
        additional_comment_text: additionalComment,
        ...(image_url ? { image_url } : {}),
      };

      const authToken = localStorage.getItem("token");
      const headers = {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      };
      
      // === Main Report Submission ===
      const reportRes = await fetch(`${String(API_URL).replace(/\/+$/, "")}/reports`, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(reportPayload),
      });

      if (!reportRes.ok) {
        const text = await reportRes.text().catch(() => "");
        throw new Error(`Report create failed: ${reportRes.status} ${text}`);
      }
      const reportData = await reportRes.json().catch(() => ({}));

      // 2. If USPER is true, we are done. No source data is submitted.
      if (usper) {
        setSubmitOk(
          `USPER Report created${reportData?.id ? " with id " + reportData.id : ""}.`
        );
        clearForm();
        return; // End function execution here
      }

      // 3 & 4. If not USPER, proceed with source logic if a source name exists.
      if (sourceName.trim()) {
        let sourceEndpoint = `${String(API_URL).replace(/\/+$/, "")}/sources`;
        let sourcePayload;
        let sourceMethod;

        if (sourceExists && existingSourceId) {
          // A. Source exists, prepare a PUT request to update it.
          sourceMethod = "PUT";
          sourceEndpoint += `/${existingSourceId}`;
          sourcePayload = {
            source_name: sourceName,
            source_description: sourceDescription,
            source_platform: sourceType,
            modified_by: cin, // 'modified_by' for updates
          };
        } else {
          // B. Source does not exist, prepare a POST request to create it.
          sourceMethod = "POST";
          sourcePayload = {
            source_name: sourceName,
            source_description: sourceDescription,
            source_platform: sourceType,
            added_by: cin, // 'added_by' for new entries
          };
        }

        const sourceRes = await fetch(sourceEndpoint, {
          method: sourceMethod,
          headers: headers,
          body: JSON.stringify(sourcePayload),
        });

        if (!sourceRes.ok) {
          const text = await sourceRes.text().catch(() => "");
          // The report was created, but the source operation failed. Show a specific error.
          throw new Error(
            `Report created, but source ${sourceMethod} failed: ${sourceRes.status} ${text}`
          );
        }
      }

      setSubmitOk(
        `Report created${reportData?.id ? " with id " + reportData.id : ""}. Source info saved.`
      );
      // Clear form after all operations are successful
      clearForm();
    } catch (err) {
      console.error(err);
      setSubmitError(err?.message || "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

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

  // A simple modal component to display choices
    const SourceSelectionModal = () => (
    showSourceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-slate-800 rounded-lg p-6 w-full max-w-2xl border border-slate-600">
            <h3 className="text-lg font-bold mb-4">Multiple Sources Found</h3>
            <p className="text-sm text-slate-400 mb-4">
            More than one source matches the name "{sourceName}". Please select the correct one.
            </p>
            <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {matchingSources.map((source) => (
                <div key={source.id} className="p-3 bg-slate-900 rounded-md border border-slate-700">
                <p className="font-bold">{source.source_name}</p>
                <p className="text-sm"><span className="font-semibold">Platform:</span> {source.source_platform}</p>
                <p className="text-sm text-slate-300 mt-1"><span className="font-semibold">Description:</span> {source.source_description}</p>
                <button
                    onClick={() => handleSourceSelect(source)}
                    className="mt-3 px-4 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
                >
                    Select
                </button>
                </div>
            ))}
            </div>
            <button
            onClick={() => setShowSourceModal(false)}
            className="mt-6 w-full h-9 rounded-md bg-slate-700 text-white font-bold"
            >
            Cancel
            </button>
        </div>
        </div>
    )
    );

  return (
    <div>
      <SourceSelectionModal />
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
            <div className="flex items-center">
                <label className="block text-xs">Report Body</label>
                {filterWordFound && (
                    <div className="ml-2 inline-flex items-center justify-center h-5 px-2 rounded-md bg-yellow-500 text-black text-xs font-bold select-none">
                        Filter word found
                    </div>
                )}
            </div>
            <textarea
              value={reportBody}
              onChange={(e) => setReportBody(e.target.value)}
              className="w-full min-h-[130px] rounded-md bg-slate-900 border border-slate-700 px-3 py-2 mt-1"
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
          {/* SUBMIT button */}
          <div className="mt-4 space-y-2">
            <button
              type="button"
              className="w-full h-10 rounded-md bg-blue-600 text-white font-bold disabled:opacity-60"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "SUBMITTING..." : "SUBMIT"}
            </button>
            {submitOk ? (
              <div className="text-green-400 text-sm">{submitOk}</div>
            ) : null}
            {submitError ? (
              <div className="text-red-400 text-sm">{submitError}</div>
            ) : null}
          </div>
        </div>

        {/* Column 2 */}
        <div className="col-span-12 lg:col-span-6 space-y-3">
          {/* 1. ChatSurfer Channel */}
          <div>
            <div className="flex justify-between items-baseline mb-1">
              <label className="block text-xs">ChatSurfer Channel</label>
              <span className="text-xs text-slate-400">
                ChatSurfer Display Name:{" "}
                <span className="font-medium text-slate-300">
                  {displayName || "N/A"}
                </span>
              </span>
            </div>
            <select
              value={chatChannel}
              onChange={(e) => setChatChannel(e.target.value)}
              className="w-full h-9 rounded-md bg-slate-900 border border-slate-700 px-2"
            >
              <option>513th-idsg-test</option>
              <option>513th_mibt_osint_cui</option>
            </select>
          </div>

          {/* 2. Chat Output */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs">Chat Output</label>
              {/* Conditional status badge */}
              {chatMessageSent ? (
                <div className="inline-flex items-center justify-center h-7 px-3 rounded-md bg-green-500 text-black text-xs font-extrabold select-none">
                  Message sent
                </div>
              ) : (
                <div className="inline-flex items-center justify-center h-7 px-3 rounded-md bg-orange-500 text-black text-xs font-extrabold select-none">
                  Message not sent
                </div>
              )}
            </div>
            <textarea
              value={chatOutput}
              onChange={(e) => setChatOutput(e.target.value)}
              className="w-full min-h-[160px] rounded-md bg-slate-900 border border-slate-700 px-3 py-2"
            />
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 h-9 rounded-md bg-slate-800 border border-blue-500 text-blue-500 disabled:opacity-60"
                  onClick={handleChatSubmit}
                  disabled={sendingChat}
                >
                  {sendingChat ? "SENDING..." : "Send to ChatSurfer"}
                </button>
                <button
                  type="button"
                  className="flex-1 h-9 rounded-md bg-slate-800 border border-green-400 text-green-400"
                  onClick={() => copy(chatOutput)}
                >
                  Copy Chat Output
                </button>
              </div>
              {chatError ? <div className="text-red-400 text-sm">{chatError}</div> : null}
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