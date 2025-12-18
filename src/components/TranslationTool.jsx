import React, { useState } from 'react';

// --- Language Data ---
// From AWS-lang-list.txt
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
  { name: "Pashto", code: "ps" },
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
]; //

// Create two lists for the dropdowns
const sourceLanguageList = [
  { name: "Auto-Detect", code: "auto" }, //
  ...languages
];
const targetLanguageList = [...languages];

// --- SVG Icons (from MgrsTool.jsx) ---
const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 8.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v8.25A2.25 2.25 0 006 16.5h2.25m8.25-8.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-7.5A2.25 2.25 0 018.25 18v-1.5m8.25-8.25h-6a2.25 2.25 0 00-2.25 2.25v6" />
  </svg>
); //

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-green-400">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
); //


export default function TranslationTool() {
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('en');
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [detectedSourceLang, setDetectedSourceLang] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const handleTranslate = async () => {
    if (!inputText.trim()) {
      return;
    }
    
    setLoading(true);
    setError('');
    setOutputText('');
    setDetectedSourceLang('');
    setIsCopied(false);

    try {
      const API_URL = import.meta.env.VITE_API_URL;
      const API_KEY = import.meta.env.VITE_API_KEY;

      if (!API_URL || !API_KEY) {
        throw new Error("API URL or Key is missing from environment variables.");
      }
      
      const params = new URLSearchParams({
        text: inputText,
        targetLang: targetLang,
        sourceLang: sourceLang //
      });

      const endpoint = `${String(API_URL).replace(/\/+$/, "")}/translate?${params.toString()}`;

      const res = await fetch(endpoint, {
        method: 'GET', //
        headers: {
          'x-api-key': API_KEY
        }
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Error: ${res.status}`); //
      }

      const data = await res.json();
      setOutputText(data.translatedText || ''); //
      setDetectedSourceLang(data.sourceLanguage || ''); //

    } catch (err) {
      console.error("Translation error:", err);
      setError(err.message || "An unknown error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSourceLang('auto');
    setTargetLang('en');
    setInputText('');
    setOutputText('');
    setDetectedSourceLang('');
    setError('');
    setIsCopied(false);
  };

  const handleCopy = () => {
    if (!outputText) return;
    navigator.clipboard.writeText(outputText).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  }; //

  return (
    <div className="flex flex-col gap-3">
      {/* --- Row 1: Language Selectors --- */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="tr-from" className="block text-xs mb-1 text-slate-400">From Language</label>
          <select
            id="tr-from"
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value)}
            className="w-full h-9 rounded-md bg-slate-800 border border-slate-700 px-2 text-sm"
          >
            {sourceLanguageList.map(lang => (
              <option key={lang.code} value={lang.code}>{lang.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label htmlFor="tr-to" className="block text-xs mb-1 text-slate-400">To Language</label>
          <select
            id="tr-to"
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="w-full h-9 rounded-md bg-slate-800 border border-slate-700 px-2 text-sm"
          >
            {targetLanguageList.map(lang => (
              <option key={lang.code} value={lang.code}>{lang.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* --- Row 2: Input / Output Text --- */}
      <div className="flex gap-3">
        {/* Input */}
        <div className="flex-1">
          <label htmlFor="tr-input" className="block text-xs mb-1 text-slate-400">Text to Translate</label>
          <textarea
            id="tr-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full min-h-[100px] rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
            placeholder="Enter text..."
          />
        </div>
        
        {/* Output */}
        <div className="flex-1">
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="tr-output" className="block text-xs text-slate-400">Translated Text</label>
            {detectedSourceLang && (
              <span className="text-xs text-slate-500">
                Detected: {detectedSourceLang.toUpperCase()}
              </span>
            )}
          </div>
          <div className="relative flex items-center">
            <textarea
              id="tr-output"
              readOnly
              value={outputText}
              className="w-full min-h-[100px] rounded-md bg-slate-950 border border-slate-700 pl-3 pr-10 py-2 text-sm text-slate-300"
              placeholder="Translation..."
            />
            <button
              onClick={handleCopy}
              className="absolute right-3 top-3 text-slate-400 hover:text-white disabled:opacity-50"
              title="Copy to clipboard"
              disabled={!outputText}
            >
              {isCopied ? <CheckIcon /> : <CopyIcon />}
            </button>
          </div>
        </div>
      </div>

      {/* --- Row 3: Button Row --- */}
      <div className="flex gap-3">
        <button
          onClick={handleTranslate}
          className="w-1/2 h-9 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors disabled:opacity-50"
          disabled={loading || !inputText.trim()}
        >
          {loading ? 'Translating...' : 'Translate'}
        </button>
        <button
          onClick={handleClear}
          className="w-1/2 h-9 rounded-md bg-slate-600 hover:bg-slate-700 text-white font-semibold text-sm transition-colors"
        >
          Clear
        </button>
      </div>
      
      {/* --- Error Message --- */}
      {error && (
        <p className="text-xs text-red-400 text-center">{error}</p>
      )}
    </div>
  );
}