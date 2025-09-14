import { useState } from "react";
import UserList from "./UserList";
import WordList from "./WordList";
import CreateUser from "./CreateUser";

export default function Admin() {
  const [active, setActive] = useState(null);

  const items = [
    { key: "users", label: "View Users", component: <UserList /> },
    { key: "add", label: "Add New User", component: <CreateUser /> },
    { key: "words", label: "Bad Words", component: <WordList /> },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto mt-0 pt-6">
      <h1 className="text-2xl font-semibold text-slate-100 mb-6 text-center">Admin Panel</h1>

      {!active && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {items.map((item) => (
            <button
              key={item.key}
              onClick={() => setActive(item.key)}
              className="px-6 py-3 rounded-xl bg-slate-700/60 border border-slate-600 
                        hover:bg-slate-600 hover:border-blue-400 text-slate-100 
                        shadow-sm transition focus:outline-none focus:ring-2 
                        focus:ring-blue-400/60"
            >
              <span className="text-base font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      )}

      {active && (
        <div className="mt-6">
          <button
            onClick={() => setActive(null)}
            className="mb-4 px-4 py-2 rounded bg-slate-600 text-slate-200 hover:bg-slate-500"
          >
            ← Back
          </button>
          {items.find((i) => i.key === active)?.component}
        </div>
      )}
    </div>
  );
}
