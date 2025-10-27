// src/components/report_sections/SectionB_Source.jsx
import React, { useEffect, useState, useRef, useLayoutEffect } from "react";
import MgrsTool from "../../pages/MgrsTool.jsx";
import TimeZoneTool from "../../pages/TimeZoneTool.jsx";
import TranslationTool from "../../pages/TranslationTool.jsx";
import Transciption from "../../pages/Transcription.jsx";
import TranslateDocs from "../../pages/TranslateDocs.jsx";

export default function SectionB_Source({
  usper, setUsper,
  uspi, setUspi,
  sourceType, setSourceType,
  sourceName, setSourceName,
  didWhat, setDidWhat,
  uid, setUid,
  articleTitle, setArticleTitle,
  articleAuthor, setArticleAuthor,
  isUspiLocked, 
}) {
  useEffect(() => {
    if (usper) setUspi(true);
  }, [usper, setUspi]);

  //Sanitize http and https URLs
  const handleUidChange = (e) => {
    const sanitizedValue = e.target.value.replace(/http/gi, "hxxp");
    setUid(sanitizedValue);
  };

  const sourceOptions = ["Website", "X User", "Telegram User", "BlueSky User", "Facebook User", "Instagram User", "YouTube User", "Tiktok User", "VK User", "MySpace User", "Aparat User"];
  const didWhatOptions = ["reported", "posted", "stated", "claimed", "published", "observed"];

  // right-pane tabs
  const [active, setActive] = useState("mgrs");
  const tabs = [
    { key: "mgrs", label: "MGRS Conversion", node: <MgrsTool /> },
    { key: "dt", label: "Timezone Conversions", node: <TimeZoneTool /> },
    { key: "tr", label: "Translate Text", node: <TranslationTool /> },
    { key: "td", label: "Translate Documents", node: <TranslateDocs /> },
    { key: "ts", label: "Transciption", node: <Transciption /> },
  ];

  // height = depth of 4 rows
  const formRef = useRef(null);
  const toolH = useRef(224);
  useLayoutEffect(() => {
    if (!formRef.current) return;
    const rows = formRef.current.querySelectorAll(".form-row");
    if (!rows.length) return;
    const rowH = rows[0].getBoundingClientRect().height;
    toolH.current = Math.max(160, Math.round(rowH * 5));
  });

  return (
    <section>
      <div className="flex gap-4">
        <div className="flex-none max-w-4xl" ref={formRef}>
          <div className="grid grid-cols-12 gap-x-6 gap-y-2 items-center">
            {/* --- Row 1 --- */}
            <div className="col-span-12 form-row grid grid-cols-12 gap-x-6 items-center">
              <div className="col-span-12 md:col-span-1 flex items-center gap-2">
                <input type="checkbox" checked={usper} onChange={(e) => setUsper(e.target.checked)} id="usper" className="h-4 w-4" />
                <label htmlFor="usper">USPER</label>
              </div>
              <div className="col-span-12 md:col-span-4">
                <label className="block text-xs">Source Name:</label>
                <input value={sourceName} onChange={(e) => setSourceName(e.target.value)} className="w-full h-9 rounded-md bg-slate-900 border border-slate-700 px-3" />
              </div>
              <div className="col-span-12 md:col-span-5">
                <label className="block text-xs">UID:</label>
                <input value={uid} onChange={handleUidChange} className="w-full h-9 rounded-md bg-slate-900 border border-slate-700 px-3" />
              </div>
            </div>

            {/* --- Row 2 --- */}
            <div className="col-span-12 form-row grid grid-cols-12 gap-x-6 items-center">
              <div className="col-span-12 md:col-span-1 flex items-center gap-2">
                <input type="checkbox" checked={uspi} onChange={(e) => setUspi(e.target.checked)} disabled={usper || isUspiLocked} id="uspi" className="h-4 w-4 disabled:opacity-50" />
                <label htmlFor="uspi">USPI</label>
              </div>
              <div className="col-span-12 md:col-span-4">
                <label className="block text-xs">Source Type</label>
                <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className="w-full h-9 rounded-md bg-slate-900 border border-slate-700">
                  {sourceOptions.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="col-span-12 md:col-span-5">
                <label className="block text-xs">Article Title:</label>
                <input value={articleTitle} onChange={(e) => setArticleTitle(e.target.value)} className="w-full h-9 rounded-md bg-slate-900 border border-slate-700 px-3" />
              </div>
            </div>

            {/* --- Row 3 --- */}
            <div className="col-span-12 form-row grid grid-cols-12 gap-x-6 items-center">
              <div className="col-span-12 md:col-start-2 md:col-span-4">
                <label className="block text-xs">Did What:</label>
                <select value={didWhat} onChange={(e) => setDidWhat(e.target.value)} className="w-full h-9 rounded-md bg-slate-900 border border-slate-700">
                  {didWhatOptions.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="col-span-12 md:col-span-5">
                <label className="block text-xs">Article Author:</label>
                <input value={articleAuthor} onChange={(e) => setArticleAuthor(e.target.value)} className="w-full h-9 rounded-md bg-slate-900 border border-slate-700 px-3" />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Tools section fills remaining width, height = four rows */}
        <div className="flex-1">
          <div className="rounded-md border border-slate-700 bg-slate-900">
            <div className="flex border-b border-slate-700 divide-x divide-slate-700">
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => setActive(t.key)}
                  className={`px-3 h-10 text-sm font-semibold ${active === t.key ? "bg-slate-800" : "bg-slate-950 hover:bg-slate-800/60"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="p-3 overflow-auto" style={{ height: `${toolH.current}px` }}>
              {tabs.find(t => t.key === active)?.node}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
