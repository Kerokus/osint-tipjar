import { useEffect, useMemo, useState, useCallback } from "react";
import ReportSearch from "./ReportSearch";
import ViewReport from "./ViewReport";
import EditReport from "./EditReport"; // 1. Import EditReport

export default function ViewAndSearch() {
  const [mode, setMode] = useState("view"); // "view" | "search"
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  
  // --- State for Modals ---
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [editingReport, setEditingReport] = useState(null); // 2. Add state for the edit modal

  const BASE = useMemo(() => (import.meta.env.VITE_API_URL || "").replace(/\/+$/, ""), []);
  const API_KEY = import.meta.env.VITE_API_KEY;
  const URL = `${BASE}/reports`;

  const fetchReports = useCallback(async () => {
    let cancel = false;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(URL, {
        method: "GET",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!cancel) setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      if (!cancel) setErr(String(e));
    } finally {
      if (!cancel) setLoading(false);
    }
    return () => { cancel = true; };
  }, [URL, API_KEY]);

  useEffect(() => {
    if (mode === "view") {
      fetchReports();
    }
  }, [mode, fetchReports]);

  // 3. Create handlers for the modals
  const handleCloseAndRefresh = () => {
    setSelectedReportId(null);
    setEditingReport(null);
    fetchReports(); // Re-fetch data to show changes
  };

  const handleEdit = (report) => {
    setSelectedReportId(null); // Close the view modal
    setEditingReport(report);   // Open the edit modal with the report data
  };

  return (
    <div className="w-full space-y-4">
      {/* Segmented control */}
      <div className="inline-flex rounded-lg border border-slate-600 overflow-hidden">
        <button
          className={`px-4 py-2 text-sm ${mode === "view" ? "bg-slate-700 text-slate-100" : "bg-slate-900 text-slate-300 hover:bg-slate-800"}`}
          onClick={() => setMode("view")}
          aria-pressed={mode === "view"}
        >
          View All
        </button>
        <button
          className={`px-4 py-2 text-sm ${mode === "search" ? "bg-slate-700 text-slate-100" : "bg-slate-900 text-slate-300 hover:bg-slate-800"}`}
          onClick={() => setMode("search")}
          aria-pressed={mode === "search"}
        >
          Search
        </button>
      </div>

      {mode === "view" ? (
        <ViewAllTable base={BASE} rows={rows} loading={loading} err={err} onViewReport={setSelectedReportId} />
      ) : (
        <ReportSearch onViewReport={setSelectedReportId} />
      )}
      
      {/* 4. Update the modal rendering logic */}
      {selectedReportId && (
        <ViewReport 
          reportId={selectedReportId} 
          onClose={() => setSelectedReportId(null)} 
          onDeleteSuccess={handleCloseAndRefresh}
          onEdit={handleEdit} // Pass the new handler
        />
      )}

      {editingReport && (
        <EditReport
          report={editingReport}
          onClose={() => setEditingReport(null)}
          onSaveSuccess={handleCloseAndRefresh}
        />
      )}
    </div>
  );
}

// --- Unchanged Sub-components below ---

function ViewAllTable({ base, rows, loading, err, onViewReport }) {
  if (loading) return <div className="text-slate-300">Loading reports…</div>;
  if (err) return <div className="text-red-400">Error: {err}</div>;
  if (!rows?.length) return <div className="text-slate-300">No reports.</div>;

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
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onViewReport(id);
                  }
                }}
                role="button"
                tabIndex={0}
                title="View report details"
              >
                <Td>{nz(r.title)}</Td>
                <Td>{fmtDate(r.date_of_information ?? r.report_date)}</Td>
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
  if (typeof d === "string") {
    const parsed = parseDDMMMYY(d);
    if (parsed) return parsed.toLocaleDateString();
  }
  const t = typeof d === "string" || typeof d === "number" ? Date.parse(d) : NaN;
  if (!Number.isFinite(t)) return String(d);
  return new Date(t).toLocaleDateString();
}

function parseDDMMMYY(s) {
  const m = /^(\d{1,2})([A-Z]{3})(\d{2})$/.exec(String(s).trim().toUpperCase());
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const mon = { JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11 }[m[2]];
  if (mon == null) return null;
  const yy = parseInt(m[3], 10);
  const year = yy >= 50 ? 1900 + yy : 2000 + yy;
  return new Date(year, mon, day);
}

function nz(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}
function truncate(s, n) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}