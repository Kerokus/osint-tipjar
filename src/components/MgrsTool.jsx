import React, { useState } from 'react';
import * as mgrs from 'mgrs';

/**
 * Converts DMS (Degrees, Minutes, Seconds) to decimal degrees.
 * (This helper function is unchanged)
 */
const dmsToDecimal = (degrees, minutes, seconds, direction) => {
  let decimal = parseFloat(degrees) + (parseFloat(minutes) / 60) + (parseFloat(seconds) / 3600);
  if (direction.toUpperCase() === 'S' || direction.toUpperCase() === 'W') {
    decimal *= -1;
  }
  return decimal;
};

// --- SVG Icons for Copy Button ---
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

export default function MgrsTool() {
  const [mode, setMode] = useState('ll-to-mgrs');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [isCopied, setIsCopied] = useState(false); 

  const handleModeChange = (newMode) => {
    setMode(newMode);
    setInput('');
    setOutput('');
    setIsCopied(false);
  };

  const handleClear = () => {
    setInput('');
    setOutput('');
    setIsCopied(false);
  };

  const handleCopy = () => {
    if (!output) return; // Don't copy if output is empty
    navigator.clipboard.writeText(output).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  const handleConvert = () => {
    if (!input) {
      setOutput('');
      return;
    }
    
    setIsCopied(false); // Reset copy state on new conversion
    try {
      if (mode === 'll-to-mgrs') {
        let lat, lon;
        
        // Regex to match DMS format
        const dmsRegex = /^\s*(\d+)\°\s*(\d+)'\s*([\d\.]+)"\s*([NS])\s*[, ]?\s*(\d+)\°\s*(\d+)'\s*([\d\.]+)"\s*([EW])\s*$/i;
        const dmsMatch = input.trim().match(dmsRegex);

        if (dmsMatch) {
          // --- Handle DMS Format ---
          lat = dmsToDecimal(dmsMatch[1], dmsMatch[2], dmsMatch[3], dmsMatch[4]);
          lon = dmsToDecimal(dmsMatch[5], dmsMatch[6], dmsMatch[7], dmsMatch[8]);
        
        } else {
          // --- Handle Decimal Format (fallback) ---
          const parts = input.split(',').map(s => parseFloat(s.trim()));
          if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
            throw new Error('Use: 30.89, 34.47 OR 30°53\'27"N 34°28\'32"E');
          }
          [lat, lon] = parts; // Assumes [lat, lon]
        }

        // The 'mgrs' library expects [longitude, latitude]
        const result = mgrs.forward([lon, lat]);
        setOutput(result);

      } else {
        const result = mgrs.toPoint(input.trim().toUpperCase());
        setOutput(`${result[1].toFixed(6)}, ${result[0].toFixed(6)}`);
      }
    } catch (err) {
      setOutput(err.message || 'Invalid Input');
    }
  };

  const inputLabel = mode === 'll-to-mgrs' ? 'Lat/Long Input' : 'MGRS Input';
  const inputPlaceholder = mode === 'll-to-mgrs' ? '30.89, 34.47 or 30°53\'27.0"N...' : '18TWL8083346294';
  const outputLabel = mode === 'll-to-mgrs' ? 'MGRS Output' : 'Lat/Long Output';

  return (
    <div className="flex flex-col gap-3">
      {/* --- Slide Selector --- */}
      <div className="flex rounded-md bg-slate-800 p-1 text-center">
        <button
          onClick={() => handleModeChange('ll-to-mgrs')}
          className={`w-1/2 rounded-md px-2 py-1 text-sm font-medium transition-colors ${
            mode === 'll-to-mgrs'
              ? 'bg-blue-600 text-white'
              : 'text-slate-300 hover:bg-slate-700'
          }`}
        >
          Lat/Long to MGRS
        </button>
        <button
          onClick={() => handleModeChange('mgrs-to-ll')}
          className={`w-1/2 rounded-md px-2 py-1 text-sm font-medium transition-colors ${
            mode === 'mgrs-to-ll'
              ? 'bg-blue-600 text-white'
              : 'text-slate-300 hover:bg-slate-700'
          }`}
        >
          MGRS to Lat/Long
        </button>
      </div>

      {/* --- Input / Output Row --- */}
      <div className="flex gap-3">
        {/* Left Side: Input */}
        <div className="flex-1">
          <label htmlFor="mgrs-input" className="block text-xs mb-1 text-slate-400">
            {inputLabel}
          </label>
          <input
            id="mgrs-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full h-9 rounded-md bg-slate-800 border border-slate-700 px-3 text-sm"
            placeholder={inputPlaceholder}
          />
        </div>

        {/* Right Side: Output */}
        <div className="flex-1">
          <label htmlFor="mgrs-output" className="block text-xs mb-1 text-slate-400">
            {outputLabel}
          </label>
          <div className="relative flex items-center">
            <input
              id="mgrs-output"
              readOnly
              value={output}
              className="w-full h-9 rounded-md bg-slate-950 border border-slate-700 pl-3 pr-10 text-sm text-slate-300" // Added pr-10 for padding
              placeholder="Result..."
            />
            <button
              onClick={handleCopy}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white disabled:opacity-50"
              title="Copy to clipboard"
              disabled={!output} // Disable button if there's no output
            >
              {isCopied ? <CheckIcon /> : <CopyIcon />}
            </button>
          </div>
        </div>
      </div>

      {/* --- Button Row --- */}
      <div className="flex gap-3">
        <button
          onClick={handleConvert}
          className="w-1/2 h-9 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors"
        >
          Convert
        </button>
        <button
          onClick={handleClear}
          className="w-1/2 h-9 rounded-md bg-slate-600 hover:bg-slate-700 text-white font-semibold text-sm transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  );
}