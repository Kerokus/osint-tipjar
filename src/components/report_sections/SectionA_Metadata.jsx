// src/components/report_sections/SectionA_Metadata.jsx

import { useEffect, useState } from "react";

// This component now receives all its data and functions as props
export default function SectionA_Metadata({
  dateStr, setDateStr,
  timeStr, setTimeStr,
  cin,
  macoms, macom, setMacom,
  countries, country, setCountry,
  location, setLocation,
  mgrs, setMgrs,
  results, loading,
  imgFile, setImgFile,
  onDrop, onChoose, clearForm
}) {
  // This state is purely for the UI of this component, so it stays here.
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // This effect also only affects this component's UI, so it stays.
  useEffect(() => {
    if (!imgFile) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(imgFile);
    setPreviewUrl(objectUrl);
    // Cleanup function to revoke the object URL
    return () => URL.revokeObjectURL(objectUrl);
  }, [imgFile]);


  return (
    <section>
      <div className="grid grid-cols-12 gap-3">
        {/* Top row */}
        <div className="col-span-12 md:col-span-2">
          <label className="block text-xs">Date of Information (UTC)</label>
          <input value={dateStr} onChange={(e) => setDateStr(e.target.value)} className="w-full h-9 rounded-md bg-slate-900 border border-slate-700 px-3" />
        </div>
        <div className="col-span-6 md:col-span-1">
          <label className="block text-xs">Time (UTC)</label>
          <input value={timeStr} onChange={(e) => setTimeStr(e.target.value)} className="w-full h-9 rounded-md bg-slate-900 border border-slate-700 px-3" />
        </div>
        <div className="col-span-6 md:col-span-2">
          <label className="block text-xs">CIN</label>
          <input value={cin} readOnly className="w-full h-9 rounded-md bg-slate-800 border border-slate-700 px-3" />
        </div>
        <div className="col-span-12 md:col-span-3 flex gap-2 items-end">
          <button onClick={clearForm} className="flex-1 h-9 rounded-md bg-slate-800 border border-slate-600 text-red-500">Clear Form</button>
          <button className="flex-1 h-9 rounded-md bg-slate-800 border border-slate-600">Recall Last</button>
        </div>
        {/* Image uploader spans 2 rows */}
        <div className="col-span-12 md:col-span-4 md:row-span-2 flex flex-col min-w-0">
          {/* Header with Title and Clear Button */}
          <div className="flex justify-between items-center">
            <label className="block text-xs">Image</label>
            {imgFile && (
              <button
                onClick={() => setImgFile(null)}
                className="text-xs text-red-500 hover:underline"
              >
                Clear Image
              </button>
            )}
          </div>

          {/* Dropzone Area */}
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            className="relative flex-1 rounded-md border border-slate-600 bg-slate-900 grid place-items-center text-sm overflow-hidden"
          >
            {previewUrl ? (
              <>
                <img
                  src={previewUrl}
                  alt="Image preview"
                  className="absolute inset-0 w-full h-full object-contain"
                />
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="absolute bottom-2 right-2 z-10 bg-slate-800/80 text-white text-xs px-2 py-1 rounded-md border border-slate-600 hover:bg-slate-700/80"
                >
                  Preview
                </button>
              </>
            ) : (
              <label className="cursor-pointer bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors">
                Upload Image
                <input type="file" onChange={onChoose} className="hidden" accept="image/*" />
              </label>
            )}
          </div>
        </div>
        {/* Row 2 left stack */}
        <div className="col-span-12 md:col-span-4 md:row-start-2 flex flex-col">
          <label className="block text-xs">MACOM</label>
          <select value={macom} onChange={(e) => setMacom(e.target.value)} className="w-full h-9 rounded-md bg-slate-900 border border-slate-700">
            {macoms.map(m => <option key={m}>{m}</option>)}
          </select>
          <label className="block text-xs mt-2">Country</label>
          <select value={country} onChange={(e) => setCountry(e.target.value)} className="w-full h-9 rounded-md bg-slate-900 border border-slate-700">
            <option value="" disabled>SELECT COUNTRY</option>
            {countries.map(c => <option key={c}>{c}</option>)}
          </select>
          <label className="block text-xs mt-2">Location</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full h-9 rounded-md bg-slate-900 border border-slate-700 px-3" />
          <label className="block text-xs mt-2">MGRS</label>
          <input value={mgrs} onChange={(e) => setMgrs(e.target.value)} className="w-full h-9 rounded-md bg-slate-900 border border-slate-700 px-3" />
        </div>
        {/* Row 2 MGRS results */}
        <div className="col-span-12 md:col-span-4 md:row-start-2 flex flex-col">
          <label className="block text-xs text-center">MGRS Results</label>
          <div className="h-[220px] overflow-auto rounded-md border border-slate-700 bg-slate-900">
            {loading ? <div className="p-2">Searching…</div> : results.length === 0 ? <div className="p-2">No results</div> : (
              <ul>
                {results.map((r, idx) => (
                  <li key={idx} className="px-2 py-1 hover:bg-slate-800 cursor-pointer" onClick={() => setMgrs(r.mgrs)}>
                    <div>{r.location}</div>
                    <div className="text-xs">Province: {r.province} • MGRS: {r.mgrs}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {/* Full-size Image Preview Modal */}
        {isModalOpen && (
          <div
            onClick={() => setIsModalOpen(false)}
            className="fixed inset-0 bg-black/80 grid place-items-center z-50 cursor-pointer"
          >
            <img
              src={previewUrl}
              alt="Full-size preview"
              onClick={(e) => e.stopPropagation()}
              className="max-w-[90vw] max-h-[90vh] object-contain cursor-default"
            />
            <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 text-white text-2xl font-bold"
            >
              &times;
            </button>
          </div>
        )}
      </div>
    </section>
  );
}