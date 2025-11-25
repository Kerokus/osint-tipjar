import { useState, useEffect, useRef } from "react";

// --- Helpers (copied from CreateReport.jsx for consistency) ---
function formatDDMMMYY(dateUtc) {
  const d = dateUtc.getUTCDate().toString().padStart(2, "0");
  const mon = ["JAN","FEB","MAR","APR","MAY","JUN","JUL", "AUG","SEP","OCT","NOV","DEC"][dateUtc.getUTCMonth()];
  const y = dateUtc.getUTCFullYear().toString().slice(-2);
  return `${d}${mon}${y}`;
}
function formatHHmmUTC(dateUtc) {
  const h = dateUtc.getUTCHours().toString().padStart(2, "0");
  const m = dateUtc.getUTCMinutes().toString().padStart(2, "0");
  return `${h}${m}`;
}
function makeDTG(dateStr, timeStr) {
  // Inputs expected as: dateStr = DDMMMYY, timeStr = HHmm (UTC)
  if (!dateStr || dateStr.length < 7 || !timeStr || timeStr.length < 4) return "";
  const DD = dateStr.slice(0, 2);
  const MMM = dateStr.slice(2, 5).toUpperCase();
  const YY = dateStr.slice(5, 7);
  const HH = timeStr.slice(0, 2);
  const MM = timeStr.slice(2, 4);
  return `${DD}${HH}${MM}Z${MMM}${YY}`;
}
// Basic sanitizer for filenames
function slugify(s) {
  return (s || "")
    .toString()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_.]/g, "_") // Keep periods for extension
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const languages = [
  { name: "Afrikaans", code: "af" },
  { name: "Albanian", code: "sq" },
  { name: "Amharic", code: "am" },
  { name: "Arabic", code: "ar" },
  { name: "Armenian", code: "hy" },
  { name: "Azerbaijani", code: "az" },
  { name: "Bengali", code: "bn" },
  { name: "Bosnian", code: "bs" },
  { name: "Bulgarian", code: "bg" },
  { name: "Catalan", code: "ca" },
  { name: "Chinese (Simplified)", code: "zh" },
  { name: "Chinese (Traditional)", code: "zh-TW" },
  { name: "Croatian", code: "hr" },
  { name: "Czech", code: "cs" },
  { name: "Danish", code: "da" },
  { name: "Dari", code: "fa-AF" },
  { name: "Dutch", code: "nl" },
  { name: "English", code: "en" },
  { name: "Estonian", code: "et" },
  { name: "Farsi (Persian)", code: "fa" },
  { name: "Filipino, Tagalog", code: "tl" },
  { name: "Finnish", code: "fi" },
  { name: "French", code: "fr" },
  { name: "French (Canada)", code: "fr-CA" },
  { name: "Georgian", code: "ka" },
  { name: "German", code: "de" },
  { name: "Greek", code: "el" },
  { name: "Gujarati", code: "gu" },
  { name: "Haitian Creole", code: "ht" },
  { name: "Hausa", code: "ha" },
  { name: "Hebrew", code: "he" },
  { name: "Hindi", code: "hi" },
  { name: "Hungarian", code: "hu" },
  { name: "Icelandic", code: "is" },
  { name: "Indonesian", code: "id" },
  { name: "Irish", code: "ga" },
  { name: "Italian", code: "it" },
  { name: "Japanese", code: "ja" },
  { name: "Kannada", code: "kn" },
  { name: "Kazakh", code: "kk" },
  { name: "Korean", code: "ko" },
  { name: "Latvian", code: "lv" },
  { name: "Lithuanian", code: "lt" },
  { name: "Macedonian", code: "mk" },
  { name: "Malay", code: "ms" },
  { name: "Malayalam", code: "ml" },
  { name: "Maltese", code: "mt" },
  { name: "Marathi", code: "mr" },
  { name: "Mongolian", code: "mn" },
  { name: "Norwegian (Bokmål)", code: "no" },
  { nameD: "Pashto", code: "ps" },
  { name: "Polish", code: "pl" },
  { name: "Portuguese (Brazil)", code: "pt" },
  { name: "Portuguese (Portugal)", code: "pt-PT" },
  { name: "Punjabi", code: "pa" },
  { name: "Romanian", code: "ro" },
  { name: "Russian", code: "ru" },
  { name: "Serbian", code: "sr" },
  { name: "Sinhala", code: "si" },
  { name: "Slovak", code: "sk" },
  { name: "Slovenian", code: "sl" },
  { name: "Somali", code: "so" },
  { name: "Spanish", code: "es" },
  { name: "Spanish (Mexico)", code: "es-MX" },
  { name: "Swahili", code: "sw" },
  { name: "Swedish", code: "sv" },
  { name: "Tamil", code: "ta" },
  { name: "Telugu", code: "te" },
  { name: "Thai", code: "th" },
  { name: "Turkish", code: "tr" },
  { name: "Ukrainian", code: "uk" },
  { name: "Urdu", code: "ur" },
  { name: "Uzbek", code: "uz" },
  { name: "Vietnamese", code: "vi" },
  { name: "Welsh", code: "cy" }
];
// -----------------------------------------------------------------

