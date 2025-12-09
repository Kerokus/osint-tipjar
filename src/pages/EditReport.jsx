import { useEffect, useState, useMemo } from "react";
import SectionHeader from "../components/report_sections/SectionHeader";
import { classifyImage } from "../components/supportFunctions";
import AddRequirements from "../components/AddRequirements";

// Basic sanitizer for building filenames
function slugify(s) {
  return (s || "")
    .toString()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Helper function from CreateReport.jsx to format the DTG
function makeDTG(dateStr, timeStr) {
  if (!dateStr || dateStr.length < 7 || !timeStr || timeStr.length < 4) return "";
  const DD = dateStr.slice(0, 2);
  const MMM = dateStr.slice(2, 5).toUpperCase();
  const YY = dateStr.slice(5, 7);
  const HH = timeStr.slice(0, 2);
  const MM = timeStr.slice(2, 4);
  return `${DD}${HH}${MM}Z${MMM}${YY}`;
}

// Collection requirements are stored as an array in postgreSQL
// This function will parse them
function parseRequirements(reqs) {
  if (!reqs) return [];
  if (Array.isArray(reqs)) return reqs;
  if (typeof reqs === 'string') {
    if (reqs.startsWith('{') && reqs.endsWith('}')) {
      return reqs.slice(1, -1).split(',').filter(Boolean);
    }
    return [reqs];
  }
  return [];
}


export default function EditReport({ report, onClose, onSaveSuccess }) {
  
  // Initialize requirements array in state 
  const [formData, setFormData] = useState({ 
    ...report,
    requirements: parseRequirements(report.requirements) 
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  
  // State for existing image
  const [imageBlobUrl, setImageBlobUrl] = useState(null);

  // State for new image classification 
  const [newImageFile, setNewImageFile] = useState(null);
  const [originalNewImageFile, setOriginalNewImageFile] = useState(null);
  const [newImagePreviewUrl, setNewImagePreviewUrl] = useState(null);
  const [imageClass, setImageClass] = useState("U");
  const [imageHasBeenClassified, setImageHasBeenClassified] = useState(false);

  // State for Requirements Modal
  const [isReqModalOpen, setIsReqModalOpen] = useState(false);

  // State for the dropdowns
  const [macoms, setMacoms] = useState([]);
  const [countries, setCountries] = useState([]);

  const rank = { U: 0, CUI: 1, CUIREL: 2 };
  const maxClass = (...vals) => vals.reduce((a, b) => (rank[b] > rank[a] ? b : a), "U");
  
  const API_URL = useMemo(() => (import.meta.env.VITE_API_URL || "").replace(/\/+$/, ""), []);
  const API_KEY = useMemo(() => import.meta.env.VITE_API_KEY, []);
  const IMG_URL = useMemo(() => import.meta.env.VITE_IMAGE_UPLOAD_URL, []);
  const IMG_API_KEY = useMemo(() => import.meta.env.VITE_IMAGE_UPLOAD_API_KEY, []);

  // Fetch existing image and create a blob URL
  useEffect(() => {
    if (!formData.image_url) return;
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(formData.image_url, { headers: { "x-api-key": IMG_API_KEY } });
        if (!res.ok) throw new Error("Image fetch failed");
        const blob = await res.blob();
        if (!cancel) setImageBlobUrl(URL.createObjectURL(blob));
      } catch (err) { console.error(err); }
    })();
    return () => { 
      cancel = true; 
      if (imageBlobUrl) URL.revokeObjectURL(imageBlobUrl); 
    };
  }, [formData.image_url, IMG_API_KEY]);

  // Create a preview URL for the new image file
  useEffect(() => {
    if (!newImageFile) {
      setNewImagePreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(newImageFile);
    setNewImagePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [newImageFile]);

  // Populate MACOM and countries on mount
  useEffect(() => {
  fetch(`${import.meta.env.BASE_URL}country_locations/country_list_with_codes.json`)
    .then((r) => r.json())
    .then((data) => {
      setMacoms(Object.keys(data));
      if (report.macom && data[report.macom]) {
        const initialCountries = data[report.macom].slice().sort((a, b) => a.name.localeCompare(b.name));
        setCountries(initialCountries);
      }
    });
  }, [report.macom]);

  // Update country list when MACOM changes
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}country_locations/country_list_with_codes.json`)
      .then((r) => r.json())
      .then((data) => {
        const list = (data[formData.macom] || []).slice().sort((a, b) => a.name.localeCompare(b.name));
        setCountries(list);
      });
  }, [formData.macom]);

  // Automatically update the report title
  useEffect(() => {
    const { date_of_information, time, country, location, created_by } = formData;
    const dtg = makeDTG(date_of_information, time);
    const titleParts = [
      slugify(dtg),
      slugify(country),
      slugify(location),
      slugify(created_by),
    ].filter(Boolean);
    const newTitle = titleParts.join("_") || "UNTITLED";

    if (newTitle !== formData.title) {
        setFormData(prev => ({ ...prev, title: newTitle }));
    }
  }, [formData.date_of_information, formData.time, formData.country, formData.location, formData.created_by, formData.title]);

  // Update overall classification based on collector AND new image class
  useEffect(() => {
    const currentOverall = formData.overall_classification;
    const collectorClass = formData.collector_classification;
    // The highest of the manual setting, the collector comment, and the new image
    const newOverall = maxClass(currentOverall, collectorClass, imageClass);
    
    if (newOverall !== currentOverall) {
      setFormData(prev => ({
          ...prev,
          overall_classification: newOverall
      }));
    }
  }, [formData.collector_classification, formData.overall_classification, imageClass, maxClass]);


  // --- HANDLERS ---

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => {
        const newState = { ...prev, [name]: type === 'checkbox' ? checked : value };
        if (name === 'macom') { newState.country = ""; }
        return newState;
    });
  };

  // Requirements handlers
  const handleReqsConfirm = (selected) => {
      setFormData(prev => ({ ...prev, requirements: selected }));
      setIsReqModalOpen(false);
  };
  const handleRemoveReq = (reqId) => {
      setFormData(prev => ({ 
          ...prev, 
          requirements: prev.requirements.filter(r => r !== reqId) 
      }));
  };

  // Handler for when a new image file is chosen
  const handleSetNewImageFile = (file) => {
    if (!file) return;
    setNewImageFile(file);
    setOriginalNewImageFile(file);
    setImageClass("U");
    setImageHasBeenClassified(false);
  };

  // Handler to classify the newly uploaded image 
  const handleClassifyImage = async (classification) => {
    if (!originalNewImageFile) return;
    try {
      const classifiedFile = await classifyImage(originalNewImageFile, classification);
      setNewImageFile(classifiedFile);
      setImageClass(classification);
      setImageHasBeenClassified(true);
    } catch (error) {
      console.error("Failed to classify image:", error);
      setError("An error occurred while adding the classification banner.");
    }
  };

  const handleImageDelete = async () => {
    if (!formData.image_url || !window.confirm("Are you sure you want to permanently delete this image?")) {
      return;
    }
    try {
      const res = await fetch(formData.image_url, {
        method: 'DELETE',
        headers: { 'x-api-key': IMG_API_KEY }
      });
      if (!res.ok) throw new Error(`Failed to delete image: ${res.status}`);
      setFormData(prev => ({ ...prev, image_url: null }));
      setImageBlobUrl(null);
    } catch (err) {
      setError(String(err));
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError("");

    // Validation check for new images
    if (newImageFile && !imageHasBeenClassified) {
      setError("Please classify the new image before saving.");
      setIsSaving(false);
      return;
    }

    try {
      let imageUrl = formData.image_url;

      if (newImageFile) {
        const filename = `${slugify(formData.title)}_IMAGE`;
        const uploadEndpoint = `${String(IMG_URL).replace(/\/+$/,"")}/${encodeURIComponent(filename)}`;
        
        const putRes = await fetch(uploadEndpoint, {
          method: "PUT",
          headers: { 
            "x-api-key": IMG_API_KEY, 
            "Content-Type": newImageFile.type || "application/octet-stream"
          },
          body: newImageFile,
        });

        if (!putRes.ok) throw new Error(`Image upload failed: ${putRes.status}`);
        imageUrl = uploadEndpoint;
      }

      const payload = {
        ...formData,
        image_url: imageUrl,
        modified_by: localStorage.getItem("cin") || 'unknown',
      };
      
      const authToken = localStorage.getItem("token");
      const headers = {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      };

      const reportRes = await fetch(`${API_URL}/reports/${report.id}`, {
        method: "PUT",
        headers: headers,
        body: JSON.stringify(payload),
      });

      if (!reportRes.ok) {
        const text = await reportRes.text().catch(() => "");
        throw new Error(`Failed to save report: ${reportRes.status} ${text}`);
      }

      onSaveSuccess();
      onClose();

    } catch (err) { 
      setError(String(err).replace(/^Error:\s*/, ''));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      {/* === Add Requirements Modal === */}
      <AddRequirements 
        isOpen={isReqModalOpen}
        onClose={() => setIsReqModalOpen(false)}
        onConfirm={handleReqsConfirm}
        initialSelected={formData.requirements || []}
      />

      <form
        onSubmit={handleSubmit}
        className="bg-slate-800 border border-slate-600 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 space-y-4">
          <h2 className="text-xl font-bold text-slate-100 break-all">Editing Report: {formData.title}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-600">
            {/* Left Column */}
            <div className="space-y-4">
              <Input label="Date of Information (DDMMMYY)" name="date_of_information" value={formData.date_of_information || ""} onChange={handleInputChange} />
              <Input label="Time (HHmmZ)" name="time" value={formData.time || ""} onChange={handleInputChange} />
              <Dropdown label="MACOM" name="macom" value={formData.macom} onChange={handleInputChange}>
                {macoms.map(m => <option key={m} value={m}>{m}</option>)}
              </Dropdown>
              <Dropdown label="Country" name="country" value={formData.country} onChange={handleInputChange}>
                <option value="">Select Country</option>
                {countries.map(c => ( <option key={c.name} value={c.name}>{`${c.name} (${c.code})`}</option> ))}
              </Dropdown>
              <Input label="Location" name="location" value={formData.location || ""} onChange={handleInputChange} />
              <Input label="MGRS" name="mgrs" value={formData.mgrs || ""} onChange={handleInputChange} />
              <Textarea label="Report Body" name="report_body" value={formData.report_body || ""} onChange={handleInputChange} />
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Overall Classification</label>
                <SectionHeader initialValue={formData.overall_classification} onChange={(p) => setFormData(prev => ({...prev, overall_classification: p.value}))} />
              </div>
               <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Collector Classification</label>
                <SectionHeader initialValue={formData.collector_classification} onChange={(p) => setFormData(prev => ({...prev, collector_classification: p.value}))} />
              </div>
              <Textarea label="Source Description" name="source_description" value={formData.source_description || ""} onChange={handleInputChange} />
              <Textarea label="Additional Comment Text" name="additional_comment_text" value={formData.additional_comment_text || ""} onChange={handleInputChange} />
              <div className="flex items-center gap-4">
                <Checkbox label="USPER" name="is_usper" checked={!!formData.is_usper} onChange={handleInputChange} />
                <Checkbox label="USPI" name="has_uspi" checked={!!formData.has_uspi} onChange={handleInputChange} />
              </div>

              {/* === Requirements Editor === */}
              <div>
                  <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-medium text-slate-300">Collection Requirements</label>
                      <button 
                          type="button"
                          onClick={() => setIsReqModalOpen(true)}
                          className="text-xs text-blue-400 hover:text-blue-300 hover:underline"
                      >
                          Edit
                      </button>
                  </div>
                  <div className="w-full min-h-[40px] rounded-md bg-slate-900 border border-slate-700 p-2 flex flex-wrap gap-2">
                      {formData.requirements && formData.requirements.length > 0 ? (
                          formData.requirements.map(req => (
                              <span key={req} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-900/40 border border-blue-500/50 text-blue-200 text-xs font-mono">
                                  {req}
                                  <button 
                                      type="button"
                                      onClick={() => handleRemoveReq(req)}
                                      className="ml-1 text-blue-400 hover:text-red-400 font-bold"
                                  >
                                      ×
                                  </button>
                              </span>
                          ))
                      ) : (
                          <span className="text-slate-500 text-xs italic">No requirements selected.</span>
                      )}
                  </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Image</label>
                {/* === Show existing image, new image preview, or upload input === */}
                {formData.image_url && imageBlobUrl ? (
                  <div className="space-y-2">
                    <div className="w-full h-48 bg-slate-900 rounded-md border border-slate-600 flex items-center justify-center overflow-hidden">
                       <img src={imageBlobUrl} alt="Report attachment" className="object-contain max-h-full max-w-full" />
                    </div>
                    <button type="button" onClick={handleImageDelete} className="w-full h-8 text-sm rounded-md bg-red-800 hover:bg-red-700">Delete Image</button>
                  </div>
                ) : newImageFile && newImagePreviewUrl ? (
                  <div className="space-y-2">
                    <div className="relative w-full h-48 bg-slate-900 rounded-md border border-slate-600 flex items-center justify-center overflow-hidden">
                      <img src={newImagePreviewUrl} alt="New image preview" className="object-contain max-h-full max-w-full" />
                    </div>
                     {/* Classification Buttons appear here for the new image */}
                    <div className="flex justify-around items-center p-2 bg-slate-900 rounded-md">
                      <span className="text-xs font-bold text-white">CLASSIFY:</span>
                      <button type="button" onClick={() => handleClassifyImage('U')} className="bg-green-600 text-white text-xs px-3 py-1 rounded-md hover:brightness-110">U</button>
                      <button type="button" onClick={() => handleClassifyImage('CUI')} className="bg-purple-700 text-white text-xs px-3 py-1 rounded-md hover:brightness-110">CUI</button>
                      <button type="button" onClick={() => handleClassifyImage('CUIREL')} className="bg-purple-700 text-white text-xs px-3 py-1 rounded-md hover:brightness-110">CUI//REL</button>
                    </div>
                    <button type="button" onClick={() => setNewImageFile(null)} className="w-full h-8 text-sm rounded-md bg-slate-600 hover:bg-slate-500">Clear New Image</button>
                  </div>
                ) : (
                  <input type="file" onChange={(e) => handleSetNewImageFile(e.target.files[0])} className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-slate-600 file:text-slate-200 hover:file:bg-slate-500" accept="image/*" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-600 flex justify-between items-center bg-slate-800/80 sticky bottom-0">
          <div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
          </div>
          <div className="flex gap-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm bg-slate-600 hover:bg-slate-500 rounded-md text-slate-200">Cancel</button>
            <button type="submit" disabled={isSaving} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 rounded-md text-white font-semibold disabled:opacity-50">
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// --- Simple Form Components ---
const Input = ({ label, ...props }) => (
  <div>
    <label className="block text-xs font-medium text-slate-300 mb-1">{label}</label>
    <input {...props} className="w-full h-9 rounded-md bg-slate-900 border border-slate-700 px-3" />
  </div>
);
const Textarea = ({ label, ...props }) => (
  <div>
    <label className="block text-xs font-medium text-slate-300 mb-1">{label}</label>
    <textarea {...props} className="w-full min-h-[120px] rounded-md bg-slate-900 border border-slate-700 p-3" />
  </div>
);
const Checkbox = ({ label, ...props }) => (
    <label className="flex items-center gap-2">
        <input type="checkbox" {...props} className="h-4 w-4 rounded bg-slate-700 border-slate-500 text-blue-500 focus:ring-blue-600" />
        <span className="text-sm font-medium text-slate-300">{label}</span>
    </label>
);
const Dropdown = ({ label, children, ...props }) => (
    <div>
        <label className="block text-xs font-medium text-slate-300 mb-1">{label}</label>
        <select {...props} className="w-full h-9 rounded-md bg-slate-900 border border-slate-700 px-2">
            {children}
        </select>
    </div>
);