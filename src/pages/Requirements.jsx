import { useState, useEffect, useMemo } from "react";
import mammoth from "mammoth";

export default function Requirements() {
  const [activeTab, setActiveTab] = useState("view");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refreshView = () => setRefreshTrigger((prev) => prev + 1);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-100">Requirements Management</h1>

      <div className="rounded-md border border-slate-700 bg-slate-900">
        <div className="flex border-b border-slate-700 divide-x divide-slate-700">
          <button
            onClick={() => setActiveTab("view")}
            className={`px-4 h-10 text-sm font-semibold transition-colors ${
              activeTab === "view" ? "bg-slate-800 text-blue-400" : "bg-slate-950 text-slate-400 hover:bg-slate-800"
            }`}
          >
            View Requirements
          </button>
          <button
            onClick={() => setActiveTab("upload")}
            className={`px-4 h-10 text-sm font-semibold transition-colors ${
              activeTab === "upload" ? "bg-slate-800 text-blue-400" : "bg-slate-950 text-slate-400 hover:bg-slate-800"
            }`}
          >
            Upload Requirements
          </button>
          <button
            onClick={() => setActiveTab("clear")}
            className={`px-4 h-10 text-sm font-semibold transition-colors ${
              activeTab === "clear" ? "bg-red-900/20 text-red-400" : "bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-red-300"
            }`}
          >
            Clear All
          </button>
        </div>

        <div className="p-4">
          {activeTab === "view" ? (
            <ViewTab key={refreshTrigger} />
          ) : activeTab === "upload" ? (
            <UploadTab onSuccess={() => {
              setActiveTab("view");
              refreshView();
            }} />
          ) : (
            <ClearTab onSuccess={() => {
              setActiveTab("view");
              refreshView();
            }} />
          )}
        </div>
      </div>
    </div>
  );
}

// --- View Tab ---

