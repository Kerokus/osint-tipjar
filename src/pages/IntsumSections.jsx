import { useState, useEffect } from "react";

export default function IntsumSections() {
  const [sections, setSections] = useState([]);
  const [deletedIds, setDeletedIds] = useState([]); // Track IDs to delete on save
  const [newSectionName, setNewSectionName] = useState("");
  const [countryInputs, setCountryInputs] = useState({});
  const [error, setError] = useState(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
  const API_KEY = import.meta.env.VITE_API_KEY;

  // Fetch sections from the database on mount
  const fetchSections = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/intsum_sections`, {
        method: "GET",
        headers: { 
          "Content-Type": "application/json", 
          "x-api-key": API_KEY 
        }
      });
      if (!res.ok) throw new Error("Failed to fetch sections from the database.");
      const data = await res.json();
      setSections(Array.isArray(data) ? data : []);
      setDeletedIds([]); // Clear any pending deletions
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSections();
  }, []);

  // Check if a country is already used anywhere locally
  const isCountryUsed = (country) => {
    const normalized = country.toUpperCase().trim();
    return sections.some((sec) => sec.countries && sec.countries.includes(normalized));
  };

  const handleAddSection = () => {
    if (!newSectionName.trim()) return;
    if (sections.some((s) => s.name.toLowerCase() === newSectionName.trim().toLowerCase())) {
      setError("A section with this name already exists.");
      return;
    }
    
    setSections([
      ...sections,
      // Use a temporary ID prefix so we know to POST instead of PUT on save
      { id: `temp-${Date.now()}`, name: newSectionName.trim(), countries: [] }
    ]);
    setNewSectionName("");
    setError(null);
  };

  const handleDeleteSection = (id) => {
    // If it's a real database ID, add it to the deletion queue
    if (!String(id).startsWith("temp-")) {
      setDeletedIds([...deletedIds, id]);
    }
    setSections(sections.filter((s) => s.id !== id));
  };

  const handleMoveSection = (index, direction) => {
    const newSections = [...sections];
    if (direction === "UP" && index > 0) {
      [newSections[index - 1], newSections[index]] = [newSections[index], newSections[index - 1]];
    } else if (direction === "DOWN" && index < newSections.length - 1) {
      [newSections[index + 1], newSections[index]] = [newSections[index], newSections[index + 1]];
    }
    setSections(newSections);
  };

  const handleAddCountry = (sectionId) => {
    const rawCountry = countryInputs[sectionId] || "";
    if (!rawCountry.trim()) return;

    const normalizedCountry = rawCountry.toUpperCase().trim();

    if (isCountryUsed(normalizedCountry)) {
      setError(`"${normalizedCountry}" is already assigned to a section. A country can only be used once.`);
      return;
    }

    setSections(sections.map((sec) => {
      if (sec.id === sectionId) {
        return { ...sec, countries: [...(sec.countries || []), normalizedCountry] };
      }
      return sec;
    }));

    setCountryInputs({ ...countryInputs, [sectionId]: "" });
    setError(null);
  };

  const handleRemoveCountry = (sectionId, countryToRemove) => {
    setSections(sections.map((sec) => {
      if (sec.id === sectionId) {
        return { ...sec, countries: sec.countries.filter((c) => c !== countryToRemove) };
      }
      return sec;
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setSaveMessage("");

    try {
      // Pull the token just like the other components do
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Authentication error. Please log in again.");

      // Set up the standard headers
      const headers = {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "Authorization": `Bearer ${token}`
      };

      // 1. Process Deletions First
      for (const id of deletedIds) {
        const res = await fetch(`${API_URL}/intsum_sections/${id}`, {
          method: "DELETE",
          headers: headers
        });
        if (!res.ok) throw new Error(`Failed to delete section ID ${id}`);
      }

      // 2. Process Updates and Creations sequentially to ensure order and catch constraints cleanly
      for (let i = 0; i < sections.length; i++) {
        const sec = sections[i];
        const payload = {
          name: sec.name,
          sort_order: i + 1, // Enforce the current array index as the DB sort_order
          countries: sec.countries || []
        };

        let res;
        if (String(sec.id).startsWith("temp-")) {
          // It's a newly added section
          res = await fetch(`${API_URL}/intsum_sections`, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(payload)
          });
        } else {
          // It's an existing section being updated
          res = await fetch(`${API_URL}/intsum_sections/${sec.id}`, {
            method: "PUT",
            headers: headers,
            body: JSON.stringify(payload)
          });
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `Failed to save section: ${sec.name}`);
        }
      }

      setSaveMessage("Sections saved successfully! They will now be used in the INTSUM Builder.");
      setTimeout(() => setSaveMessage(""), 3000);
      
      // Refresh to grab the real database IDs for any 'temp-' sections we just posted
      await fetchSections(); 

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDiscardChanges = () => {
    if (window.confirm("Are you sure you want to discard unsaved changes? This will reload the current database configuration.")) {
      fetchSections();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Manage INTSUM Sections</h2>
            <p className="text-slate-400 text-sm mt-1">
              Define the regions and order for your INTSUM reports. <br/>
              <span className="italic">Note: "Additional Reporting" is automatically added to the end of the report for unmapped countries.</span>
            </p>
          </div>
          <div className="flex gap-2">
             <button 
                onClick={handleDiscardChanges} 
                disabled={loading}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium text-sm disabled:opacity-50"
             >
              Discard Changes
            </button>
            <button 
                onClick={handleSave} 
                disabled={loading}
                className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded font-medium text-sm flex items-center gap-2 disabled:opacity-50"
             >
              {loading ? "Saving..." : "Save Configuration"}
            </button>
          </div>
        </div>

        {error && <div className="text-red-400 text-sm bg-red-900/20 p-3 rounded border border-red-900">{error}</div>}
        {saveMessage && <div className="text-green-400 text-sm bg-green-900/20 p-3 rounded border border-green-900">{saveMessage}</div>}

        {/* Add New Section */}
        <div className="flex gap-2 pt-4 border-t border-slate-700">
          <input
            type="text"
            placeholder="New Section Name (e.g., Eastern Europe)"
            className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-slate-100 text-sm focus:border-blue-500 outline-none"
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddSection()}
          />
          <button 
            onClick={handleAddSection} 
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium text-sm"
          >
            Add Section
          </button>
        </div>
      </div>

      {/* Sections List */}
      <div className="space-y-4">
        {sections.length === 0 && !loading && (
            <div className="text-slate-400 text-center py-8">No sections found. Add one above to get started.</div>
        )}
        
        {sections.map((section, index) => (
          <div key={section.id} className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <button onClick={() => handleMoveSection(index, "UP")} disabled={index === 0} className="text-slate-400 hover:text-white disabled:opacity-30">▲</button>
                  <button onClick={() => handleMoveSection(index, "DOWN")} disabled={index === sections.length - 1} className="text-slate-400 hover:text-white disabled:opacity-30">▼</button>
                </div>
                <h3 className="text-lg font-bold text-slate-100">{section.name}</h3>
              </div>
              <button onClick={() => handleDeleteSection(section.id)} className="text-red-400 hover:text-red-300 text-sm underline">
                Delete Section
              </button>
            </div>

            <div className="mb-4">
              {(!section.countries || section.countries.length === 0) ? (
                <span className="text-slate-500 text-sm italic">No countries assigned.</span>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {section.countries.map((country) => (
                    <span key={country} className="bg-slate-700 text-slate-200 text-xs px-2 py-1 rounded flex items-center gap-2">
                      {country}
                      <button onClick={() => handleRemoveCountry(section.id, country)} className="text-slate-400 hover:text-red-400">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add Country/Code (e.g., UKR or UKRAINE)"
                className="w-64 bg-slate-900 border border-slate-600 rounded px-3 py-1 text-slate-100 text-sm focus:border-blue-500 outline-none"
                value={countryInputs[section.id] || ""}
                onChange={(e) => setCountryInputs({ ...countryInputs, [section.id]: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCountry(section.id)}
              />
              <button onClick={() => handleAddCountry(section.id)} className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm">
                Add
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}