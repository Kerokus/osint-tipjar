import { useEffect, useMemo, useState, useCallback } from "react";
import ReportSearch from "./ReportSearch";
import ViewReport from "./ViewReport";
import EditReport from "./EditReport";

export default function ViewAndSearch({ onSendToIntsum }) {
  const [mode, setMode] = useState("view");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [editingReport, setEditingReport] = useState(null);

  // Selection Persistence State
  // We use a Map where Key = Report ID, Value = Report Object
  const [selectedReports, setSelectedReports] = useState(new Map());
  const [showSelectionModal, setShowSelectionModal] = useState(false);

  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0); 

  const BASE = useMemo(() => (import.meta.env.VITE_API_URL || "").replace(/\/+$/, ""), []);
  const API_KEY = import.meta.env.VITE_API_KEY;

  // --- Selection Handlers ---

  // Helper to get ID consistently
  const getReportId = (r) => r.id ?? r.report_id ?? r._id;

  const toggleReportSelection = (report) => {
    const id = getReportId(report);
    setSelectedReports(prev => {
      const newMap = new Map(prev);
      if (newMap.has(id)) {
        newMap.delete(id);
      } else {
        newMap.set(id, report);
      }
      return newMap;
    });
  };

  // Selects or Deselects a whole batch (e.g., current page)
  const setBatchSelection = (reports, shouldSelect) => {
    setSelectedReports(prev => {
      const newMap = new Map(prev);
      reports.forEach(r => {
        const id = getReportId(r);
        if (shouldSelect) newMap.set(id, r);
        else newMap.delete(id);
      });
      return newMap;
    });
  };

  const clearAllSelections = () => {
    setSelectedReports(new Map());
  };

  const handleSendSelected = () => {
    // Convert Map values to Array
    const reportArray = Array.from(selectedReports.values());
    onSendToIntsum(reportArray);
    setShowSelectionModal(false);
  };

  const fetchReports = useCallback(async () => {
    let cancel = false;
    setLoading(true);
    setErr(null);

    const offset = (page - 1) * limit;
    const url = `${BASE}/reports?limit=${limit}&offset=${offset}&sort=created_on&order=desc`;

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!cancel) {
        setRows(Array.isArray(data.results) ? data.results : []);
        setTotal(data.total || 0);
      }
    } catch (e) {
      if (!cancel) setErr(String(e));
    } finally {
      if (!cancel) setLoading(false);
    }
    return () => { cancel = true; };
  }, [BASE, API_KEY, page, limit]);

  useEffect(() => {
    if (mode === "view") {
      fetchReports();
    }
  }, [mode, fetchReports]);

  const handleCloseAndRefresh = () => {
    setSelectedReportId(null);
    setEditingReport(null);
    fetchReports();
  };

  const handleEdit = (report) => {
    setSelectedReportId(null);
    setEditingReport(report);
  };
  
  const offset = (page - 1) * limit;
  const startItem = rows.length > 0 ? offset + 1 : 0;
  const endItem = offset + rows.length;
  const hasNextPage = rows.length === limit;

  return (
    <div className="w-full space-y-4 relative">
      {/* Header & Controls */}
      <div className="flex justify-between items-center">
        <div className="inline-flex rounded-lg border border-slate-600 overflow-hidden">
            <button
            className={`px-4 py-2 text-sm ${mode === "view" ? "bg-slate-700 text-slate-100" : "bg-slate-900 text-slate-300 hover:bg-slate-800"}`}
            onClick={() => { setPage(1); setTotal(0); setMode("view"); }}
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

        {/* REVIEW SELECTED BUTTON (Visible if items selected) */}
        {selectedReports.size > 0 && (
            <button 
                onClick={() => setShowSelectionModal(true)}
                className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-semibold rounded shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-right-4"
            >
                <span>✅</span> View Selected ({selectedReports.size})
            </button>
        )}
      </div>

      {mode === "view" ? (
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
          <ViewAllTable rows={rows} loading={loading} err={err} onViewReport={setSelectedReportId} />
        </div>
      ) : (
        // Pass selection props down to ReportSearch
        <ReportSearch 
            onViewReport={setSelectedReportId} 
            selectedMap={selectedReports}
            onToggleReport={toggleReportSelection}
            onBatchSelect={setBatchSelection}
        />
      )}
      
      {/* Modals */}

      {selectedReportId && (
        <ViewReport 
          reportId={selectedReportId} 
          onClose={() => setSelectedReportId(null)} 
          onDeleteSuccess={handleCloseAndRefresh}
          onEdit={handleEdit}
        />
      )}

      {editingReport && (
        <EditReport
          report={editingReport}
          onClose={() => setEditingReport(null)}
          onSaveSuccess={handleCloseAndRefresh}
        />
      )}

      {/* Selected Reports Modal */}
      {showSelectionModal && (
        <SelectedReportsModal 
            selectedMap={selectedReports}
            onClose={() => setShowSelectionModal(false)}
            onClear={clearAllSelections}
            onRemove={(r) => toggleReportSelection(r)}
            onSend={handleSendSelected}
        />
      )}
    </div>
  );
}

