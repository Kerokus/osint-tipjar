import { useEffect, useMemo, useState } from "react";
import bcrypt from "bcryptjs";


export default function UserList() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [openCin, setOpenCin] = useState(null);
  const [sort, setSort] = useState({ key: "cin", dir: "asc" });

  const BASE = useMemo(() => (import.meta.env.VITE_API_URL || "").replace(/\/+$/, ""), []);
  const API_KEY = import.meta.env.VITE_API_KEY;
  const URL = `${BASE}/users/`;

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(URL, {
          headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
          method: "GET",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancel) setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancel) setErr(String(e));
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [URL, API_KEY]);

  const setSortKey = (key) =>
    setSort((p) => (p.key === key ? { key, dir: p.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const sortedRows = useMemo(() => {
    const arr = [...rows];
    const { key, dir } = sort;
    const s = dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      const va = a[key], vb = b[key];
      if (key === "last_login") {
        const da = va ? Date.parse(va) : 0, db = vb ? Date.parse(vb) : 0;
        return s * (da - db);
      }
      if (typeof va === "string" || typeof vb === "string") {
        return s * String(va ?? "").localeCompare(String(vb ?? ""), undefined, { sensitivity: "base" });
      }
      if (typeof va === "boolean" || typeof vb === "boolean") {
        return s * ((va ? 1 : 0) - (vb ? 1 : 0));
      }
      return s * ((va ?? 0) - (vb ?? 0));
    });
    return arr;
  }, [rows, sort]);

  const removeRow = (cin) => setRows((xs) => xs.filter((r) => r.cin !== cin));
  const updateRow = (cin, patch) => setRows((xs) => xs.map((r) => (r.cin === cin ? { ...r, ...patch } : r)));

  if (loading) return <div className="text-slate-300">Loading users…</div>;
  if (err) return <div className="text-red-400">Error: {err}</div>;
  if (!rows.length) return <div className="text-slate-300">No users.</div>;

  return (
    <div className="w-full">
      <div className="overflow-x-auto rounded-xl border border-slate-600">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900 text-slate-200">
            <tr>
              <Th onClick={() => setSortKey("cin")} active={sort.key === "cin"} dir={sort.dir}>CIN</Th>
              <Th onClick={() => setSortKey("last_name")} active={sort.key === "last_name"} dir={sort.dir}>Last Name</Th>
              <Th onClick={() => setSortKey("first_name")} active={sort.key === "first_name"} dir={sort.dir}>First Name</Th>
              <Th onClick={() => setSortKey("unit")} active={sort.key === "unit"} dir={sort.dir}>Unit</Th>
              <Th onClick={() => setSortKey("service_type")} active={sort.key === "service_type"} dir={sort.dir}>Service Type</Th>
              <Th onClick={() => setSortKey("user_status")} active={sort.key === "user_status"} dir={sort.dir}>Account Status</Th>
              <Th onClick={() => setSortKey("is_admin")} active={sort.key === "is_admin"} dir={sort.dir}>Role</Th>
              <Th onClick={() => setSortKey("last_login")} active={sort.key === "last_login"} dir={sort.dir}>Last Login</Th>
            </tr>
          </thead>
          <tbody className="text-slate-200">
            {sortedRows.map((u) => (
              <tr
                key={u.cin}
                onClick={() => setOpenCin(u.cin)}
                className="odd:bg-slate-800 even:bg-slate-700 hover:bg-slate-600 cursor-pointer"
              >
                <Td>{u.cin}</Td>
                <Td>{u.last_name}</Td>
                <Td>{u.first_name}</Td>
                <Td className="whitespace-pre-wrap">{u.unit}</Td>
                <Td>{u.service_type}</Td>
                <Td>{u.user_status}</Td>
                <Td>{u.is_admin ? "Admin" : "User"}</Td>
                <Td>{u.last_login ? new Date(u.last_login).toLocaleString() : "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openCin && (
        <UserModal
          cin={openCin}
          base={BASE}
          apiKey={API_KEY}
          onClose={() => setOpenCin(null)}
          onDeleted={(cin) => {
            removeRow(cin);
            setOpenCin(null);
          }}
          onUpdated={(cin, patch) => updateRow(cin, patch)}
        />
      )}
    </div>
  );
}

/* ---------- table cells ---------- */

function Th({ children, onClick, active, dir }) {
  return (
    <th
      onClick={onClick}
      className="px-4 py-3 text-left font-semibold border-b border-slate-700 select-none cursor-pointer"
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {active ? (dir === "asc" ? "▲" : "▼") : ""}
      </span>
    </th>
  );
}
function Td({ children, className = "" }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}

/* ---------- Modal ---------- */

function UserModal({ cin, base, apiKey, onClose, onDeleted, onUpdated }) {
  const [user, setUser] = useState(null);
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const url = `${base}/users/${cin}`;

  const resetPin = async () => {
  if (!confirm(`Reset PIN for ${cin} to default and require change on next login?`)) return;
  setSaving(true);
  setErr("");
  try {
    const salt = bcrypt.genSaltSync(10);
    const pass_hash = bcrypt.hashSync("0000", salt);

    const headers = {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    };
    const token = localStorage.getItem("token");
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify({ pass_hash, first_login: true }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // reflect locally
    setUser((u) => ({ ...u, first_login: true }));
  } catch (e) {
    setErr(String(e));
  } finally {
    setSaving(false);
  }
};


  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setErr("");
        const res = await fetch(url, {
          headers: { "Content-Type": "application/json", "x-api-key": apiKey },
          method: "GET",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancel) setUser(data);
      } catch (e) {
        if (!cancel) setErr(String(e));
      }
    })();
    return () => {
      cancel = true;
    };
  }, [url, apiKey]);

  // field order: swap Chatsurfer before Comments; hide first_login
  const fieldOrder = [
    "cin",
    "last_name",
    "first_name",
    "unit",
    "service_type",
    "user_status",
    "is_admin",
    "last_login",
    "added_by",
    "chatsurfer_display_name", 
    "user_comments",
  ];
  const nonEditable = new Set(["added_by", "last_login"]);
  const visibleKeys = (obj) =>
    fieldOrder.filter((k) => k in (obj || {}) && k !== "pass_hash" && k !== "first_login");

  const handleChange = (k, v) => setUser((u) => ({ ...u, [k]: v }));

  const submitEdit = async () => {
    setSaving(true);
    setErr("");
    try {
      const payload = Object.fromEntries(
        Object.entries(user).filter(([k]) => !nonEditable.has(k))
      );
      if ("is_admin" in payload) payload.is_admin = payload.is_admin === true; // ensure boolean
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onUpdated(cin, payload);
      setEdit(false);
    } catch (e) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async () => {
    if (!confirm(`Delete user ${cin}?`)) return;
    setSaving(true);
    setErr("");
    try {
      const res = await fetch(url, { method: "DELETE", headers: { "x-api-key": apiKey } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onDeleted(cin);
    } catch (e) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={() => !saving && onClose()} />
      <div className="absolute left-1/2 top-12 -translate-x-1/2 w-[min(800px,92vw)] rounded-2xl border border-slate-600 bg-slate-800 shadow-xl">
        <div className="px-6 py-4 border-b border-slate-600 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">User {cin}</h2>
          <button
            className="px-3 py-1 rounded bg-slate-600 text-slate-100 hover:bg-slate-500"
            onClick={onClose}
            disabled={saving}
          >
            Close
          </button>
        </div>

        <div className="p-6">
          {err && <div className="mb-4 text-red-400">Error: {err}</div>}
          {!user ? (
            <div className="text-slate-300">Loading…</div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitEdit();
              }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {visibleKeys(user).map((k) =>
                k === "is_admin" ? (
                  <RoleField
                    key={k}
                    value={user.is_admin === true ? "Admin" : "User"}
                    onChange={(v) => handleChange("is_admin", v === "Admin")}
                    disabled={!edit}
                  />
                ) : k === "service_type" ? (
                  <SelectField
                    key={k}
                    label="Service Type"
                    value={user.service_type ?? ""}
                    onChange={(v) => handleChange("service_type", v)}
                    disabled={!edit}
                    options={["Military", "Civilian", "Contractor"]}
                  />
                ) : k === "user_status" ? (
                  <SelectField
                    key={k}
                    label="Account Status"
                    value={user.user_status ?? ""}
                    onChange={(v) => handleChange("user_status", v)}
                    disabled={!edit}
                    options={["Active", "Disabled"]}
                  />
                ) : k === "user_comments" ? (
                  <TextareaField
                    key={k}
                    label="User Comments"
                    value={user.user_comments ?? ""}
                    onChange={(v) => handleChange("user_comments", v)}
                    disabled={!edit}
                    // span full width
                    className="md:col-span-2"
                  />
                ) : k === "chatsurfer_display_name" ? (
                  <Field
                    key={k}
                    label="ChatSurfer Display Name"
                    name={k}
                    value={fmtVal(user[k])}
                    onChange={(v) => handleChange(k, v)}
                    disabled={!edit || nonEditable.has(k)}
                  />
                ) : (
                  <Field
                    key={k}
                    label={labelize(k)}
                    name={k}
                    value={fmtVal(user[k])}
                    onChange={(v) => handleChange(k, v)}
                    disabled={!edit || nonEditable.has(k)}
                  />
                )
              )}
            </form>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-600 flex items-center justify-between">
          {!edit ? (
            <>
              <button
                onClick={() => setEdit(true)}
                className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-400 disabled:opacity-60"
                disabled={!user || saving}
              >
                Edit User
              </button>

              <button
                onClick={resetPin}
                className="px-4 py-2 rounded bg-slate-700 text-slate-100 hover:bg-slate-600 disabled:opacity-60"
                disabled={!user || saving}
              >
                Reset PIN
              </button>
              <button
                onClick={deleteUser}
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-500 disabled:opacity-60"
                disabled={!user || saving}
              >
                Delete User
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEdit(false)}
                className="px-4 py-2 rounded bg-slate-600 text-slate-100 hover:bg-slate-500 disabled:opacity-60"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={submitEdit}
                className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-400 disabled:opacity-60"
                disabled={saving}
              >
                Submit
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- form fields ---------- */

function Field({ label, name, value, onChange, disabled }) {
  const common =
    "w-full px-3 py-2 rounded border border-slate-600 bg-slate-700 text-slate-200";
  const gray = "opacity-75 cursor-not-allowed";
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-slate-300">{label}</span>
      <input
        name={name}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`${common} ${disabled ? gray : "focus:outline-none focus:ring-2 focus:ring-blue-400"}`}
      />
    </label>
  );
}

function TextareaField({ label, value, onChange, disabled, className = "" }) {
  const base =
    "w-full min-h-[96px] px-3 py-2 rounded border border-slate-600 bg-slate-700 text-slate-200";
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-sm text-slate-300">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`${base} ${disabled ? "opacity-75 cursor-not-allowed" : "focus:outline-none focus:ring-2 focus:ring-blue-400"}`}
      />
    </label>
  );
}

function SelectField({ label, value, onChange, disabled, options }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-slate-300">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 rounded border border-slate-600 bg-slate-700 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-75 disabled:cursor-not-allowed"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function RoleField({ value, onChange, disabled }) {
  return (
    <SelectField
      label="Role"
      value={value}
      onChange={onChange}
      disabled={disabled}
      options={["User", "Admin"]}
    />
  );
}

/* ---------- utils ---------- */

function labelize(k) {
  return k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function fmtVal(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}
