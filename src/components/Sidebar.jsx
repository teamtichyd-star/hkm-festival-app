import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { doc, deleteDoc, collection, addDoc } from "firebase/firestore";
import AIEventPlanner from "./AIEventPlanner";

const tabs = [
  { id: "dashboard", label: "Dashboard", icon: "🏠" },
  { id: "departments", label: "Departments", icon: "🏛️" },
  { id: "tasks", label: "Task Tracker", icon: "✅" },
  { id: "requirements", label: "Requirements", icon: "📋" },
  { id: "crowd", label: "Crowd & Route", icon: "👥" },
  { id: "prasadam", label: "Prasadam", icon: "🍛" },
  { id: "etiquette", label: "Etiquette", icon: "🙏" },
  { id: "donations", label: "Donations", icon: "💰" },
  { id: "users", label: "User Management", icon: "👥" },
  { id: "ai", label: "AI Assistant", icon: "✨" },
];

export default function Sidebar({ activeTab, setActiveTab, events, selectedEventId, setSelectedEventId, sidebarOpen, setSidebarOpen }) {
  const { userData } = useAuth();
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [showAIPlanner, setShowAIPlanner] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  
  const [form, setForm] = useState({ 
    festivalName: "", location: "", date: "", 
    startLoc: "", endLoc: "", 
    procStart: "", procEnd: "", dinnerTime: "",
    crowdDarshan: "", crowdDinner: "",
    donnaCount: "", mahaCount: "", volunteerCount: "",
    vipGuests: false, details: "" 
  });

  const canManage = userData?.globalRole === "superadmin" || userData?.role === "admin";

  const createEvent = async () => {
    if (!form.festivalName || !form.location) return alert("Name and Location required!");
    try {
      await addDoc(collection(db, "events"), { ...form, createdAt: new Date() });
      setShowNewEvent(false);
      setForm({ festivalName: "", location: "", date: "" }); // Reset
    } catch (e) { alert(e.message); }
  };

  const deleteEvent = async (eid) => {
    const currentEvent = events.find(e => e.id === eid);
    if (deleteConfirmText !== currentEvent?.festivalName) return alert("Name mismatch!");
    try {
      await deleteDoc(doc(db, "events", eid));
      setShowDeleteConfirm(false);
      if (selectedEventId === eid) setSelectedEventId(events.find(e => e.id !== eid)?.id || null);
    } catch (e) { alert(e.message); }
  };

  const currentEvent = events.find(e => e.id === selectedEventId);

  return (
    <>
      <div className={`fixed inset-0 bg-black/50 z-20 md:hidden ${sidebarOpen ? "block" : "hidden"}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`fixed md:static inset-y-0 left-0 w-64 bg-white border-r border-gray-100 z-30 transition-transform duration-300 transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        <div className="flex flex-col h-full p-4 overflow-y-auto">
          <div className="mb-4">
            <label className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">🎪 Select Event</label>
            <select value={selectedEventId || ""} onChange={(e) => setSelectedEventId(e.target.value)} className="w-full mt-1 text-sm font-semibold bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
              {events.map(e => <option key={e.id} value={e.id}>{e.festivalName} - {e.location}</option>)}
            </select>
          </div>

          {canManage && (
            <div className="mb-4 space-y-2">
              <button onClick={() => setShowNewEvent(!showNewEvent)} className="w-full bg-orange-500 text-white text-xs font-bold py-2 rounded-xl">+ New Event</button>
              {showNewEvent && (
                <div className="bg-gray-50 p-3 rounded-xl space-y-2 text-[11px]">
                  <input placeholder="Festival Name *" className="w-full p-2 border rounded" value={form.festivalName} onChange={e => setForm({...form, festivalName: e.target.value})} />
                  <input placeholder="City/Location *" className="w-full p-2 border rounded" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
                  <input type="date" className="w-full p-2 border rounded" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                  <div className="grid grid-cols-2 gap-1">
                    <input placeholder="Start Loc" className="p-2 border rounded" value={form.startLoc} onChange={e => setForm({...form, startLoc: e.target.value})} />
                    <input placeholder="End Loc" className="p-2 border rounded" value={form.endLoc} onChange={e => setForm({...form, endLoc: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[9px] uppercase font-bold text-gray-500">
                    <div>Proc Start<input type="time" className="w-full p-1 border rounded" value={form.procStart} onChange={e => setForm({...form, procStart: e.target.value})} /></div>
                    <div>Proc End<input type="time" className="w-full p-1 border rounded" value={form.procEnd} onChange={e => setForm({...form, procEnd: e.target.value})} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <input type="number" placeholder="Crowd (Total)" className="p-2 border rounded" value={form.crowdDarshan} onChange={e => setForm({...form, crowdDarshan: e.target.value})} />
                    <input type="number" placeholder="Dinner Count" className="p-2 border rounded" value={form.crowdDinner} onChange={e => setForm({...form, crowdDinner: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <input type="number" placeholder="Donna Count" className="p-2 border rounded" value={form.donnaCount} onChange={e => setForm({...form, donnaCount: e.target.value})} />
                    <input type="number" placeholder="Maha Count" className="p-2 border rounded" value={form.mahaCount} onChange={e => setForm({...form, mahaCount: e.target.value})} />
                  </div>
                  <button onClick={createEvent} className="w-full bg-green-600 text-white font-bold py-2 rounded">Create Structured Event</button>
                </div>
              )}
            </div>
          )}

          <nav className="flex-1 space-y-1">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id ? "bg-orange-100 text-orange-700" : "text-gray-500 hover:bg-gray-50"}`}>
                <span>{tab.icon}</span>{tab.label}
              </button>
            ))}
          </nav>

          {canManage && (
            <div className="mt-auto pt-4 border-t border-gray-100">
               <button onClick={() => setShowDeleteConfirm(true)} className="text-[10px] text-red-300 hover:text-red-500">Delete Event</button>
            </div>
          )}
        </div>
      </aside>

      {showDeleteConfirm && currentEvent && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl max-w-sm w-full">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Delete Event?</h3>
            <p className="text-sm text-gray-500 mb-4">Type <span className="font-bold text-red-600">{currentEvent.festivalName}</span> to confirm.</p>
            <input className="w-full p-2 border rounded mb-4" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2 bg-gray-100 rounded-xl">Cancel</button>
              <button onClick={() => deleteEvent(selectedEventId)} disabled={deleteConfirmText !== currentEvent.festivalName} className="flex-1 py-2 bg-red-600 text-white rounded-xl disabled:opacity-50">Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