// --- Helper Components ---

function SelectedReportsModal({ selectedMap, onClose, onClear, onRemove, onSend }) {
    const reports = Array.from(selectedMap.values());

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-800 border border-slate-600 rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-white">Selected Reports ({reports.length})</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">&times;</button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {reports.length === 0 && <p className="text-slate-400 text-center py-8">No reports selected.</p>}
                    {reports.map((r, i) => (
                        <div key={r.id || i} className="flex justify-between items-start bg-slate-900 p-3 rounded border border-slate-700">
                            <div className="text-sm">
                                <div className="font-semibold text-slate-200">{r.title || "Untitled"}</div>
                                <div className="text-slate-400 text-xs mt-1">
                                    {r.date_of_information ? new Date(r.date_of_information).toLocaleDateString() : 'No Date'} • {r.country}
                                </div>
                            </div>
                            <button 
                                onClick={() => onRemove(r)}
                                className="text-slate-500 hover:text-red-400 px-2"
                                title="Remove from selection"
                            >
                                &times;
                            </button>
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex justify-between">
                    <button 
                        onClick={onClear}
                        className="px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:underline"
                    >
                        Clear stored reports
                    </button>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-sm bg-slate-700 text-slate-200 rounded hover:bg-slate-600">
                            Cancel
                        </button>
                        <button 
                            onClick={onSend}
                            disabled={reports.length === 0}
                            className="px-4 py-2 text-sm bg-green-600 text-white font-semibold rounded hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Send to INTSUM Builder
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function PaginationHeader({ start, end, total, page, hasNextPage, onPageChange, loading }) {
  const showingText = total > 0 ? `Showing ${start} - ${end} of ${total}` : `Showing ${start} - ${end}`;
  if (start === 0 && end === 0) return null;
  return (
    <div className="flex justify-between items-center text-sm text-slate-400">
      <span>{showingText}</span>
      <div className="flex gap-2">
        <button onClick={() => onPageChange(p => p - 1)} disabled={page === 1 || loading} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded-md disabled:opacity-50">&larr; Previous</button>
        <button onClick={() => onPageChange(p => p + 1)} disabled={!hasNextPage || loading} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded-md disabled:opacity-50">Next &rarr;</button>
      </div>
    </div>
  );
}

function ViewAllTable({ rows, loading, err, onViewReport }) {
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
              <tr key={id} className="odd:bg-slate-800 even:bg-slate-700 hover:bg-slate-600 cursor-pointer" onClick={() => onViewReport(id)}>
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

// Utility functions
function Th({ children }) { return <th className="px-4 py-3 text-left font-semibold border-b border-slate-700 select-none">{children}</th>; }
function Td({ children, className = "" }) { return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>; }
function fmtDate(d) {
    if (!d) return "—";
    const t = typeof d === "string" || typeof d === "number" ? Date.parse(d) : NaN;
    if (!Number.isFinite(t)) return String(d);
    return new Date(t).toLocaleDateString();
}
function nz(v) { return (v === null || v === undefined) ? "" : String(v); }
function truncate(s, n) { return (!s) ? "" : (s.length > n ? s.slice(0, n - 1) + "…" : s); }