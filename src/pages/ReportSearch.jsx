import { useState, useMemo, useCallback, useEffect } from "react";

/**
 * ReportSearch.jsx
 *
 * Provides a UI for searching reports based on the available API criteria.
 * It includes input fields, result display, and pagination.
 */
export default function ReportSearch() {
  // State for search form inputs
  const [params, setParams] = useState({
    q: "",
    country: "",
    source_platform: "",
    source_name: "",
    macom: "",
    created_from: "",
    created_to: "",
  });

  // State for the executed search query. This triggers the API call.
  const [activeQuery, setActiveQuery] = useState(null);

  // State for API results and loading status
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // State for pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0); // Estimated total, calculated on the last page.

  const BASE = useMemo(() => (import.meta.env.VITE_API_URL || "").replace(/\/+$/, ""), []);
  const API_KEY = import.meta.env.VITE_API_KEY;

  // --- Handlers ---

  const handleParamChange = (e) => {
    const { name, value } = e.target;
    
    // Check if the input is the 'country' field
    const finalValue = name === 'country' 
      ? value.toUpperCase() 
      : value;

    setParams((prev) => ({ ...prev, [name]: finalValue }));
  };

  const platformOptions = ["Website", "X User", "Telegram User", "Facebook User", "Instagram User", "YouTube User", "Tiktok User", "VK User", "MySpace User", "Aparat User"];

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1); // Reset to the first page for a new search
    setTotal(0); // Reset total, as it's unknown for a new query
    setActiveQuery(params); // Trigger the search effect
  };
  
  const handleReset = () => {
    setParams({
      q: "",
      country: "",
      source_platform: "",
      source_name: "",
      macom: "",
      created_from: "",
      created_to: "",
    });
    setActiveQuery(null);
    setResults([]);
    setError(null);
    setPage(1);
    setTotal(0);
  }

  // --- Data Fetching Effect ---

  useEffect(() => {
    // Do not run effect if no search has been submitted
    if (!activeQuery) {
      setResults([]);
      return;
    }

    let cancel = false;
    const performSearch = async () => {
      setLoading(true);
      setError(null);

      const offset = (page - 1) * limit;
      const urlParams = new URLSearchParams();

      // Append non-empty parameters from the active query
      for (const key in activeQuery) {
        if (activeQuery[key]) {
          urlParams.append(key, activeQuery[key]);
        }
      }
      urlParams.append("limit", limit);
      urlParams.append("offset", offset);

      try {
        const res = await fetch(`${BASE}/reports?${urlParams.toString()}`, {
          method: "GET",
          headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        });

        if (!res.ok) throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
        
        const data = await res.json();
        if (cancel) return;

        setResults(Array.isArray(data) ? data : []);

        // Estimate total for the "Showing X-Y of Z" message.
        // If the number of results returned is less than the limit, we're on the last page.
        if (data.length < limit) {
          setTotal(offset + data.length);
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


  // --- Render Logic ---
  
  const offset = (page - 1) * limit;
  const startItem = results.length > 0 ? offset + 1 : 0;
  const endItem = offset + results.length;
  const hasNextPage = results.length === limit;

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <form onSubmit={handleSearch} onReset={handleReset} className="p-4 bg-slate-800 border border-slate-600 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Input label="Full-Text Search" name="q" value={params.q} onChange={handleParamChange} placeholder="Search title, body..." />
          <Input label="Country" name="country" value={params.country} onChange={handleParamChange} placeholder="KUWAIT" />
          <Input label="MACOM" name="macom" value={params.macom} onChange={handleParamChange} placeholder="CENTCOM" />
          <div>
            <label htmlFor="source_platform" className="block text-sm font-medium text-slate-300 mb-1">
              Source Platform
            </label>
            <select
              id="source_platform"
              name="source_platform"
              value={params.source_platform}
              onChange={handleParamChange}
              className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a Platform</option>
              {platformOptions.map(platform => (
                <option key={platform} value={platform}>
                  {platform}
                </option>
              ))}
            </select>
          </div>
          <Input label="Source Name" name="source_name" value={params.source_name} onChange={handleParamChange} placeholder="e.g., @example_channel" />
          <Input type="date" label="Created After" name="created_from" value={params.created_from} onChange={handleParamChange} />
          <Input type="date" label="Created Before" name="created_to" value={params.created_to} onChange={handleParamChange} />
        </div>
        <div className="flex items-center gap-4 mt-4">
          <button type="submit" className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 rounded-md text-white font-semibold">
            Search
          </button>
           <button type="reset" className="px-4 py-2 text-sm bg-slate-600 hover:bg-slate-500 rounded-md text-slate-200">
            Reset
          </button>
        </div>
      </form>
      
      {/* Results Section */}
      <div className="space-y-4">
        <PaginationHeader
          start={startItem}
          end={endItem}
          total={total}
          page={page}
          hasNextPage={hasNextPage}
          onPageChange={setPage}
          loading={loading}
        />

        {loading && <div className="text-slate-300">Searching...</div>}
        {error && <div className="text-red-400">Error: {error}</div>}
        {!loading && !error && activeQuery && results.length === 0 && (
          <div className="text-slate-300">No reports found matching your criteria.</div>
        )}

        {results.length > 0 && (
          <ResultsTable base={BASE} rows={results} />
        )}
      </div>
    </div>
  );
}


/* ---------- Sub-components ---------- */

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
  
  if (start === 0 && total === 0) {
    return null; // Don't show header if there are no results
  }

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

function ResultsTable({ base, rows }) {
  const openRow = (id) => {
    if (!id) return;
    const href = `${base}/reports/${encodeURIComponent(id)}`;
    window.open(href, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-600">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-900 text-slate-200">
          <tr>
            <Th>Report Title</Th>
            <Th>Date of Information</Th>
            <Th>Country</Th>
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
                onClick={() => openRow(id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openRow(id); }}}
                role="link"
                tabIndex={0}
                title="Open report"
              >
                <Td>{nz(r.title)}</Td>
                <Td>{fmtDate(r.date_of_information)}</Td>
                <Td>{nz(r.country)}</Td>
                <Td className="max-w-[48ch]">{truncate(nz(r.report_body), 240)}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Reusable Components & Utils (from ViewAndSearch) ---------- */

function Th({ children }) {
  return (
    <th className="px-4 py-3 text-left font-semibold border-b border-slate-700 select-none">
      {children}
    </th>
  );
}
function Td({ children, className = "" }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}

function fmtDate(d) {
  if (!d) return "—";
  // The API uses a standard date format, so complex parsing might not be needed.
  // Kept simple for now. Add back parseDDMMMYY if that format is also used here.
  const t = typeof d === "string" || typeof d === "number" ? Date.parse(d) : NaN;
  if (!Number.isFinite(t)) return String(d);
  return new Date(t).toLocaleDateString();
}

function nz(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function truncate(s, n) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}