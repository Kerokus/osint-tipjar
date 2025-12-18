import { useMemo, useState } from "react";
import bcrypt from "bcryptjs";

export default function CreateUser() {
  const [form, setForm] = useState({
    cin: "",
    last_name: "",
    first_name: "",
    unit: "",
    service_type: "Military",
    user_status: "Active",
    is_admin: "User", // User | Admin
    user_comments: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const BASE = useMemo(() => (import.meta.env.VITE_API_URL || "").replace(/\/+$/, ""), []);
  const API_KEY = import.meta.env.VITE_API_KEY;
  const ADDED_BY = localStorage.getItem("cin") || import.meta.env.VITE_ADMIN_CIN || "";

  const onChange = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErr("");
    setMsg("");
    try {
      // 1) Create the user
      const createRes = await fetch(`${BASE}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
        },
        body: JSON.stringify({
          cin: form.cin.trim(),
          last_name: form.last_name.trim(),
          first_name: form.first_name.trim(),
          unit: form.unit.trim(),
          service_type: form.service_type,
          user_status: form.user_status,
          added_by: ADDED_BY,
        }),
      });
      if (!createRes.ok) throw new Error(`Create failed: HTTP ${createRes.status}`);

      // 2) Set default PIN (0000) -> bcrypt hash -> PUT /users/{cin}
      const salt = bcrypt.genSaltSync(10);
      const pass_hash = bcrypt.hashSync("0000", salt);

      const patch = {
        pass_hash,
        is_admin: form.is_admin === "Admin",
        user_comments: form.user_comments,
        // backend auto-sets first_login=true
      };

      const putRes = await fetch(`${BASE}/users/${encodeURIComponent(form.cin.trim())}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
        },
        body: JSON.stringify(patch),
      });
      if (!putRes.ok) throw new Error(`Set PIN/role failed: HTTP ${putRes.status}`);

      setMsg(`User ${form.cin.trim()} created.`);
      setForm({
        cin: "",
        last_name: "",
        first_name: "",
        unit: "",
        service_type: "Military",
        user_status: "Active",
        is_admin: "User",
        user_comments: "",
      });
    } catch (e2) {
      setErr(String(e2));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-slate-100 mb-6">New User</h1>

      {msg && <div className="mb-4 text-green-400">{msg}</div>}
      {err && <div className="mb-4 text-red-400">Error: {err}</div>}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="CIN" value={form.cin} onChange={(v) => onChange("cin", v)} required />
        <Field label="Last Name" value={form.last_name} onChange={(v) => onChange("last_name", v)} required />
        <Field label="First Name" value={form.first_name} onChange={(v) => onChange("first_name", v)} required />
        <Field label="Unit" value={form.unit} onChange={(v) => onChange("unit", v)} />

        <Select
          label="Service Type"
          value={form.service_type}
          onChange={(v) => onChange("service_type", v)}
          options={["Military", "Civilian", "Contractor"]}
        />
        <Select
          label="User Status"
          value={form.user_status}
          onChange={(v) => onChange("user_status", v)}
          options={["Active", "Disabled"]}
        />
        <Select
          label="Role"
          value={form.is_admin}
          onChange={(v) => onChange("is_admin", v)}
          options={["User", "Admin"]}
        />

        <Textarea
          label="User Comments"
          value={form.user_comments}
          onChange={(v) => onChange("user_comments", v)}
          className="md:col-span-2"
        />

        <div className="md:col-span-2 flex items-center justify-between pt-2">
          <div className="text-xs text-slate-400">
            Added by: <span className="font-mono">{ADDED_BY || "(unset)"}</span>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-400 disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Create User"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* UI helpers */

function Field({ label, value, onChange, required }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-slate-300">{label}{required ? " *" : ""}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full px-3 py-2 rounded border border-slate-600 bg-slate-700 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-slate-300">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded border border-slate-600 bg-slate-700 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function Textarea({ label, value, onChange, className = "" }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-sm text-slate-300">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-h-[96px] px-3 py-2 rounded border border-slate-600 bg-slate-700 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
    </label>
  );
}
