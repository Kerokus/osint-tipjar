import { useState, useMemo, useEffect } from "react";

export default function ReportSearch({ onViewReport }) {
  
  // === NEW: Toggle State ===
  const [searchMode, setSearchMode] = useState("params"); // "params" | "ai"
  const [aiPrompt, setAiPrompt] = useState("");
  const [interpretedQuery, setInterpretedQuery] = useState(null); // To show the SQL the AI wrote

  // State for standard search form inputs
  const [params, setParams] = useState({
    q: "",
    country: "",
    source_platform: "",
    source_name: "",
    macom: "",
    created_from: "",
    created_to: "",
    location: "",
    created_by: "",
    requirement: "",
  });

  // State for the executed search query. 
  // We now store the mode inside the active query to know which API to hit.
  const [activeQuery, setActiveQuery] = useState(null);

  // State for API results and loading status
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // State for pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [total, setTotal] = useState(0); 

  const BASE = useMemo(() => (import.meta.env.VITE_API_URL || "").replace(/\/+$/, ""), []);
  const API_KEY = import.meta.env.VITE_API_KEY;

  // --- Handlers ---

  const handleParamChange = (e) => {
    const { name, value } = e.target;
    const uppercaseFields = ['country', 'macom', 'created_by']
    const finalValue = uppercaseFields.includes(name) ? value.toUpperCase() : value;
    setParams((prev) => ({ ...prev, [name]: finalValue }));
  };

  const platformOptions = ["Website", "X User", "Telegram User", "BlueSky User", "Facebook User", "Instagram User", "YouTube User", "Tiktok User", "VK User", "MySpace User", "Aparat User", "Eitaa User"];

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1); 
    setTotal(0);
    setInterpretedQuery(null); // Clear previous AI SQL

    // Trigger the effect by setting activeQuery based on the current mode
    if (searchMode === "params") {
        setActiveQuery({ mode: "params", ...params });
    } else {
        setActiveQuery({ mode: "ai", prompt: aiPrompt });
    }
  };
  
  const handleReset = () => {
    setParams({
      q: "", country: "", source_platform: "", source_name: "", macom: "",
      created_from: "", created_to: "", location: "", created_by: "", requirement: "",
    });
    setAiPrompt("");
    setActiveQuery(null);
    setResults([]);
    setError(null);
    setInterpretedQuery(null);
    setPage(1);
    setTotal(0);
  }

  useEffect(() => {
    if (!activeQuery) {
      setResults([]);
      return;
    }

    let cancel = false;
    const performSearch = async () => {
      setLoading(true);
      setError(null);

      const offset = (page - 1) * limit;

      try {
        let res;
        
        // === BRANCH 1: Standard Parameter Search (GET) ===
        if (activeQuery.mode === "params") {
            const urlParams = new URLSearchParams();
            // Exclude internal 'mode' key from URL params
            for (const key in activeQuery) {
                if (activeQuery[key] && key !== "mode") {
                urlParams.append(key, activeQuery[key]);
                }
            }
            urlParams.append("limit", limit);
            urlParams.append("offset", offset);

            res = await fetch(`${BASE}/reports?${urlParams.toString()}`, {
                method: "GET",
                headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
            });
        } 
        // === BRANCH 2: AI Search (POST) ===
        else {
            res = await fetch(`${BASE}/aisearch`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
                body: JSON.stringify({ 
                    query: activeQuery.prompt,
                    limit: limit,
                    offset: offset // Pass pagination to AI endpoint if supported, otherwise it might just return top N
                })
            });
        }

        if (!res.ok) throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
        
        const data = await res.json();
        if (cancel) return;

        setResults(Array.isArray(data.results) ? data.results : []);
        setTotal(data.total || 0);
        
        // If the API returns the generated SQL, save it for display
        if (data.query_interpreted) {
            setInterpretedQuery(data.query_interpreted);
        }

      } catch (e) {
        if (!cancel) setError(String(e));
      } finally {
        if (!cancel) setLoading(false);
      }
    };

    performSearch();

    return () => { cancel = true; };
  }, [activeQuery, page, limit, BASE, API_KEY]);
  
  const offset = (page - 1) * limit;
  const startItem = results.length > 0 ? offset + 1 : 0;
  const endItem = offset + results.length;
  const hasNextPage = results.length === limit;

  return (
    <div className="space-y-6">
      
      {/* Search Container */}
      <div className="p-4 bg-slate-800 border border-slate-600 rounded-lg">
        
        {/* Toggle Tabs */}
        <div className="flex space-x-6 border-b border-slate-600 pb-3 mb-4">
            <button 
                type="button"
                onClick={() => setSearchMode("params")}
                className={`text-sm font-medium transition-colors ${searchMode === "params" ? "text-blue-400 border-b-2 border-blue-400 -mb-3.5 pb-3" : "text-slate-400 hover:text-slate-200"}`}
            >
                Parameter Search
            </button>
            <button 
                type="button"
                onClick={() => setSearchMode("ai")}
                className={`text-sm font-medium transition-colors ${searchMode === "ai" ? "text-purple-400 border-b-2 border-purple-400 -mb-3.5 pb-3" : "text-slate-400 hover:text-slate-200"}`}
            >
                ✨ AI Search
            </button>
        </div>

        <form onSubmit={handleSearch} onReset={handleReset}>
            
            {/* === MODE 1: STANDARD FORM === */}
            {searchMode === "params" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Input label="Full-Text Search" name="q" value={params.q} onChange={handleParamChange} placeholder="Search title, body..." />
                <Input label="Requirement ID" name="requirement" value={params.requirement} onChange={handleParamChange} placeholder="16692" />
                <Input label="Created By" name="created_by" value={params.created_by} onChange={handleParamChange} placeholder="A0000" />
                <div>
                    <label htmlFor="source_platform" className="block text-sm font-medium text-slate-300 mb-1">Source Platform</label>
                    <select id="source_platform" name="source_platform" value={params.source_platform} onChange={handleParamChange} className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100 focus:ring-blue-500 focus:border-blue-500">
                    <option value="">Select a Platform</option>
                    {platformOptions.map(platform => (
                        <option key={platform} value={platform}>{platform}</option>
                    ))}
                    </select>
                </div>
                <Input label="MACOM" name="macom" value={params.macom} onChange={handleParamChange} placeholder="CENTCOM" />
                <Input label="Country" name="country" value={params.country} onChange={handleParamChange} placeholder="KUWAIT" />
                <Input label="Location" name="location" value={params.location} onChange={handleParamChange} placeholder="Baghdad" />
                <Input label="Source Name" name="source_name" value={params.source_name} onChange={handleParamChange} placeholder="@example_channel" />
                <Input type="date" label="Created After" name="created_from" value={params.created_from} onChange={handleParamChange} />
                <Input type="date" label="Created Before" name="created_to" value={params.created_to} onChange={handleParamChange} />
                </div>
            )}

            {/* === MODE 2: AI INPUT === */}
            {searchMode === "ai" && (
                <div className="space-y-3 animate-in fade-in zoom-in duration-300">
                    <label htmlFor="aiPrompt" className="block text-sm font-medium text-slate-300">
                        Describe the reports you need
                    </label>
                    <textarea 
                        id="aiPrompt"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="e.g., Find all reports about drone strikes in Iraq from the last 2 weeks..."
                        className="w-full h-24 bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100 focus:ring-purple-500 focus:border-purple-500 placeholder:text-slate-600 resize-none"
                    />
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="inline-block w-2 h-2 rounded-full bg-purple-500"></span>
                        Powered by Claude 3.5 Sonnet (Generative SQL)
                    </div>
                </div>
            )}

            <div className="flex items-center gap-4 mt-6">
                <button 
                    type="submit" 
                    className={`px-6 py-2 text-sm rounded-md text-white font-semibold transition-colors ${
                        searchMode === 'ai' 
                        ? 'bg-purple-600 hover:bg-purple-500 shadow-[0_0_15px_rgba(147,51,234,0.3)]' 
                        : 'bg-blue-600 hover:bg-blue-500'
                    }`}
                >
                    {searchMode === 'ai' ? 'Generate Query & Search' : 'Search Reports'}
                </button>
                <button type="reset" className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-md text-slate-200">
                    Reset
                </button>
            </div>
        </form>
      </div>
      
      {/* Results Section */}
      <div className="space-y-4">
        
        {/* AI Transparency Box: Shows the user the SQL that was generated */}
        {searchMode === "ai" && interpretedQuery && (
            <div className="px-4 py-3 bg-slate-900/50 border border-purple-500/30 rounded-lg">
                <p className="text-xs text-slate-400 mb-1 uppercase tracking-wider font-semibold">Generated SQL Query</p>
                <code className="text-xs text-purple-300 font-mono break-all block">
                    {interpretedQuery}
                </code>
            </div>
        )}

        <PaginationHeader
          start={startItem}
          end={endItem}
          total={total}
          page={page}
          hasNextPage={hasNextPage}
          onPageChange={setPage}
          loading={loading}
        />

        {loading && (
            <div className="text-slate-300 flex items-center gap-2">
                {searchMode === 'ai' ? (
                    <>
                        <span className="animate-pulse">✨</span> Thinking...
                    </>
                ) : "Searching..."}
            </div>
        )}
        
        {error && <div className="text-red-400 bg-red-900/20 p-3 rounded border border-red-800">Error: {error}</div>}
        
        {!loading && !error && activeQuery && results.length === 0 && (
          <div className="text-slate-300 italic">No reports found matching your criteria.</div>
        )}

        {results.length > 0 && (
          <ResultsTable rows={results} onViewReport={onViewReport} />
        )}
      </div>
    </div>
  );
}


