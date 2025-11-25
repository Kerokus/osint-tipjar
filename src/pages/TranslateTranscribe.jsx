import { useState } from "react";
import TranslateDocs from "../pages/TranslateDocs";
import Transcription from "../pages/Transcription";

export default function TranslateTranscribe() {
  // State to manage the active tab, default to 'transcribe'
  const [active, setActive] = useState("transcribe");

  // Define the tabs, similar to SectionB
  const tabs = [
    { key: "transcribe", label: "Transcribe Audio & Video Files", node: <Transcription /> },
    { key: "translate", label: "Translate Documents", node: <TranslateDocs /> },
  ];

  return (
    <section className="mt-4">
      <div className="rounded-md border border-slate-700 bg-slate-900">
        {/* Tab Headers */}
        <div className="flex border-b border-slate-700 divide-x divide-slate-700">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`px-3 h-10 text-sm font-semibold ${
                active === t.key
                  ? "bg-slate-800"
                  : "bg-slate-950 hover:bg-slate-800/60"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {/* Tab Content */}
        <div className="p-3">
          {tabs.find((t) => t.key === active)?.node}
        </div>
      </div>
    </section>
  );
}