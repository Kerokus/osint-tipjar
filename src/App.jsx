import { useEffect, useState } from "react";
import Admin from "./pages/Admin";
import ViewAndSearch from "./pages/ViewAndSearch";
import CreateReport from "./pages/CreateReport";
import Sources from "./pages/Sources";
import Login from "./pages/Login";
import Settings from "./pages/Settings";
import tipjarLogo from "./assets/tipjar-logo-cropped.png";

function App() {
  const [activeTab, setActiveTab] = useState("newReport");
  const [authed, setAuthed] = useState(() => !!localStorage.getItem("token"));
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem("is_admin") === "true");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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
  }, [activeTab]);

  if (!authed) {
    return <Login onSuccess={() => window.dispatchEvent(new Event("auth-changed"))} />;
  }

  //These are the tabs inside the sidebar.
  const tabs = [
    { key: "newReport", label: "Create Report" },
    { key: "sources", label: "Sources" },
    { key: "search", label: "View and Search" },
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

  const SidebarNav = ({ onNavigate }) => (
    <nav className="mt-2">
      <ul className="space-y-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const base =
            "w-full rounded-md transition focus:outline-none focus:ring-2 focus:ring-blue-400";
          const expanded =
            "flex items-center gap-2 px-3 py-2 text-left " +
            (isActive ? "bg-slate-800 text-blue-300" : "text-slate-300 hover:bg-slate-800 hover:text-blue-200");
          const compact =
            "grid place-items-center h-10 w-10 mx-auto " +
            (isActive ? "bg-slate-800 text-blue-300" : "text-slate-300 hover:bg-slate-800 hover:text-blue-200");
          return (
            <li key={tab.key} className={collapsed ? "px-0" : ""}>
              <button
                onClick={() => {
                  setActiveTab(tab.key);
                  if (onNavigate) onNavigate();
                }}
                className={`${base} ${collapsed ? compact : expanded}`}
                aria-current={isActive ? "page" : undefined}
                aria-label={collapsed ? tab.label : undefined}
                title={collapsed ? tab.label : undefined}
              >
                {collapsed ? (
                  <span className="font-semibold">{tab.label.charAt(0)}</span>
                ) : (
                  <span>{tab.label}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-800 text-slate-200 flex">
      {/* Sidebar for md+ */}
      <aside
        className={`hidden md:flex md:flex-col bg-slate-900 border-r border-slate-700 transition-[width] duration-200 ease-in-out overflow-hidden
          ${collapsed ? "w-16" : "w-64"}
        `}
      >
        <div className="h-40 flex flex-col justify-center border-b border-slate-700">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center w-full">
              {/* 2. The logo image is larger */}
              <img
                src={tipjarLogo}
                alt="TIPJar"
                className={`${collapsed ? "h-10 w-10 mx-auto" : "h-16 w-auto"} object-contain transition-all duration-200`}
              />
            </div>
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="ml-2 p-1 rounded hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              )}
            </button>
          </div>
        </div>

        {/* Navigation now sits below the taller logo area */}
        <div className={`overflow-y-auto ${collapsed ? "px-1 py-2" : "px-2 py-2"}`}>
          <SidebarNav />
        </div>

        {/* 3. This new spacer div pushes everything below it to the bottom */}
        <div className="flex-1" />

        <div className="mt-auto px-2 py-3 border-t border-slate-700">
          {!collapsed && (
            <div className="text-xs text-slate-400 mb-2 truncate">
              Logged in as: {localStorage.getItem("cin")}
            </div>
          )}
          <button
            onClick={logout}
            className={`${collapsed
              ? "grid place-items-center h-10 w-10 mx-auto rounded-md bg-slate-800 hover:bg-slate-700"
              : "w-full text-left px-3 py-2 rounded-md bg-slate-800 hover:bg-slate-700"} transition text-slate-200`}
            aria-label="Logout"
            title="Logout"
          >
            {collapsed ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v9m6.364-6.364A9 9 0 106.343 17.657" /></svg>
            ) : (
              "Logout"
            )}
          </button>
        </div>
      </aside>

      {/* Mobile sidebar */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="relative z-50 w-72 max-w-[80%] bg-slate-900 border-r border-slate-700 p-3 flex flex-col">
            <div className="h-12 flex items-center justify-between border-b border-slate-700">
              <img
                src={tipjarLogo}
                alt="TIPJar"
                className="h-8 w-auto object-contain"
              />
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="p-1 rounded hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                aria-label="Close sidebar"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              <SidebarNav onNavigate={() => setMobileSidebarOpen(false)} />
            </div>
            <div className="mt-auto pt-2 border-t border-slate-700">
              <div className="text-xs text-slate-400 mb-2">
                Logged in as: {localStorage.getItem("cin")}
              </div>
              <button
                onClick={() => {
                  setMobileSidebarOpen(false);
                  logout();
                }}
                className="w-full text-left px-3 py-2 rounded-md bg-slate-800 hover:bg-slate-700 transition text-slate-200"
              >
                Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 flex items-center justify-between px-3 border-b border-slate-700 bg-slate-900 md:bg-transparent md:border-b-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-1 rounded hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
              aria-label="Open sidebar"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 overflow-auto">
          {activeTab === "newReport" && <CreateReport />}
          {activeTab === "sources" && <Sources />}
          {activeTab === "search" && <ViewAndSearch />}
          {activeTab === "settings" && <Settings />}
          {isAdmin && activeTab === "admin" && <Admin />}
        </main>
      </div>
    </div>
  );
}

export default App;