/* ---------- Sub-components (Unchanged) ---------- */

function Input({ label, name, type = "text", value, onChange, placeholder = "" }) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
      <input
        type={type}
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
  );
}

function PaginationHeader({ start, end, total, page, hasNextPage, onPageChange, loading }) {
  const showingText = total > 0
    ? `Showing ${start} - ${end} of ${total}`
    : `Showing ${start} - ${end}`;
  
  if (start === 0 && total === 0) return null;

  return (
    <div className="flex justify-between items-center text-sm text-slate-400">
      <span>{showingText}</span>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(p => p - 1)}
          disabled={page === 1 || loading}
          className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          &larr; Previous
        </button>
        <button
          onClick={() => onPageChange(p => p + 1)}
          disabled={!hasNextPage || loading}
          className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next &rarr;
        </button>
      </div>
    </div>
  );
}

function ResultsTable({ rows, onViewReport }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-600">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-900 text-slate-200">
          <tr>
            <Th>Report Title</Th>
            <Th>Date of Information</Th>
            <Th>Country</Th>
            <Th>Location</Th>
            <Th>Body</Th>
          </tr>
        </thead>
        <tbody className="text-slate-200">
          {rows.map((r, i) => {
            const id = r.id ?? r.report_id ?? r._id ?? i;
            return (
              <tr
                key={id}
                className="odd:bg-slate-800 even:bg-slate-700 hover:bg-slate-600 cursor-pointer"
                onClick={() => onViewReport(id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onViewReport(id); }}}
                role="button"
                tabIndex={0}
                title="View report details"
              >
                <Td>{nz(r.title)}</Td>
                <Td>{fmtDate(r.date_of_information)}</Td>
                <Td>{nz(r.country)}</Td>
                <Td>{nz(r.location)}</Td>
                <Td className="max-w-[48ch]">{truncate(nz(r.report_body), 240)}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Reusable Components & Utils ---------- */

function Th({ children }) {
  return <th className="px-4 py-3 text-left font-semibold border-b border-slate-700 select-none">{children}</th>;
}
function Td({ children, className = "" }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}
function fmtDate(d) {
  if (!d) return "—";
  const t = typeof d === "string" || typeof d === "number" ? Date.parse(d) : NaN;
  if (!Number.isFinite(t)) return String(d);
  return new Date(t).toLocaleDateString();
}
function nz(v) { return (v === null || v === undefined) ? "" : String(v); }
function truncate(s, n) { return (!s) ? "" : (s.length > n ? s.slice(0, n - 1) + "…" : s); }