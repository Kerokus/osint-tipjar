import { useEffect, useMemo, useState } from "react";
import bcrypt from "bcryptjs";

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [unit, setUnit] = useState("");
  const [serviceType, setServiceType] = useState("Military");
  const [displayName, setDisplayName] = useState("");

  const [passHash, setPassHash] = useState(""); // for PIN comparison only

  const [pinOpen, setPinOpen] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinErr, setPinErr] = useState("");
  const [pinSaving, setPinSaving] = useState(false);

  const savingDisabled = loading;

  const BASE = useMemo(() => (import.meta.env.VITE_API_URL || "").replace(/\/+$/, ""), []);
  const API_KEY = import.meta.env.VITE_API_KEY;
  const token = localStorage.getItem("token") || "";
  const cin = localStorage.getItem("cin") || "";

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      ...(API_KEY ? { "x-api-key": API_KEY } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [API_KEY, token]
  );

  // load current user
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setErr("");
        const r = await fetch(`${BASE}/users/${encodeURIComponent(cin)}`, {
          method: "GET",
          headers,
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const u = await r.json();
        if (cancel) return;

        setUnit(u.unit ?? "");
        setServiceType(u.service_type ?? "Military");
        setDisplayName(u.chatsurfer_display_name ?? "");
        setPassHash((u.pass_hash || "").replace(/\\\$/g, "$"));
      } catch (e) {
        if (!cancel) setErr(String(e));
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [BASE, headers, cin]);

  async function saveProfile() {
    setMsg("");
    setErr("");
    try {
      const body = {
        unit: unit.trim(),
        service_type: serviceType,
        chatsurfer_display_name: displayName.trim() || null,
      };
      const r = await fetch(`${BASE}/users/${encodeURIComponent(cin)}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(body),
      });
      const rd = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(rd.message || `HTTP ${r.status}`);
      
      // Add this line to update the local storage
      localStorage.setItem("display_name", displayName.trim());

      setMsg("Settings saved.");
    } catch (e) {
      setErr(String(e).replace(/^Error:\s*/, ""));
    }
  }

  async function submitPinChange() {
    setPinErr("");
    if (!/^\d+$/.test(newPin)) return setPinErr("PIN must be numbers only.");
    if (newPin !== confirmPin) return setPinErr("PINs do not match.");

    // ensure new PIN differs from current hash
    try {
      if (passHash && bcrypt.compareSync(newPin, passHash)) {
        return setPinErr("New PIN must differ from current PIN.");
      }
    } catch {
      // if compare fails, proceed; backend will accept new hash anyway
    }

    setPinSaving(true);
    try {
      const salt = bcrypt.genSaltSync(10);
      const newHash = bcrypt.hashSync(newPin, salt);

      const r = await fetch(`${BASE}/users/${encodeURIComponent(cin)}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ pass_hash: newHash }),
      });
      const rd = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(rd.message || `HTTP ${r.status}`);

      setPassHash(newHash);
      setNewPin("");
      setConfirmPin("");
      setPinOpen(false);
      setMsg("PIN updated.");
    } catch (e) {
      setPinErr(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setPinSaving(false);
    }
  }

  return (
    <div className="w-full max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-100 mb-6">Settings</h1>

      {loading && <div className="text-slate-300">Loading…</div>}
      {err && !loading && <div className="mb-4 text-red-400">Error: {err}</div>}
      {msg && !loading && <div className="mb-4 text-green-400">{msg}</div>}

      {!loading && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveProfile();
          }}
          className="grid grid-cols-1 gap-4"
        >
          <Field label="Unit">
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full px-3 py-2 rounded border border-slate-600 bg-slate-700 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </Field>

          <Field label="Service Type">
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              className="w-full px-3 py-2 rounded border border-slate-600 bg-slate-700 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {["Military", "Civilian", "Contractor"].map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Chatsurfer User Name">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 rounded border border-slate-600 bg-slate-700 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </Field>

          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={() => {
                setPinErr("");
                setNewPin("");
                setConfirmPin("");
                setPinOpen(true);
              }}
              className="px-4 py-2 rounded bg-slate-700 text-slate-200 hover:bg-slate-600 transition"
            >
              Change PIN
            </button>

            <button
              type="submit"
              disabled={savingDisabled}
              className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-400 disabled:opacity-60 transition"
            >
              Save
            </button>
          </div>
        </form>
      )}

      {/* Change PIN modal */}
      {pinOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => !pinSaving && setPinOpen(false)} />
          <div className="absolute left-1/2 top-20 -translate-x-1/2 w-[min(520px,92vw)] rounded-2xl border border-slate-600 bg-slate-800 shadow-xl">
            <div className="px-6 py-4 border-b border-slate-600">
              <h2 className="text-lg font-semibold text-slate-100">Change PIN</h2>
            </div>
            <div className="p-6">
              {pinErr && <div className="mb-3 text-red-400">Error: {pinErr}</div>}
              <div className="space-y-4">
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-slate-300">New PIN</span>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="\d*"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                    className="w-full px-3 py-2 rounded border border-slate-600 bg-slate-700 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-slate-300">Confirm New PIN</span>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="\d*"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                    className="w-full px-3 py-2 rounded border border-slate-600 bg-slate-700 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </label>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-600 flex items-center justify-between">
              <button
                className="px-4 py-2 rounded bg-slate-600 text-slate-100 hover:bg-slate-500 disabled:opacity-60"
                onClick={() => !pinSaving && setPinOpen(false)}
                disabled={pinSaving}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-400 disabled:opacity-60"
                onClick={submitPinChange}
                disabled={pinSaving}
              >
                {pinSaving ? "Saving…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- small field wrapper ---------- */
function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-slate-300">{label}</span>
      {children}
    </label>
  );
}
