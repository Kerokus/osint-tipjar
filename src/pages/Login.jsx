import { useMemo, useState } from "react";
import bcrypt from "bcryptjs";

export default function Login({ onSuccess }) {
  const [cin, setCin] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const [firstLoginUser, setFirstLoginUser] = useState(null);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [changing, setChanging] = useState(false);
  const [changeErr, setChangeErr] = useState("");

  const BASE = useMemo(() => (import.meta.env.VITE_API_URL || "").replace(/\/+$/, ""), []);
  const API_KEY = import.meta.env.VITE_API_KEY;

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    if (!cin || !pin) return setErr("Enter CIN and PIN.");
    setLoading(true);
    try {
      // POST /login to get JWT and basic flags
      const res = await fetch(`${BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(API_KEY ? { "x-api-key": API_KEY } : {}) },
        body: JSON.stringify({ cin: cin.trim(), pin: pin.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);

      // ensure we know status + first_login; if backend didn't return them, fetch profile
      let status = data.user_status;
      let firstLogin = data.first_login;
      const tokenFromLogin = data.token;
      const cinFromLogin = data.cin;

      if (status === undefined || firstLogin === undefined) {
        const profRes = await fetch(`${BASE}/users/${encodeURIComponent(cinFromLogin)}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(API_KEY ? { "x-api-key": API_KEY } : {}),
            ...(tokenFromLogin ? { Authorization: `Bearer ${tokenFromLogin}` } : {}),
          },
        });
        const prof = await profRes.json().catch(() => ({}));
        status = status ?? prof.user_status;
        firstLogin = firstLogin ?? prof.first_login;
      }

      // block disabled accounts BEFORE saving anything
      if (status === "Disabled") {
        throw new Error("Your account has been disabled. Please see an administrator.");
      }

      // persist auth
      localStorage.setItem("token", tokenFromLogin);
      localStorage.setItem("cin", cinFromLogin);
      localStorage.setItem("is_admin", String(!!data.is_admin));
      localStorage.setItem("display_name", data.display_name || "");

      // first login flow → prompt PIN change
      if (firstLogin) {
        setFirstLoginUser({ cin: cinFromLogin, is_admin: !!data.is_admin });
        return;
      }

      onSuccess?.();
      window.dispatchEvent(new Event("auth-changed"));
    } catch (e2) {
      setErr(String(e2).replace(/^Error:\s*/, ""));
    } finally {
      setLoading(false);
    }
  }

  async function submitPinChange() {
    setChangeErr("");
    if (!newPin || !confirmPin) return setChangeErr("Enter and confirm the new PIN.");
    if (!/^\d+$/.test(newPin)) return setChangeErr("PIN must be numbers only.");
    if (newPin !== confirmPin) return setChangeErr("PINs do not match.");

    setChanging(true);
    try {
      const salt = bcrypt.genSaltSync(10);
      const pass_hash = bcrypt.hashSync(newPin, salt);

      const token = localStorage.getItem("token") || "";
      const cinFL = firstLoginUser.cin;

      const r = await fetch(`${BASE}/users/${encodeURIComponent(cinFL)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(API_KEY ? { "x-api-key": API_KEY } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ pass_hash, first_login: false }),
      });
      const rd = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(rd.message || `HTTP ${r.status}`);

      setFirstLoginUser(null);
      setNewPin("");
      setConfirmPin("");

      onSuccess?.();
      window.dispatchEvent(new Event("auth-changed"));
    } catch (e) {
      setChangeErr(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setChanging(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-800 text-slate-200 flex flex-col">
      {/* Logos only, no header/nav */}
      <div className="w-full py-8 px-6 flex items-center justify-between">
        <div className="flex-1 flex justify-start">
          <img src="/public/images/idsg-logo.png" alt="IDSG Logo" className="h-28 w-auto object-contain" />
        </div>
        <div className="flex-1 flex justify-center">
          <img src="/public/images/tipjar-logo-cropped.png" alt="TIPJar Logo" className="h-36 w-auto object-contain" />
        </div>
        <div className="flex-1 flex justify-end">
          <img src="/public/images/innovation-logo.png" alt="Innovation Logo" className="h-28 w-auto object-contain" />
        </div>
      </div>

      <main className="flex-1 flex flex-col items-center justify-start pt-6 px-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-600 bg-slate-900 p-6 shadow">
          <h1 className="text-xl font-semibold mb-4">Login</h1>
          {err && <div className="mb-3 text-red-400">{err}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-slate-300">CIN</span>
              <input
                value={cin}
                onChange={(e) => setCin(e.target.value.slice(0, 15))}
                maxLength={15}
                className="w-full px-3 py-2 rounded border border-slate-600 bg-slate-700 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-slate-300">PIN</span>
              <input
                type="password"
                inputMode="numeric"
                pattern="\d*"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="w-full px-3 py-2 rounded border border-slate-600 bg-slate-700 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-400 disabled:opacity-60"
            >
              {loading ? "Checking…" : "Submit"}
            </button>
          </form>
        </div>
      </main>

      {firstLoginUser && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" />
          <div className="absolute left-1/2 top-20 -translate-x-1/2 w-[min(520px,92vw)] rounded-2xl border border-slate-600 bg-slate-800 shadow-xl">
            <div className="px-6 py-4 border-b border-slate-600">
              <h2 className="text-lg font-semibold">Change PIN for {firstLoginUser.cin}</h2>
            </div>
            <div className="p-6">
              {changeErr && <div className="mb-3 text-red-400">Error: {changeErr}</div>}
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
                onClick={() => {
                  if (!changing) {
                    setFirstLoginUser(null);
                    setNewPin("");
                    setConfirmPin("");
                  }
                }}
                disabled={changing}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-400 disabled:opacity-60"
                onClick={submitPinChange}
                disabled={changing}
              >
                {changing ? "Saving…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
