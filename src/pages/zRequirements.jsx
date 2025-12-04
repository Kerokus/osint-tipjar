import { useState } from "react";
import mammoth from "mammoth";

export default function Requirements() {
  const [activeTab, setActiveTab] = useState("view");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-100">Requirements Management</h1>

      {/* Tabs */}
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
        </div>

        <div className="p-4">
          {activeTab === "view" ? <ViewTab /> : <UploadTab />}
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function ViewTab() {
  return (
    <div className="text-center py-12 text-slate-500">
      <p className="text-lg">Requirement Viewer Coming Soon</p>
      <p className="text-sm">Please switch to the Upload tab to process new documents.</p>
    </div>
  );
}

function UploadTab() {
  const [extractedData, setExtractedData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
        // Extract raw text from docx
        const result = await mammoth.extractRawText({ arrayBuffer });
        const text = result.value;
        
        parseRequirements(text);
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
    // 1. Normalize text: Remove newlines to make regex easier, convert en-dashes to hyphens
    const cleanText = text.replace(/\r?\n|\r/g, " ").replace(/–/g, "-");

    // 2. REGEX Strategy
    // Looking for: [Category Name] CategoryID - EEList;
    const regex = /\[([^\]]+)\]\s*(\d+)\s*-\s*(.*?)(?=;)/g;
    
    let match;
    const newGroups = [];

    while ((match = regex.exec(cleanText)) !== null) {
      const categoryName = match[1].trim(); // Captured without brackets
      const categoryId = match[2].trim();   // The ID number (e.g., 17317)
      const rawCodes = match[3].trim();     // e.g. "EE6146, 6147, 6228"

      // Process the codes into fully structured objects
      const requirementObjects = rawCodes.split(",").map(c => {
        let code = c.trim();
        // Check if it starts with EE. Strip it and re-add it to ensure consistency.
        if (code.toUpperCase().startsWith("EE")) {
          code = code.substring(2);
        }
        
        const fullRequirementId = `DDCC0513-OCR-${categoryId}-EE${code}`;

        // Return the object structure expected by the DB
        return {
          requirement_id: fullRequirementId,
          category_name: categoryName,
          category_id: categoryId
        };
      });

      newGroups.push({
        categoryDisplay: categoryName, // For UI grouping
        requirements: requirementObjects // Array of objects
      });
    }

    if (newGroups.length === 0) {
      setError("No requirements found matching the pattern [Category] ID - EE...");
    } else {
      setExtractedData(newGroups);
    }
  };

  const handleUpdateRequirement = (groupIndex, reqIndex, newValue) => {
    const newData = [...extractedData];
    // We now update the .requirement_id property of the object
    newData[groupIndex].requirements[reqIndex].requirement_id = newValue;
    setExtractedData(newData);
  };

  const handleMockUpload = () => {
    // Flatten the grouped data into a single list of objects for the DB
    const payload = extractedData.flatMap(group => group.requirements);
    
    console.log("Uploading Payload to DB:", payload);
    alert(`Successfully processed ${payload.length} requirements! Check console for object structure.`);
  };

  return (
    <div className="space-y-6">
      {/* File Input */}
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
          Expected format: [Category] ID - EE####, ####;
        </p>
      </div>

      {loading && <div className="text-blue-400 font-mono animate-pulse">Parsing document...</div>}
      {error && <div className="text-red-400 bg-red-900/20 p-3 rounded-md border border-red-800">{error}</div>}

      {/* Results Editor */}
      {extractedData.length > 0 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-slate-200">Extracted Requirements</h2>
            <button
              onClick={handleMockUpload}
              className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-md font-bold shadow-lg shadow-green-900/20 transition-all"
            >
              Upload to Database
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {extractedData.map((group, groupIdx) => (
              <div key={groupIdx} className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                <div className="bg-slate-950 px-4 py-2 border-b border-slate-700 flex justify-between items-center">
                  <span className="font-mono text-yellow-500 font-bold">[{group.categoryDisplay}]</span>
                  <span className="text-xs text-slate-500">{group.requirements.length} Items</span>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {group.requirements.map((reqObj, reqIdx) => (
                    <div key={reqIdx} className="relative group">
                      <input
                        type="text"
                        // Display and edit the full requirement ID string
                        value={reqObj.requirement_id}
                        onChange={(e) => handleUpdateRequirement(groupIdx, reqIdx, e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-300 font-mono focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                      <div className="absolute right-2 top-2 hidden group-hover:block text-xs text-slate-500">
                        Edit
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}