import React, { useState, useRef } from 'react';

// --- SVG Icons ---
const UploadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
  </svg>
);

const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 8.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v8.25A2.25 2.25 0 006 16.5h2.25m8.25-8.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-7.5A2.25 2.25 0 018.25 18v-1.5m8.25-8.25h-6a2.25 2.25 0 00-2.25 2.25v6" />
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-green-400">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-red-400">
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
);

export default function OcrTool() {
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const fileInputRef = useRef(null);

  // --- Helpers ---
  
  // Convert file to Base64
  const toBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });

  // --- Handlers ---

  const processFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        setError('Please upload an image file (JPG, PNG).');
        return;
    }
    
    // Clear previous error/results
    setError('');
    setExtractedText('');
    
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
        processFile(files[0]);
    }
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
        processFile(files[0]);
    }
  };

  const handleRemoveImage = (e) => {
    e.stopPropagation(); // Prevent triggering the click on the parent div
    setImageFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!imageFile) return;

    setLoading(true);
    setError('');
    
    try {
        const base64Image = await toBase64(imageFile);
        
        const API_URL = import.meta.env.VITE_API_URL;
        const API_KEY = import.meta.env.VITE_API_KEY;

        if (!API_URL || !API_KEY) {
            throw new Error("API URL or Key is missing from environment variables.");
        }

        const endpoint = `${String(API_URL).replace(/\/+$/, "")}/ocr`;

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY
            },
            body: JSON.stringify({
                image: base64Image,
                media_type: imageFile.type
            })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || `Error: ${res.status}`);
        }

        const data = await res.json();
        setExtractedText(data.extracted_text || 'Unable to extract any text.');

    } catch (err) {
        console.error("OCR error:", err);
        setError(err.message || "Failed to extract text.");
    } finally {
        setLoading(false);
    }
  };

  const handleClear = () => {
    setImageFile(null);
    setPreviewUrl(null);
    setExtractedText('');
    setError('');
    setIsCopied(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCopy = () => {
    if (!extractedText) return;
    navigator.clipboard.writeText(extractedText).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  return (
    <div className="flex gap-3 h-full">
      {/* --- Left Column: Input (Drag/Drop) --- */}
      <div className="flex-1 flex flex-col gap-3">
        <label className="block text-xs text-slate-400">Image Source</label>
        
        {/* Drop Zone */}
        <div 
            className={`flex-1 min-h-[160px] rounded-md border-2 border-dashed flex flex-col items-center justify-center relative overflow-hidden transition-colors cursor-pointer
                ${isDragOver ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 bg-slate-800 hover:bg-slate-700/50'}
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
        >
            <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                accept="image/*"
                onChange={handleFileSelect}
            />
            
            {previewUrl ? (
                <div className="relative w-full h-full flex items-center justify-center p-2 bg-black/40">
                    <img 
                        src={previewUrl} 
                        alt="Preview" 
                        className="max-w-full max-h-[180px] object-contain rounded shadow-md" 
                    />
                    <button 
                        onClick={handleRemoveImage}
                        className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-red-500/80 transition-colors"
                        title="Remove image"
                    >
                        <TrashIcon />
                    </button>
                </div>
            ) : (
                <div className="text-center p-4">
                    <div className="mx-auto w-10 h-10 mb-2 text-slate-500 flex items-center justify-center">
                        <UploadIcon />
                    </div>
                    <p className="text-sm text-slate-300 font-medium">Click to Browse</p>
                    <p className="text-xs text-slate-500 mt-1">or Drag Image Here</p>
                </div>
            )}
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          className="w-full h-9 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading || !imageFile}
        >
          {loading ? 'Extracting Text...' : 'Extract Text'}
        </button>
      </div>

      {/* --- Right Column: Output --- */}
      <div className="flex-1 flex flex-col gap-3">
        <div className="flex justify-between items-center h-[16px]"> {/* Match label height for alignment */}
             <label className="block text-xs text-slate-400">Extracted Text</label>
             {error && <span className="text-xs text-red-400 font-medium truncate max-w-[150px]" title={error}>{error}</span>}
        </div>
        
        <div className="relative flex-1">
            <textarea
              readOnly
              value={extractedText}
              className="w-full h-full min-h-[160px] rounded-md bg-slate-950 border border-slate-700 pl-3 pr-10 py-2 text-sm text-slate-300 resize-none font-mono focus:outline-none focus:border-slate-500 transition-colors"
              placeholder="Result will appear here..."
            />
            <button
              onClick={handleCopy}
              className="absolute right-3 top-3 text-slate-400 hover:text-white disabled:opacity-50 transition-colors"
              title="Copy to clipboard"
              disabled={!extractedText}
            >
              {isCopied ? <CheckIcon /> : <CopyIcon />}
            </button>
        </div>

        {/* Clear Button */}
        <button
          onClick={handleClear}
          className="w-full h-9 rounded-md bg-slate-600 hover:bg-slate-700 text-white font-semibold text-sm transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  );
}