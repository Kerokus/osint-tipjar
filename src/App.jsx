import { useEffect, useState } from "react";
import Admin from "./pages/Admin";
import Search from "./pages/Search";
import CreateReport from "./pages/CreateReport";
import Sources from "./pages/Sources";
import Login from "./pages/Login";
import Settings from "./pages/Settings"

function App() {
  const [activeTab, setActiveTab] = useState("newReport");
  const [authed, setAuthed] = useState(() => !!localStorage.getItem("token"));
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem("is_admin") === "true");

  useEffect(() => {
    const sync = () => {
      const authedNow = !!localStorage.getItem("token");
      const isAdminNow = localStorage.getItem("is_admin") === "true";
      setAuthed(authedNow);
      setIsAdmin(isAdminNow);
      if (!isAdminNow && activeTab === "admin") setActiveTab("newReport");
    };
    const vis = () => document.visibilityState === "visible" && sync();
    window.addEventListener("auth-changed", sync);
    window.addEventListener("storage", sync);
    window.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener("auth-changed", sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("visibilitychange", vis);
    };
  }, []);

  if (!authed) {
    return <Login onSuccess={() => window.dispatchEvent(new Event("auth-changed"))} />;
  }

  const tabs = [
    { key: "newReport", label: "Create Report" },
    { key: "sources", label: "Sources" },
    { key: "search", label: "Search" },
    { key: "settings", label: "Settings" },
    ...(isAdmin ? [{ key: "admin", label: "Admin" }] : []),
  ];

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("cin");
    localStorage.removeItem("is_admin");
    localStorage.removeItem("display_name");
    window.dispatchEvent(new Event("auth-changed"));
  };

  return (
    <div className="min-h-screen bg-slate-800 text-slate-200 flex flex-col">
      <header className="w-full py-6 px-6 flex items-center justify-between bg-slate-900">
        <div className="flex-1 flex justify-start">
          <img src="/src/assets/idsg-logo.png" alt="IDSG Logo" className="h-40 w-auto max-w-[180px] object-contain" />
        </div>
        <div className="flex-1 flex justify-center">
          <img src="/src/assets/tipjar-logo-cropped.png" alt="TIPJar Logo" className="h-50 w-auto max-w-[220px] object-contain" />
        </div>
        <div className="flex-1 flex justify-end gap-3 items-center">
          <img src="/src/assets/innovation-logo.png" alt="Innovation Logo" className="h-40 w-auto max-w-[180px] object-contain" />
        </div>
      </header>

      <div className="border-b border-slate-600 w-full" />

      <nav className="flex justify-between items-center bg-slate-800 px-6">
  {/* Left side */}
  <span className="font-medium text-base text-slate-300">
    Logged in as: {localStorage.getItem("cin")}
  </span>

  {/* Center tabs */}
  <div className="flex space-x-6">
  {tabs.map((tab) => (
    <button
      key={tab.key}
      className={`px-6 py-3 font-medium text-base transition border-b-2 ${
        activeTab === tab.key
          ? "border-blue-400 text-blue-300"
          : "border-transparent text-slate-300 hover:text-blue-200"
      }`}
      onClick={() => setActiveTab(tab.key)}
    >
      {tab.label}
    </button>
  ))}
</div>

  {/* Right side */}
  <button
  onClick={logout}
  className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 font-medium hover:bg-slate-600 hover:text-white cursor-pointer transition"
>
  Logout
</button>
</nav>

      <main className="flex-1 flex flex-col items-center justify-center p-8">
        {activeTab === "newReport" && <CreateReport />}
        {activeTab === "sources" && <Sources />}
        {activeTab === "search" && <Search />}
        {activeTab === "settings" && <Settings />}
        {isAdmin && activeTab === "admin" && <Admin />}
      </main>
    </div>
  );
}

export default App;
