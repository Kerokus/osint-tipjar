// src/components/report_sections/SectionB_Source.jsx

import { useEffect } from "react";

export default function SectionB_Source({
  usper, setUsper,
  uspi, setUspi,
  sourceType, setSourceType,
  sourceName, setSourceName,
  didWhat, setDidWhat,
  uid, setUid,
  articleTitle, setArticleTitle,
  articleAuthor, setArticleAuthor,
  isUspiLocked, setIsUspiLocked
}) {

  useEffect(() => {
    if (usper) {
      setUspi(true);
    }
  }, [usper, setUspi]);

  // New handler function for the UID input
  const handleUidChange = (e) => {
    const sanitizedValue = e.target.value.replace(/http/gi, "hxxp");
    setUid(sanitizedValue);
  };

  const sourceOptions = ["Website", "X User", "Telegram User", "BlueSky User", "Facebook User", "Instagram User", "YouTube User", "Tiktok User", "VK User", "MySpace User", "Aparat User"];
  const didWhatOptions = ["reported", "posted", "stated", "claimed", "published", "observed"];

  return (
    <section>
      <div className="max-w-5xl">
        <div className="grid grid-cols-12 gap-x-6 gap-y-2 items-center">

          {/* --- Row 1 --- */}
          <div className="col-span-12 md:col-span-1 flex items-center gap-2">
            <input type="checkbox" checked={usper} onChange={(e) => setUsper(e.target.checked)} id="usper" className="h-4 w-4" />
            <label htmlFor="usper">USPER</label>
          </div>
          <div className="col-span-12 md:col-span-5">
            <label className="block text-xs">Source Name:</label>
            <input value={sourceName} onChange={(e) => setSourceName(e.target.value)} className="w-full h-9 rounded-md bg-slate-900 border border-slate-700 px-3" />
          </div>
          <div className="col-span-12 md:col-span-6">
            <label className="block text-xs">UID:</label>
            <input value={uid} onChange={handleUidChange} className="w-full h-9 rounded-md bg-slate-900 border border-slate-700 px-3" />
          </div>

          {/* --- Row 2 --- */}
          <div className="col-span-12 md:col-span-1 flex items-center gap-2">
            <input type="checkbox" checked={uspi} onChange={(e) => setUspi(e.target.checked)} disabled={usper || isUspiLocked} id="uspi" className="h-4 w-4 disabled:opacity-50" />
            <label htmlFor="uspi">USPI</label>
          </div>
          <div className="col-span-12 md:col-span-5">
            <label className="block text-xs">Source Type</label>
            <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className="w-full h-9 rounded-md bg-slate-900 border border-slate-700">
              {sourceOptions.map(o => <option key={o}>{o}</option>)}
            </select>
            
          </div>
          <div className="col-span-12 md:col-span-6">
            <label className="block text-xs">Article Title:</label>
            <input value={articleTitle} onChange={(e) => setArticleTitle(e.target.value)} className="w-full h-9 rounded-md bg-slate-900 border border-slate-700 px-3" />
          </div>

          {/* --- Row 3 --- */}
          <div className="col-span-12 md:col-start-2 md:col-span-5">
            <label className="block text-xs">Did What:</label>
            <select value={didWhat} onChange={(e) => setDidWhat(e.target.value)} className="w-full h-9 rounded-md bg-slate-900 border border-slate-700">
              {didWhatOptions.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="col-span-12 md:col-span-6">
            <label className="block text-xs">Article Author:</label>
            <input value={articleAuthor} onChange={(e) => setArticleAuthor(e.target.value)} className="w-full h-9 rounded-md bg-slate-900 border border-slate-700 px-3" />
          </div>

        </div>
      </div>
    </section>
  );
}