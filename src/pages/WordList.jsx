import { useState, useMemo, useEffect, useCallback } from "react";


export default function WordList() {
  
  // State for API results and loading status
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for the modals
  const [isAdding, setIsAdding] = useState(false);
  const [wordToDelete, setWordToDelete] = useState(null);

  // API configuration
  const BASE = useMemo(() => (import.meta.env.VITE_API_URL || "").replace(/\/+$/, ""), []);
  const API_KEY = import.meta.env.VITE_API_KEY;

  // --- Data Fetching Effect ---

  const fetchWords = useCallback(async () => {
    let cancel = false;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${BASE}/dirty_words`, {
        method: "GET",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      });

      if (!res.ok) throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
      
      const data = await res.json();
      if (cancel) return;

      setWords(Array.isArray(data) ? data : []);
    } catch (e) {
      if (!cancel) setError(String(e));
    } finally {
      if (!cancel) setLoading(false);
    }
    
    return () => { cancel = true; };
  }, [BASE, API_KEY]);

  useEffect(() => {
    fetchWords();
  }, [fetchWords]);

  // --- Render Logic ---

  return (
    <div className="space-y-6 p-4">
      <div className="space-y-4">
        {loading && <div className="text-slate-300">Loading word list...</div>}
        {error && <div className="text-red-400">Error: {error}</div>}
        
        {!loading && !error && words.length === 0 && (
          <div className="text-slate-300 p-4 bg-slate-800 rounded-lg text-center">
            No words found.
          </div>
        )}

        {words.length > 0 && (
          <WordTable rows={words} onDeleteWord={setWordToDelete} />
        )}
        
        <div className="pt-4">
            <button
                onClick={() => setIsAdding(true)}
                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-500 rounded-md text-white font-semibold"
            >
                Add New Word
            </button>
        </div>
      </div>
      
      {/* --- Modals --- */}
      {isAdding && (
        <AddWordModal
          onClose={() => setIsAdding(false)}
          onAddSuccess={() => {
            setIsAdding(false);
            fetchWords();
          }}
          base={BASE}
          apiKey={API_KEY}
        />
      )}
      
      {wordToDelete && (
        <DeleteConfirmModal
          word={wordToDelete}
          onClose={() => setWordToDelete(null)}
          onDeleteSuccess={() => {
            setWordToDelete(null);
            fetchWords();
          }}
          base={BASE}
          apiKey={API_KEY}
        />
      )}
    </div>
  );
}


/* ---------- Sub-components ---------- */

function WordTable({ rows, onDeleteWord }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-600">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-900 text-slate-200">
          <tr>
            <Th>Dirty Word</Th>
            <Th>Classification</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody className="text-slate-200">
          {rows.map((word) => (
            <tr key={word.id} className="odd:bg-slate-800 even:bg-slate-700 hover:bg-slate-600">
              <Td>{word.dirty_word}</Td>
              <Td>{word.word_classification}</Td>
              <Td className="text-right">
                <button
                  onClick={() => onDeleteWord(word)}
                  className="px-2 py-1 text-lg font-bold text-red-400 hover:text-red-200 hover:bg-red-800/50 rounded-md leading-none"
                  title="Delete word"
                >
                  &times;
                </button>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddWordModal({ onClose, onAddSuccess, base, apiKey }) {
  const [newWord, setNewWord] = useState({ dirty_word: "", word_classification: "CUI" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNewWord(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    setModalError("");
    if (!newWord.dirty_word.trim()) {
      setModalError("The word field cannot be empty.");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Authentication error. Please log in again.");

      const res = await fetch(`${base}/dirty_words`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(newWord),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP Error: ${res.status}`);
      }
      
      onAddSuccess();

    } catch (e) {
      setModalError(String(e).replace(/^Error:\s*/, ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-600 bg-slate-800 shadow-xl">
        <div className="px-6 py-4 border-b border-slate-600 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-100">Add New Word</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">&times;</button>
        </div>
        
        <div className="p-6 space-y-4">
          {modalError && <div className="p-3 text-sm text-red-200 bg-red-800/50 border border-red-700 rounded-md">{modalError}</div>}
          
          <div>
            <label htmlFor="dirty_word" className="block text-sm font-medium text-slate-300 mb-1">Enter new dirty word</label>
            <input
              id="dirty_word"
              name="dirty_word"
              value={newWord.dirty_word}
              onChange={handleChange}
              className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter word..."
            />
          </div>
          
          <div>
            <label htmlFor="word_classification" className="block text-sm font-medium text-slate-400 mb-1">Classification</label>
            <select
                id="word_classification"
                name="word_classification"
                value={newWord.word_classification}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-100 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="CUI">CUI</option>
              <option value="CUIREL">CUI//REL TO USA, FVEY</option>
            </select>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-600 flex justify-end items-center gap-4">
          <button onClick={onClose} disabled={isSubmitting} className="px-4 py-2 text-sm bg-slate-600 hover:bg-slate-500 rounded-md text-slate-200 disabled:opacity-50">Cancel</button>
          <button onClick={handleSubmit} disabled={isSubmitting} className="px-4 py-2 text-sm bg-green-600 hover:bg-green-500 rounded-md text-white font-semibold disabled:opacity-50">
            {isSubmitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ word, onClose, onDeleteSuccess, base, apiKey }) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [modalError, setModalError] = useState("");

    const handleDelete = async () => {
        setIsDeleting(true);
        setModalError("");
        try {
            const token = localStorage.getItem("token");
            if (!token) throw new Error("Authentication error. Please log in again.");

            const res = await fetch(`${base}/dirty_words/${word.id}`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                    "Authorization": `Bearer ${token}`,
                },
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || `HTTP Error: ${res.status}`);
            }

            onDeleteSuccess();
        } catch (e) {
            setModalError(String(e).replace(/^Error:\s*/, ''));
            setIsDeleting(false); 
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={onClose} />
            <div className="relative w-full max-w-md rounded-2xl border border-slate-600 bg-slate-800 shadow-xl">
                <div className="px-6 py-4 border-b border-slate-600">
                    <h2 className="text-lg font-semibold text-slate-100">Confirm Deletion</h2>
                </div>

                <div className="p-6 space-y-4">
                    {modalError && <div className="p-3 text-sm text-red-200 bg-red-800/50 border border-red-700 rounded-md">{modalError}</div>}
                    <p className="text-slate-300">
                        Are you sure you want to delete the word: <strong className="font-semibold text-slate-100">{word.dirty_word}</strong>?
                    </p>
                </div>
                
                <div className="px-6 py-4 border-t border-slate-600 flex justify-end items-center gap-4">
                    <button
                        onClick={onClose}
                        disabled={isDeleting}
                        className="px-4 py-2 text-sm bg-slate-600 hover:bg-slate-500 rounded-md text-slate-200 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="px-4 py-2 text-sm bg-red-700 hover:bg-red-600 rounded-md text-white font-semibold disabled:opacity-50"
                    >
                        {isDeleting ? "Deleting..." : "Yes, Delete"}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ---------- Reusable Components ---------- */

function Th({ children, className = "" }) {
  return <th className={`px-4 py-3 text-left font-semibold border-b border-slate-700 select-none ${className}`}>{children}</th>;
}

function Td({ children, className = "" }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}