function ViewTab() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modal States
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [addingToCategory, setAddingToCategory] = useState(null); // category_id string if adding

  const BASE = useMemo(() => (import.meta.env.VITE_API_URL || "").replace(/\/+$/, ""), []);
  const API_KEY = import.meta.env.VITE_API_KEY;

  const fetchRequirements = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/requirements`, {
        headers: { "x-api-key": API_KEY }
      });
      if (!res.ok) throw new Error("Failed to fetch requirements");
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequirements();
  }, [BASE, API_KEY]);

  const handleDelete = async (reqId) => {
    if (!window.confirm(`Are you sure you want to delete ${reqId}? This cannot be undone.`)) return;

    try {
      const res = await fetch(`${BASE}/requirements/${reqId}`, {
        method: "DELETE",
        headers: { "x-api-key": API_KEY }
      });
      if (!res.ok) throw new Error("Failed to delete");
      
      // Optimistic Update
      setCategories(cats => cats.map(c => ({
        ...c,
        requirements: c.requirements.filter(r => r !== reqId)
      })));
    } catch (err) {
      alert("Error deleting: " + err);
    }
  };

  const handleAddRequirement = async (e, category) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newId = formData.get("requirement_id").trim();
    
    if (!newId) return;

    const payload = [{
      requirement_id: newId,
      category_name: category.category_name,
      category_id: category.category_code
    }];

    try {
      // POST without ?mode=batch defaults to Append/Upsert
      const res = await fetch(`${BASE}/requirements`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to add requirement");
      
      setAddingToCategory(null);
      fetchRequirements(); // Refresh to get correct sorting
    } catch (err) {
      alert("Error adding: " + err);
    }
  };

  if (loading) return <div className="text-slate-400 animate-pulse">Loading requirements...</div>;
  if (error) return <div className="text-red-400">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-slate-200">Current Requirements</h2>
        <button 
          onClick={() => setIsCategoryModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-medium transition"
        >
          + Add Category
        </button>
      </div>

      <div className="grid gap-6">
        {categories.map((cat) => (
          <div key={cat.category_code} className="border border-slate-700 rounded-lg bg-slate-800/50 overflow-hidden">
            <div className="bg-slate-900/50 px-4 py-3 border-b border-slate-700 flex justify-between items-center">
              <div>
                <span className="text-yellow-500 font-bold font-mono text-lg">[{cat.category_name}]</span>
                <span className="ml-2 text-xs text-slate-500 font-mono">{cat.category_code}</span>
              </div>
              <button 
                onClick={() => setAddingToCategory(cat.category_code)}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-blue-400 px-3 py-1 rounded border border-slate-600 transition"
              >
                + Add Req
              </button>
            </div>

            <div className="p-4 space-y-2">
              {/* Add Requirement Form */}
              {addingToCategory === cat.category_code && (
                <form onSubmit={(e) => handleAddRequirement(e, cat)} className="flex gap-2 mb-4 animate-in fade-in slide-in-from-top-2">
                  <input 
                    name="requirement_id"
                    autoFocus
                    placeholder={`Ex: DDCC0513-OCR-${cat.category_code}-EE...`}
                    className="flex-1 bg-slate-950 border border-blue-500 rounded px-3 py-1 text-sm text-slate-200 font-mono outline-none"
                  />
                  <button type="submit" className="bg-blue-600 text-white px-3 py-1 rounded text-sm">Save</button>
                  <button type="button" onClick={() => setAddingToCategory(null)} className="text-slate-400 hover:text-slate-200 px-2 text-sm">Cancel</button>
                </form>
              )}

              {/* Requirement List */}
              {(!cat.requirements || cat.requirements.length === 0 || cat.requirements[0] === null) ? (
                <div className="text-slate-500 italic text-sm">No requirements in this category.</div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {cat.requirements.filter(Boolean).map((reqId) => (
                    <div key={reqId} className="group flex justify-between items-center bg-slate-800 border border-slate-700/50 rounded px-3 py-2 hover:border-slate-600 transition">
                      <span className="font-mono text-sm text-slate-300">{reqId}</span>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleDelete(reqId)}
                          className="text-red-400 hover:text-red-300 text-xs font-semibold px-2"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {isCategoryModalOpen && (
        <AddCategoryModal 
          onClose={() => setIsCategoryModalOpen(false)} 
          onSuccess={() => {
            setIsCategoryModalOpen(false);
            fetchRequirements();
          }}
          BASE={BASE}
          API_KEY={API_KEY}
        />
      )}
    </div>
  );
}

// --- Upload Tab ---

function UploadTab({ onSuccess }) {
  const [extractedData, setExtractedData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const BASE = useMemo(() => (import.meta.env.VITE_API_URL || "").replace(/\/+$/, ""), []);
  const API_KEY = import.meta.env.VITE_API_KEY;

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setExtractedData([]);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target.result;
        const result = await mammoth.extractRawText({ arrayBuffer });
        parseRequirements(result.value);
      } catch (err) {
        console.error(err);
        setError("Failed to parse the .docx file.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const parseRequirements = (text) => {
    const cleanText = text.replace(/\r?\n|\r/g, " ").replace(/–/g, "-");
    const regex = /\[([^\]]+)\]\s*(\d+)\s*-\s*(.*?)(?=;)/g;
    
    let match;
    const newGroups = [];

    while ((match = regex.exec(cleanText)) !== null) {
      const categoryName = match[1].trim();
      const categoryId = match[2].trim();
      const rawCodes = match[3].trim();

      const requirementObjects = rawCodes.split(",").map(c => {
        let code = c.trim();
        if (code.toUpperCase().startsWith("EE")) code = code.substring(2);
        return {
          requirement_id: `DDCC0513-OCR-${categoryId}-EE${code}`,
          category_name: categoryName,
          category_id: categoryId
        };
      });

      newGroups.push({ categoryDisplay: categoryName, requirements: requirementObjects });
    }

    if (newGroups.length === 0) {
      setError("No requirements found matching the pattern [Category] ID - EE...");
    } else {
      setExtractedData(newGroups);
    }
  };

  const handleUploadToDB = async () => {
    const payload = extractedData.flatMap(group => group.requirements);
    setUploading(true);
    
    try {
      // Note the ?mode=batch query param! This tells the backend to perform a Sync (Delete missing)
      const res = await fetch(`${BASE}/requirements?mode=batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      
      alert(`Sync Complete!\nAdded: ${data.added}\nDeleted: ${data.deleted}\nTotal Active: ${data.total_active}`);
      if (onSuccess) onSuccess();
      
    } catch (err) {
      alert("Error uploading to DB: " + err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 border-2 border-dashed border-slate-700 rounded-lg bg-slate-800/50 flex flex-col items-center justify-center text-center">
        <svg className="w-10 h-10 text-slate-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
        <label className="block mb-2 text-sm font-medium text-slate-300">
          Upload Requirements Document (.docx)
        </label>
        <input
          type="file"
          accept=".docx"
          onChange={handleFileChange}
          className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer max-w-xs"
        />
        <p className="text-xs text-slate-500 mt-2">
          Warning: This acts as a Batch Sync. Any requirements in the Database NOT present in this file will be deleted.
        </p>
      </div>

      {loading && <div className="text-blue-400 font-mono animate-pulse">Parsing document...</div>}
      {error && <div className="text-red-400 bg-red-900/20 p-3 rounded-md border border-red-800">{error}</div>}

      {extractedData.length > 0 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-slate-200">Preview: {extractedData.reduce((acc, g) => acc + g.requirements.length, 0)} Items</h2>
            <button
              onClick={handleUploadToDB}
              disabled={uploading}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-6 py-2 rounded-md font-bold shadow-lg shadow-green-900/20 transition-all"
            >
              {uploading ? "Syncing..." : "Sync to Database"}
            </button>
          </div>
          
          {/* Preview List (Collapsed view) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {extractedData.map((g, i) => (
               <div key={i} className="bg-slate-800 p-3 rounded border border-slate-700">
                 <div className="font-bold text-yellow-500 text-sm mb-1">{g.categoryDisplay}</div>
                 <div className="text-xs text-slate-400 truncate">
                   {g.requirements.map(r => r.requirement_id).join(", ")}
                 </div>
               </div>
             ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- NEW: Clear Tab ---

function ClearTab({ onSuccess }) {
  const [clearing, setClearing] = useState(false);
  const BASE = useMemo(() => (import.meta.env.VITE_API_URL || "").replace(/\/+$/, ""), []);
  const API_KEY = import.meta.env.VITE_API_KEY;

  const handleClearAll = async () => {
    if (!window.confirm("ARE YOU SURE? This will delete ALL requirements from the database. This action cannot be undone.")) {
      return;
    }

    setClearing(true);
    try {
      const res = await fetch(`${BASE}/requirements`, {
        method: "DELETE",
        headers: { "x-api-key": API_KEY }
      });
      
      if (!res.ok) throw new Error("Failed to clear requirements");
      
      alert("All requirements have been successfully deleted.");
      onSuccess();

    } catch (err) {
      alert("Error: " + err);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-6">
      <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-6 max-w-lg text-center">
        <h3 className="text-xl font-bold text-red-400 mb-2">Danger Zone</h3>
        <p className="text-slate-300 text-sm mb-6">
          This action will permanently remove all current requirements. This cannot be undone.
        </p>
        <button
          onClick={handleClearAll}
          disabled={clearing}
          className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-8 py-3 rounded-md font-bold shadow-lg shadow-red-900/30 transition-all"
        >
          {clearing ? "Clearing Database..." : "Clear All Requirements"}
        </button>
      </div>
    </div>
  );
}

// --- Add Category Modal ---

function AddCategoryModal({ onClose, onSuccess, BASE, API_KEY }) {
  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    // Construct the ID based on the pattern
    const reqId = `DDCC0513-OCR-${data.category_id}-EE${data.first_ee_code}`;

    const payload = [{
      requirement_id: reqId,
      category_name: data.category_name,
      category_id: data.category_id
    }];

    try {
      const res = await fetch(`${BASE}/requirements`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed");
      onSuccess();
    } catch (e) {
      alert("Error creating category: " + e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 p-6 rounded-lg w-full max-w-md shadow-2xl">
        <h3 className="text-lg font-bold text-slate-100 mb-4">Add New Category</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Category Name</label>
            <input name="category_name" required placeholder="IRN MILECON/POL Relations" className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-slate-200 text-sm focus:border-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Category Code</label>
            <input name="category_id" required placeholder="17317" className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-slate-200 text-sm focus:border-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">First Requirement Code (EE Number)</label>
            <div className="flex items-center gap-2">
               <span className="text-slate-500 text-sm font-mono">EE</span>
               <input name="first_ee_code" required placeholder="6146" className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-slate-200 text-sm focus:border-blue-500 outline-none" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded font-medium">Create Category</button>
          </div>
        </form>
      </div>
    </div>
  );
}