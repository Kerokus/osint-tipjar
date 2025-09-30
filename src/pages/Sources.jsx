import { useState, useMemo, useEffect, useCallback } from "react";

/**
 * Sources.jsx
 * * A single-page component to search, view, and manage sources.
 * It combines search controls and results display into one view,
 * and includes a modal for viewing and editing individual source details.
 */
export default function Sources() {
  // State for search form inputs
  const [params, setParams] = useState({
    source_name: "",
    source_description: "",
    source_platform: "",
    added_by: "",
  });

  // State to trigger the API call
  const [activeQuery, setActiveQuery] = useState({});

  // State for API results and loading status
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for the modals
  const [selectedSource, setSelectedSource] = useState(null);
  const [isAddingSource, setIsAddingSource] = useState(false); // --- ADDED --- State for the new modal

  // State for pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(50); // Hardcoded limit as requested
  const [total, setTotal] = useState(0);

  // Admin status from local storage
  const [isAdmin, setIsAdmin] = useState(false);

  const BASE = useMemo(() => (import.meta.env.VITE_API_URL || "").replace(/\/+$/, ""), []);
  const API_KEY = import.meta.env.VITE_API_KEY;

  // Check admin status on component mount
  useEffect(() => {
    const adminStatus = localStorage.getItem("is_admin") === "true";
    setIsAdmin(adminStatus);
  }, []);

  // --- Handlers ---

  const handleParamChange = (e) => {
    const { name, value } = e.target;
    setParams((prev) => ({ ...prev, [name]: value }));
  };

  const platformOptions = ["Website", "X User", "Telegram User", "BlueSky User", "Facebook User", "Instagram User", "YouTube User", "Tiktok User", "VK User", "MySpace User", "Aparat User"];

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setTotal(0);
    setActiveQuery(params);
  };
  
  const handleReset = () => {
    setParams({ source_name: "", source_description: "", source_platform: "", added_by: "" });
    setPage(1);
    setTotal(0);
    setActiveQuery({}); // Trigger a fetch for all items
  }

  // --- Data Fetching Effect ---

  const fetchSources = useCallback(async () => {
    let cancel = false;
    setLoading(true);
    setError(null);

    const offset = (page - 1) * limit;
    const urlParams = new URLSearchParams();

    const likeableKeys = ["source_name", "source_description", "source_platform", "added_by"];

    for (const key in activeQuery) {
      if (activeQuery[key]) {
        urlParams.append(key, activeQuery[key]);
        if (likeableKeys.includes(key)) {
          urlParams.append(`${key}_like`, "true");
        }
      }
    }
    urlParams.append("limit", limit);
    urlParams.append("offset", offset);

    try {
      const res = await fetch(`${BASE}/sources?${urlParams.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      });

      if (!res.ok) throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
      
      const data = await res.json();
      if (cancel) return;

      setSources(Array.isArray(data) ? data : []);

      if (data.length < limit) {
        setTotal(offset + data.length);
      } else {
        setTotal(0); 
      }
    } catch (e) {
      if (!cancel) setError(String(e));
    } finally {
      if (!cancel) setLoading(false);
    }
    
    return () => { cancel = true; };
  }, [activeQuery, page, limit, BASE, API_KEY]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);


  // --- Render Logic ---
  
  const offset = (page - 1) * limit;
  const startItem = sources.length > 0 ? offset + 1 : 0;
  const endItem = offset + sources.length;
  const hasNextPage = sources.length === limit;

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <form onSubmit={handleSearch} onReset={handleReset} className="p-4 bg-slate-800 border border-slate-600 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input label="Source Name" name="source_name" value={params.source_name} onChange={handleParamChange} placeholder="e.g., @example_channel" />
          <Input label="Source Description" name="source_description" value={params.source_description} onChange={handleParamChange} placeholder="Keywords..." />
          <div>
            <label htmlFor="source_platform" className="block text-sm font-medium text-slate-300 mb-1">Source Platform</label>
            <select
              id="source_platform"
              name="source_platform"
              value={params.source_platform}
              onChange={handleParamChange}
              className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Any Platform</option>
              {platformOptions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <Input label="Added By" name="added_by" value={params.added_by} onChange={handleParamChange} placeholder="e.g., analyst_cin" />
        </div>
        {/* --- MODIFIED --- Added a new div wrapper and the "Add Source" button */}
        <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-4">
                <button type="submit" className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 rounded-md text-white font-semibold">Search</button>
                <button type="reset" className="px-4 py-2 text-sm bg-slate-600 hover:bg-slate-500 rounded-md text-slate-200">Reset</button>
            </div>
            <button 
                type="button" 
                onClick={() => setIsAddingSource(true)}
                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-500 rounded-md text-white font-semibold"
            >
                Add Source
            </button>
        </div>
      </form>
      
      {/* Results Section */}
      <div className="space-y-4">
        <PaginationHeader start={startItem} end={endItem} total={total} page={page} hasNextPage={hasNextPage} onPageChange={setPage} loading={loading} />

        {loading && <div className="text-slate-300">Loading sources...</div>}
        {error && <div className="text-red-400">Error: {error}</div>}
        {!loading && !error && sources.length === 0 && <div className="text-slate-300">No sources found.</div>}

        {sources.length > 0 && (
          <SourceList rows={sources} onViewSource={setSelectedSource} />
        )}
      </div>
      
      {/* Modals */}
      {selectedSource && (
        <SourceModal 
          source={selectedSource} 
          onClose={() => setSelectedSource(null)}
          isAdmin={isAdmin}
          onSaveSuccess={() => {
            setSelectedSource(null); 
            fetchSources(); 
          }}
          base={BASE}
          apiKey={API_KEY}
        />
      )}
      
      {/* --- ADDED --- Render the new AddSourceModal */}
      {isAddingSource && (
        <AddSourceModal
          onClose={() => setIsAddingSource(false)}
          onAddSuccess={() => {
            setIsAddingSource(false); // Close modal on success
            fetchSources(); // Re-fetch the list to show the new source
          }}
          base={BASE}
          apiKey={API_KEY}
        />
      )}
    </div>
  );
}


/* ---------- Sub-components ---------- */

// --- ADDED --- New component for the "Add Source" modal
function AddSourceModal({ onClose, onAddSuccess, base, apiKey }) {
  const [newSource, setNewSource] = useState({
    source_name: "",
    source_platform: "",
    source_description: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  const platformOptions = ["Website", "X User", "Telegram User", "BlueSky User", "Facebook User", "Instagram User", "YouTube User", "Tiktok User", "VK User", "MySpace User", "Aparat User"];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNewSource(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    setModalError("");
    if (!newSource.source_name || !newSource.source_platform) {
      setModalError("Source Name and Platform are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const cin = localStorage.getItem("cin");
      const token = localStorage.getItem("token");
      if (!cin || !token) throw new Error("Authentication error. Please log in again.");

      const body = {
        ...newSource,
        added_by: cin,
      };

      const res = await fetch(`${base}/sources`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP Error: ${res.status}`);
      }
      
      onAddSuccess();

    } catch (e) {
      setModalError(String(e).replace(/^Error:\s*/, ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-600 bg-slate-800 shadow-xl">
        <div className="px-6 py-4 border-b border-slate-600 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-100">Add New Source</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">&times;</button>
        </div>
        
        <div className="p-6 space-y-4">
          {modalError && <div className="p-3 text-sm text-red-200 bg-red-800/50 border border-red-700 rounded-md">{modalError}</div>}
          
          <Input label="Source Name" name="source_name" value={newSource.source_name} onChange={handleChange} placeholder="e.g., @example_channel" />
          
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Platform</label>
            <select name="source_platform" value={newSource.source_platform} onChange={handleChange} className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100 focus:ring-blue-500 focus:border-blue-500">
              <option value="">Select a Platform</option>
              {platformOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
            <textarea name="source_description" value={newSource.source_description} onChange={handleChange} rows="4" placeholder="(Optional) Add any relevant details..." className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100 focus:ring-blue-500 focus:border-blue-500" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-600 flex justify-end items-center gap-4">
          <button onClick={onClose} disabled={isSubmitting} className="px-4 py-2 text-sm bg-slate-600 hover:bg-slate-500 rounded-md text-slate-200 disabled:opacity-50">Cancel</button>
          <button onClick={handleSubmit} disabled={isSubmitting} className="px-4 py-2 text-sm bg-green-600 hover:bg-green-500 rounded-md text-white font-semibold disabled:opacity-50">
            {isSubmitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}


function SourceList({ rows, onViewSource }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-600">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-900 text-slate-200">
          <tr>
            <Th>Source Name</Th>
            <Th>Platform</Th>
            <Th>Description</Th>
            <Th>Added By</Th>
          </tr>
        </thead>
        <tbody className="text-slate-200">
          {rows.map((r) => (
            <tr
              key={r.id}
              className="odd:bg-slate-800 even:bg-slate-700 hover:bg-slate-600 cursor-pointer"
              onClick={() => onViewSource(r)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onViewSource(r); }}}
              role="button"
              tabIndex={0}
              title="View source details"
            >
              <Td>{nz(r.source_name)}</Td>
              <Td>{nz(r.source_platform)}</Td>
              <Td className="max-w-[60ch]">{truncate(nz(r.source_description), 150)}</Td>
              <Td>{nz(r.added_by)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SourceModal({ source, onClose, isAdmin, onSaveSuccess, base, apiKey }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editableSource, setEditableSource] = useState({
    source_name: source.source_name,
    source_platform: source.source_platform,
    source_description: source.source_description,
  });
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const platformOptions = ["Website", "X User", "Telegram User", "BlueSky User", "Facebook User", "Instagram User", "YouTube User", "Tiktok User", "VK User", "MySpace User", "Aparat User"];

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditableSource(prev => ({...prev, [name]: value }));
  };
  
  const handleSave = async () => {
    setSaving(true);
    setModalError("");
    try {
      const cin = localStorage.getItem("cin");
      const token = localStorage.getItem("token");
      if (!cin || !token) throw new Error("Authentication error. Please log in again.");

      const body = {
        ...editableSource,
        modified_by: cin,
      };

      const res = await fetch(`${base}/sources/${source.id}`, {
        method: "PUT",
        headers: { 
            "Content-Type": "application/json", 
            "x-api-key": apiKey,
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP Error: ${res.status}`);
      }
      
      onSaveSuccess();

    } catch(e) {
      setModalError(String(e).replace(/^Error:\s*/, ''));
    } finally {
      setSaving(false);
    }
  };
  
  const handleCancel = () => {
      setIsEditing(false);
      setModalError("");
      setEditableSource({
          source_name: source.source_name,
          source_platform: source.source_platform,
          source_description: source.source_description,
      });
  }

  const handleDelete = async () => {
    setIsDeleting(true);
    setModalError("");
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Authentication error. Please log in again.");

      const res = await fetch(`${base}/sources/${source.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP Error: ${res.status}`);
      }

      onSaveSuccess();
    } catch (e) {
      setModalError(String(e).replace(/^Error:\s*/, ''));
      setIsDeleting(false); 
    }
  };

  const getDeleteTitle = () => {
      if (!isAdmin) return "Only Admin roles can delete sources";
      if (isEditing) return "Cannot delete while editing";
      return "Permanently delete this source";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-600 bg-slate-800 shadow-xl">
        <div className="px-6 py-4 border-b border-slate-600 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-100">
            Source Details <span className="font-bold text-slate-400">(ID: {source.id})</span>
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">&times;</button>
        </div>
        
        <div className="p-6 space-y-4">
            {modalError && <div className="p-3 text-sm text-red-200 bg-red-800/50 border border-red-700 rounded-md">{modalError}</div>}
            
            <div className="space-y-3">
                <EditableField label="Source Name" name="source_name" isEditing={isEditing} value={editableSource.source_name} onChange={handleEditChange} />
                <EditableField as="select" label="Platform" name="source_platform" isEditing={isEditing} value={editableSource.source_platform} onChange={handleEditChange} options={platformOptions} />
                <EditableField as="textarea" label="Description" name="source_description" isEditing={isEditing} value={editableSource.source_description} onChange={handleEditChange} />
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 pt-4 border-t border-slate-700">
              <MetadataField label="Added By" value={nz(source.added_by)} />
              <MetadataField label="Added On" value={fmtDate(source.added_on)} />
              <MetadataField label="Modified By" value={nz(source.modified_by)} />
              <MetadataField label="Modified On" value={fmtDate(source.modified_on)} />
            </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-600">
          {isConfirmingDelete ? (
            <div className="flex justify-between items-center">
              <p className="text-sm font-semibold text-red-300">Are you sure?</p>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsConfirmingDelete(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm bg-slate-600 hover:bg-slate-500 rounded-md text-slate-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm bg-red-700 hover:bg-red-600 rounded-md text-white font-semibold disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Yes, Delete"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <button
                  className="px-4 py-2 text-sm bg-red-700 hover:bg-red-600 rounded-md text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!isAdmin || isEditing}
                  title={getDeleteTitle()}
                  onClick={() => setIsConfirmingDelete(true)}
                >
                  Delete
                </button>
              </div>
              <div className="flex items-center gap-4">
                {isAdmin && !isEditing && (
                  <button onClick={() => setIsEditing(true)} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 rounded-md text-white font-semibold">
                    Edit
                  </button>
                )}
                {isEditing && (
                  <>
                    <button onClick={handleCancel} disabled={saving} className="px-4 py-2 text-sm bg-slate-600 hover:bg-slate-500 rounded-md text-slate-200 disabled:opacity-50">Cancel</button>
                    <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-green-600 hover:bg-green-500 rounded-md text-white font-semibold disabled:opacity-50">
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EditableField({ label, name, isEditing, value, onChange, as = 'input', options = [] }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-400 mb-1">{label}</label>
      {isEditing ? (
        as === 'textarea' ? (
          <textarea name={name} value={value} onChange={onChange} rows="4" className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100 focus:ring-blue-500 focus:border-blue-500" />
        ) : as === 'select' ? (
          <select name={name} value={value} onChange={onChange} className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100 focus:ring-blue-500 focus:border-blue-500">
            <option value="">Select a Platform</option>
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        ) : (
          <input type="text" name={name} value={value} onChange={onChange} className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100 focus:ring-blue-500 focus:border-blue-500" />
        )
      ) : (
        <p className="text-slate-100 min-h-[2.25rem] py-2 px-3 bg-slate-700/50 rounded-md whitespace-pre-wrap">{nz(value) || "—"}</p>
      )}
    </div>
  );
}

function MetadataField({ label, value }) {
    return (
        <div>
            <div className="text-xs text-slate-400">{label}</div>
            <div className="text-sm text-slate-200">{value || "—"}</div>
        </div>
    )
}

/* ---------- Reusable Components & Utils ---------- */

function Input({ label, ...props }) {
  return (
    <div>
      <label htmlFor={props.name} className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
      <input
        {...props}
        className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100 focus:ring-blue-500 focus:border-blue-500"
      />
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
        <button onClick={() => onPageChange(p => p - 1)} disabled={page === 1 || loading} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed">&larr; Previous</button>
        <button onClick={() => onPageChange(p => p + 1)} disabled={!hasNextPage || loading} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed">Next &rarr;</button>
      </div>
    </div>
  );
}

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
  return new Date(t).toLocaleString();
}

function nz(v) {
  return v === null || v === undefined ? "" : String(v);
}

function truncate(s, n) {
  return !s ? "" : s.length > n ? s.slice(0, n - 1) + "…" : s;
}