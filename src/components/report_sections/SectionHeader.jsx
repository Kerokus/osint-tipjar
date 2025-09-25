import { useEffect, useRef, useState } from "react";

/**
* Customer wants: 
* SectionHeader
 * - Clickable classification banner
 * - Modal with three styled options
 * - Calls optional onChange({ value, label }) when selection changes
 *
 * Props:
 *  - initialValue?: "U" | "CUI" | "CUIREL"
 *  - onChange?: (payload) => void
 */
export default function SectionHeader({ initialValue = "U", onChange }) {
  const [open, setOpen] = useState(false);
  const [classification, setClassification] = useState(initialValue);
  const firstBtnRef = useRef(null);

  useEffect(() => { setClassification(initialValue); }, [initialValue]);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    // focus first button when open
    setTimeout(() => firstBtnRef.current?.focus(), 0);
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (prev && prev.focus) prev.focus();
    };
  }, [open]);

  const stylesFor = (val) => {
    switch (val) {
      case "U":
        return "bg-green-600 text-white";
      case "CUI":
        return "bg-green-700 text-white"; // slightly different green
      case "CUIREL":
        return "bg-purple-700 text-white";
      default:
        return "bg-slate-700 text-white";
    }
  };

  const labelFor = (val) => {
    switch (val) {
      case "U":
        return "UNCLASSIFIED";
      case "CUI":
        return "CUI";
      case "CUIREL":
        return "CUI//REL TO USA, FVEY";
      default:
        return String(val || "");
    }
  };

  const apply = (val) => {
    setClassification(val);
    setOpen(false);
    onChange?.({ value: val, label: labelFor(val) });
  };

  return (
    <div className="mb-3">
      {/* Banner */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`w-full h-8 rounded-md font-semibold tracking-wide text-center ${stylesFor(
          classification
        )}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Set classification"
      >
        {labelFor(classification)}
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          {/* dialog */}
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-[92vw] max-w-md rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl"
          >
            <h2 className="mb-3 text-slate-200 font-medium">Select classification</h2>

            <div className="space-y-2">
              <button
                ref={firstBtnRef}
                onClick={() => apply("U")}
                className={`w-full h-10 rounded-md ${stylesFor("U")} focus:outline-none focus:ring-2 focus:ring-blue-400`}
              >
                {labelFor("U")}
              </button>

              <button
                onClick={() => apply("CUI")}
                className={`w-full h-10 rounded-md ${stylesFor("CUI")} focus:outline-none focus:ring-2 focus:ring-blue-400`}
              >
                {labelFor("CUI")}
              </button>

              <button
                onClick={() => apply("CUIREL")}
                className={`w-full h-10 rounded-md ${stylesFor("CUIREL")} text-sm px-2 focus:outline-none focus:ring-2 focus:ring-blue-400`}
              >
                {labelFor("CUIREL")}
              </button>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="px-3 h-9 rounded-md bg-slate-800 text-slate-200 hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
