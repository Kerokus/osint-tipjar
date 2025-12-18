import { useState, useMemo, useEffect, useCallback } from "react";

export default function Platforms() {
  
  // State for API results and loading status
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for the modals
  const [isAdding, setIsAdding] = useState(false);
  const [platformToDelete, setPlatformToDelete] = useState(null);

  // API configuration
  const BASE = useMemo(() => (import.meta.env.VITE_API_URL || "").replace(/\/+$/, ""), []);
  const API_KEY = import.meta.env.VITE_API_KEY;

  // Data Fetching
  const fetchPlatforms = useCallback(async () => {
    let cancel = false;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${BASE}/platforms`, {
        method: "GET",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      });

      if (!res.ok) throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
      
      const data = await res.json();
      if (cancel) return;

      setPlatforms(Array.isArray(data) ? data : []);
    } catch (e) {
      if (!cancel) setError(String(e));
    } finally {
      if (!cancel) setLoading(false);
    }
    
    return () => { cancel = true; };
  }, [BASE, API_KEY]);

  useEffect(() => {
    fetchPlatforms();
  }, [fetchPlatforms]);

  return (
    <div className="space-y-6 p-4">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-100">Managed Platforms</h1>
        
        {loading && <div className="text-slate-300">Loading platforms...</div>}
        {error && <div className="text-red-400">Error: {error}</div>}
        
        {!loading && !error && platforms.length === 0 && (
          <div className="text-slate-300 p-4 bg-slate-800 rounded-lg text-center">
            No platforms found.
          </div>
        )}

        {platforms.length > 0 && (
          <PlatformTable rows={platforms} onDeletePlatform={setPlatformToDelete} />
        )}
        
        <div className="pt-4">
            <button
                onClick={() => setIsAdding(true)}
                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-500 rounded-md text-white font-semibold"
            >
                Add New Platform
            </button>
        </div>
      </div>
      
      {/* --- Modals --- */}
      {isAdding && (
        <AddPlatformModal
          onClose={() => setIsAdding(false)}
          onAddSuccess={() => {
            setIsAdding(false);
            fetchPlatforms();
          }}
          base={BASE}
          apiKey={API_KEY}
        />
      )}
      
      {platformToDelete && (
        <DeleteConfirmModal
          platform={platformToDelete}
          onClose={() => setPlatformToDelete(null)}
          onDeleteSuccess={() => {
            setPlatformToDelete(null);
            fetchPlatforms();
          }}
          base={BASE}
          apiKey={API_KEY}
        />
      )}
    </div>
  );
}

/* ---------- Sub-components ---------- */

function PlatformTable({ rows, onDeletePlatform }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-600">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-900 text-slate-200">
          <tr>
            <Th>Platform Name</Th>
            <Th className="text-right w-20">Delete</Th>
          </tr>
        </thead>
        <tbody className="text-slate-200">
          {rows.map((platform) => (
            <tr key={platform.id} className="odd:bg-slate-800 even:bg-slate-700 hover:bg-slate-600">
              <Td className="font-medium">{platform.platform_name}</Td>
              <Td className="text-right">
                <button
                  onClick={() => onDeletePlatform(platform)}
                  className="px-2 py-1 text-lg font-bold text-red-400 hover:text-red-200 hover:bg-red-800/50 rounded-md leading-none"
                  title="Delete platform"
                >
                  &times;
                </button>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddPlatformModal({ onClose, onAddSuccess, base, apiKey }) {
  const [platformName, setPlatformName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  const handleSubmit = async () => {
    setModalError("");
    if (!platformName.trim()) {
      setModalError("Platform name cannot be empty.");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Authentication error. Please log in again.");

      const res = await fetch(`${base}/platforms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ platform_name: platformName }),
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
      <div className="relative w-full max-w-md rounded-2xl border border-slate-600 bg-slate-800 shadow-xl">
        <div className="px-6 py-4 border-b border-slate-600 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-100">Add New Platform</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">&times;</button>
        </div>
        
        <div className="p-6 space-y-4">
          {modalError && <div className="p-3 text-sm text-red-200 bg-red-800/50 border border-red-700 rounded-md">{modalError}</div>}
          
          <div>
            <label htmlFor="platform_name" className="block text-sm font-medium text-slate-300 mb-1">Platform Name</label>
            <input
              id="platform_name"
              autoFocus
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g. Instagram, LinkedIn..."
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-600 flex justify-end items-center gap-4">
          <button onClick={onClose} disabled={isSubmitting} className="px-4 py-2 text-sm bg-slate-600 hover:bg-slate-500 rounded-md text-slate-200 disabled:opacity-50">Cancel</button>
          <button onClick={handleSubmit} disabled={isSubmitting} className="px-4 py-2 text-sm bg-green-600 hover:bg-green-500 rounded-md text-white font-semibold disabled:opacity-50">
            {isSubmitting ? "Adding..." : "Add Platform"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ platform, onClose, onDeleteSuccess, base, apiKey }) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [modalError, setModalError] = useState("");

    const handleDelete = async () => {
        setIsDeleting(true);
        setModalError("");
        try {
            const token = localStorage.getItem("token");
            if (!token) throw new Error("Authentication error. Please log in again.");

            const res = await fetch(`${base}/platforms/${platform.id}`, {
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

            onDeleteSuccess();
        } catch (e) {
            setModalError(String(e).replace(/^Error:\s*/, ''));
            setIsDeleting(false); 
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={onClose} />
            <div className="relative w-full max-w-md rounded-2xl border border-slate-600 bg-slate-800 shadow-xl">
                <div className="px-6 py-4 border-b border-slate-600 text-slate-100 font-semibold">
                    Confirm Deletion
                </div>

                <div className="p-6 space-y-4">
                    {modalError && <div className="p-3 text-sm text-red-200 bg-red-800/50 border border-red-700 rounded-md">{modalError}</div>}
                    <p className="text-slate-300">
                        Are you sure you want to delete <strong className="font-semibold text-slate-100">{platform.platform_name}</strong>? This action cannot be undone.
                    </p>
                </div>
                
                <div className="px-6 py-4 border-t border-slate-600 flex justify-end items-center gap-4">
                    <button onClick={onClose} disabled={isDeleting} className="px-4 py-2 text-sm bg-slate-600 hover:bg-slate-500 rounded-md text-slate-200 disabled:opacity-50">Cancel</button>
                    <button onClick={handleDelete} disabled={isDeleting} className="px-4 py-2 text-sm bg-red-700 hover:bg-red-600 rounded-md text-white font-semibold disabled:opacity-50">
                        {isDeleting ? "Deleting..." : "Yes, Delete"}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ---------- Reusable Components ---------- */

function Th({ children, className = "" }) {
  return <th className={`px-4 py-3 text-left font-semibold border-b border-slate-700 select-none ${className}`}>{children}</th>;
}

function Td({ children, className = "" }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}