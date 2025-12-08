import React, { useState, useEffect, useMemo } from "react";

export default function AddRequirements({ isOpen, onClose, onConfirm, initialSelected = [] }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Local state for the modal. We only push to parent on "Confirm"
  const [tempSelected, setTempSelected] = useState(initialSelected);

  const BASE = useMemo(() => (import.meta.env.VITE_API_URL || "").replace(/\/+$/, ""), []);
  const API_KEY = import.meta.env.VITE_API_KEY;

  // Sync local state when modal opens or props change
  useEffect(() => {
    if (isOpen) {
        setTempSelected(initialSelected);
    }
  }, [isOpen, initialSelected]);

  // Fetch requirements on mount
  useEffect(() => {
    if (!isOpen) return; // Only fetch if open to save resources
    
    async function fetchReqs() {
      setLoading(true);
      try {
        const res = await fetch(`${BASE}/requirements`, {
            headers: { "x-api-key": API_KEY }
        });
        if (!res.ok) throw new Error("Failed to load requirements");
        const data = await res.json();
        setCategories(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    }

    // Simple cache check or just refetch. 
    // Since requirements don't change often, you could move this up, 
    // but for now, fetching on open ensures freshness.
    fetchReqs();
  }, [isOpen, BASE, API_KEY]);

  const toggleReq = (reqId) => {
    setTempSelected(prev => {
        if (prev.includes(reqId)) {
            return prev.filter(id => id !== reqId);
        } else {
            return [...prev, reqId];
        }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800 rounded-t-lg">
          <h2 className="text-xl font-bold text-slate-100">Select Collection Requirements</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            ✕
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {loading && <div className="text-blue-400 animate-pulse">Loading requirements...</div>}
          {error && <div className="text-red-400">Error: {error}</div>}

          {!loading && !error && categories.map((cat) => (
            <div key={cat.category_code} className="border border-slate-700 rounded bg-slate-800/30">
              <div className="px-4 py-2 bg-slate-800/80 border-b border-slate-700 flex justify-between items-center sticky top-0">
                <span className="font-bold text-yellow-500">{cat.category_name}</span>
                <span className="text-xs text-slate-500 font-mono">{cat.category_code}</span>
              </div>
              <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                {cat.requirements && cat.requirements.filter(Boolean).map(reqId => {
                   const isChecked = tempSelected.includes(reqId);
                   return (
                     <label 
                        key={reqId} 
                        className={`flex items-start gap-3 p-2 rounded cursor-pointer border transition-all ${
                            isChecked 
                            ? "bg-blue-900/30 border-blue-500/50" 
                            : "bg-transparent border-transparent hover:bg-slate-700/50"
                        }`}
                     >
                       <input 
                         type="checkbox" 
                         checked={isChecked} 
                         onChange={() => toggleReq(reqId)}
                         className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900" 
                       />
                       <span className={`text-sm font-mono break-all ${isChecked ? "text-blue-200" : "text-slate-300"}`}>
                         {reqId}
                       </span>
                     </label>
                   );
                })}
                {(!cat.requirements || cat.requirements.length === 0) && (
                    <span className="text-slate-500 text-xs italic p-2">No requirements found.</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-800 rounded-b-lg flex justify-between items-center">
            <div className="text-sm text-slate-400">
                {tempSelected.length} requirements selected
            </div>
            <div className="flex gap-3">
                <button 
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-slate-300 hover:text-white font-medium"
                >
                    Cancel
                </button>
                <button 
                    onClick={() => onConfirm(tempSelected)}
                    className="px-6 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded font-bold shadow-lg shadow-blue-900/20"
                >
                    Okay
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}