export default function TranslateDocs() {
  const [cin, setCin] = useState("");
  const [file, setFile] = useState(null);
  const [jobStatus, setJobStatus] = useState("idle"); // 'idle', 'uploading', 'pending', 'complete', 'error'
  const [error, setError] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  
  // === NEW: State for language selection ===
  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLang, setTargetLang] = useState("en");

  useEffect(() => {
    setCin(localStorage.getItem("cin") || "UNKNOWN_CIN");
  }, []);

  const resetState = () => {
    setFile(null);
    setJobStatus("idle");
    setError("");
    setDownloadUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = null; // Clear the file input
    }
    // === NEW: Reset languages ===
    setSourceLang("auto");
    setTargetLang("en");
  };

  const validateFile = (file) => {
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      setError("PDF files are not supported. Please upload a different document type.");
      return false;
    }
    setError("");
    return true;
  };

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;
    if (validateFile(selectedFile)) {
      resetState(); // Reset before setting new file
      setFile(selectedFile);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (jobStatus !== "idle") return; // Don't allow drop if busy
    const droppedFile = e.dataTransfer.files?.[0];
    handleFileSelect(droppedFile);
  };

  const onChoose = (e) => {
    e.preventDefault();
    const chosenFile = e.target.files?.[0];
    handleFileSelect(chosenFile);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (jobStatus === "idle") {
      setIsDragging(true);
    }
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleSubmit = async () => {
    if (!file) return;

    setJobStatus("uploading");
    setError("");

    // 1. Generate filename: DTG_CIN_OriginalFileName.extension
    const now = new Date();
    const dateStr = formatDDMMMYY(now);
    const timeStr = formatHHmmUTC(now);
    const dtg = makeDTG(dateStr, timeStr);
    const finalFileName = `${dtg}_${cin}_${slugify(file.name)}`;

    // === MODIFIED: Log the full payload ===
    console.log("Submitting translation job with payload:", {
      fileName: finalFileName,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang
    });

    // --- MOCKED API CALLS ---
    // TODO: Replace this section with your real API calls
    try {
      // ---
      // TODO: 1. Get Presigned URL
      // const API_URL = import.meta.env.VITE_TRANSLATE_UPLOAD_URL;
      // const API_KEY = import.meta.env.VITE_IMAGE_UPLOAD_API_KEY;
      // const presignResponse = await fetch(API_URL, {
      //   method: "POST",
      //   headers: { "x-api-key": API_KEY, "Content-Type": "application/json" },
      //   body: JSON.stringify({ 
      //     fileName: finalFileName,
      //     sourceLanguage: sourceLang,
      //     targetLanguage: targetLang
      //   })
      // });
      // const { uploadUrl, pollUrl } = await presignResponse.json();
      // ---
      
      // Simulate getting the URL
      await new Promise(res => setTimeout(res, 1000));
      const mockUploadUrl = "https://fake-s3-bucket.url/upload";
      const mockPollUrl = "https://fake-api.url/status/123";

      // ---
      // TODO: 2. PUT file to S3
      // await fetch(uploadUrl, {
      //   method: "PUT",
      //   headers: { "Content-Type": file.type },
      //   body: file
      // });
      // ---

      // Simulate the upload
      await new Promise(res => setTimeout(res, 1500));
      
      // 3. Set to pending and start "polling"
      setJobStatus("pending");

      // ---
      // TODO: 3. Poll for results
      // let jobComplete = false;
      // while (!jobComplete) {
      //   await new Promise(res => setTimeout(res, 5000)); // Poll every 5s
      //   const statusResponse = await fetch(pollUrl, { headers: { "x-api-key": API_KEY }});
      //   const data = await statusResponse.json();
      //   if (data.status === "complete") {
      //     jobComplete = true;
      //     setDownloadUrl(data.downloadUrl);
      //     setJobStatus("complete");
      //   } else if (data.status === "error") {
      //     throw new Error("Translation job failed.");
      //   }
      // }
      // ---

      // Simulate polling
      await new Promise(res => setTimeout(res, 5000)); // 5s "translation"
      setDownloadUrl("#"); // Placeholder link
      setJobStatus("complete");

    } catch (err) {
      console.error("Translation job failed:", err);
      setError(err.message || "An error occurred during the translation.");
      setJobStatus("error");
    }
    // --- END MOCKED API CALLS ---
  };

  // Determine border color for dropzone
  const getBorderColor = () => {
    if (error) return "border-red-500";
    if (isDragging) return "border-blue-500";
    return "border-slate-600";
  };

  return (
    <div className="max-w-xl mx-auto p-4">
      <p>NOT FUNCTIONAL YET! YOU'LL CRASH THE PAGE IF YOU TRY TO USE THIS!</p>
      {/* --- File Upload Box --- */}
      <div
        className={`flex justify-center items-center w-full h-48 border-2 ${getBorderColor()} border-dashed rounded-lg cursor-pointer transition-all ${
          isDragging ? "bg-slate-800" : "bg-slate-900"
        } ${jobStatus !== "idle" ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-800"}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => jobStatus === "idle" && fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={onChoose}
          className="hidden"
          disabled={jobStatus !== "idle"}
          accept=".doc,.docx,.xml,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.txt,.rtf,.md"
        />
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <svg className="w-8 h-8 mb-4 text-slate-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/></svg>
          <p className="mb-2 text-sm text-slate-400">
            <span className="font-semibold">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-slate-500">Any document (PDFs not supported)</p>
        </div>
      </div>
      
      {/* --- Status/Error Messages --- */}
      {error && (
        <p className="mt-2 text-sm text-red-400">{error}</p>
      )}

      {file && (
        <div className="mt-3 text-sm text-slate-300">
          Selected file: <span className="font-medium text-slate-100">{file.name}</span>
        </div>
      )}

      {/* === NEW: Language Selection === */}
      {file && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="sourceLang" className="block text-xs mb-1 text-slate-300">Source Language</label>
            <select 
              id="sourceLang"
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              className="w-full h-9 rounded-md bg-slate-900 border border-slate-700 px-2 text-sm"
            >
              <option value="auto">Auto-Detect</option>
              {languages.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="targetLang" className="block text-xs mb-1 text-slate-300">Target Language</label>
            <select 
              id="targetLang"
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="w-full h-9 rounded-md bg-slate-900 border border-slate-700 px-2 text-sm"
            >
              {languages.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* --- Job Status & Actions --- */}
      <div className="mt-4">
        {jobStatus === "idle" && file && (
          <button
            onClick={handleSubmit}
            className="w-full h-10 px-5 rounded-md bg-blue-600 text-white font-bold hover:bg-blue-700"
          >
            Translate File
          </button>
        )}

        {jobStatus === "uploading" && (
          <p className="text-center text-slate-300">Uploading file...</p>
        )}
        
        {jobStatus === "pending" && (
          <p className="text-center text-yellow-400">
            Translation pending... This may take a moment.
          </p>
        )}

        {jobStatus === "complete" && (
          <div className="space-y-3">
            <p className="text-center text-green-400">Translation Complete.</p>
            <a
              href={downloadUrl}
              download
              className="flex items-center justify-center w-full h-10 px-5 rounded-md bg-green-600 text-white font-bold hover:bg-green-700"
            >
              Download Translated File
            </a>
            <button
              onClick={resetState}
              className="w-full h-9 rounded-md bg-slate-700 text-white font-bold hover:bg-slate-600"
            >
              Translate Another
            </button>
          </div>
        )}

        {jobStatus === "error" && (
          <button
            onClick={resetState}
            className="w-full h-9 rounded-md bg-slate-700 text-white font-bold hover:bg-slate-600"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}