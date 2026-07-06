import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { doc, deleteDoc, collection, getDocs, addDoc, setDoc } from "firebase/firestore";

const tabs = [
  { id: "departments", label: "Departments", icon: "🏛️" },
  { id: "tasks", label: "Task Tracker", icon: "✅" },
  { id: "requirements", label: "Requirements", icon: "📋" },
  { id: "crowd", label: "Crowd & Route", icon: "👥" },
  { id: "prasadam", label: "Prasadam", icon: "🍛" },
  { id: "etiquette", label: "Etiquette", icon: "🙏" },
  { id: "donations", label: "Donations", icon: "💰" },
  { id: "users", label: "User Management", icon: "👥" },
];

const DEFAULT_DEPARTMENTS = [
  { name: "Overall Coordinator", hod: "Lokesh", contact: "", team: "CGR garu", responsibility: "Overall event coordination", budget: 0, order: 1 },
  { name: "Facilities Team", hod: "", contact: "", team: "", responsibility: "Collects requirements and arranges logistics", budget: 0, order: 2 },
  { name: "Lakshmi Seva (Donations)", hod: "", contact: "", team: "", responsibility: "Raises donations", budget: 0, order: 3 },
  { name: "Deities", hod: "Shambhunatha prabhu", contact: "", team: "", responsibility: "Deity seva", budget: 0, order: 4 },
  { name: "Ratha Arrangement", hod: "Shambhunatha prabhu", contact: "", team: "", responsibility: "Ratha setup", budget: 0, order: 5 },
  { name: "Decoration of Ratha and Deities", hod: "Sumanth", contact: "", team: "Kalavati, Yettaiah", responsibility: "Decoration", budget: 10000, order: 6 },
  { name: "Flower Decoration", hod: "Sumanth", contact: "", team: "Kishan garu, Yettaiah", responsibility: "Flowers", budget: 0, order: 7 },
  { name: "Cooking (Prasadam Kitchen)", hod: "Bharat", contact: "", team: "Lakshmi Narayana, Amar", responsibility: "Cooking prasadam", budget: 0, order: 8 },
  { name: "Main Prasadam Distribution", hod: "", contact: "", team: "", responsibility: "Distribution", budget: 0, order: 9 },
  { name: "Water for Ratha Yatra", hod: "Kiran", contact: "", team: "Ramesh garu", responsibility: "Water", budget: 0, order: 10 },
  { name: "Water at Lunch Menu", hod: "Sumanth", contact: "", team: "", responsibility: "Water lunch", budget: 0, order: 11 },
  { name: "Bahumana for VIPs", hod: "Sumanth", contact: "", team: "Shambhunath prabhu", responsibility: "VIP gifts", budget: 0, order: 12 },
  { name: "Dhonna Prasadam Distribution", hod: "Bharat", contact: "", team: "Viswanatham garu", responsibility: "Donna packets", budget: 0, order: 13 },
  { name: "Inviting Devotees", hod: "Sreedevi mataji", contact: "", team: "Shiva Shankar, CGR garu", responsibility: "Invitations", budget: 0, order: 14 },
  { name: "Mantra Cards Distribution", hod: "Aditya", contact: "", team: "", responsibility: "Mantra cards", budget: 0, order: 15 },
  { name: "Kirtan Team", hod: "Sridevi mataji", contact: "", team: "Mridanga, Kartal, CGR", responsibility: "Kirtan", budget: 0, order: 16 },
  { name: "Ratha Pulling", hod: "Shiva shankar garu", contact: "", team: "", responsibility: "Pulling", budget: 0, order: 17 },
  { name: "Rangoli", hod: "Lakshmi mataji", contact: "", team: "Lakshmi Parijatam, Aishwarya, Nikita", responsibility: "Rangoli", budget: 0, order: 18 },
  { name: "Books Distribution", hod: "", contact: "", team: "", responsibility: "Books", budget: 0, order: 19 },
  { name: "Local People Engagement", hod: "", contact: "", team: "", responsibility: "Locals", budget: 0, order: 20 },
  { name: "Sweeping / Cleaning in Front", hod: "CGR garu", contact: "", team: "", responsibility: "Sweeping", budget: 0, order: 21 },
  { name: "Flags", hod: "", contact: "", team: "Shambhunath prabhu", responsibility: "Flags", budget: 0, order: 22 },
  { name: "Speakers (Sound)", hod: "Raja Reddy", contact: "", team: "", responsibility: "Sound", budget: 0, order: 23 },
  { name: "Kolatam Teams", hod: "Shambhunath prabhu", contact: "", team: "", responsibility: "Kolatam", budget: 0, order: 24 },
  { name: "Applying Tilak", hod: "Vinay", contact: "", team: "", responsibility: "Tilak", budget: 0, order: 25 },
  { name: "Security and Crowd Control", hod: "", contact: "", team: "", responsibility: "Security", budget: 0, order: 26 },
  { name: "Medical and First Aid", hod: "", contact: "", team: "", responsibility: "Medical", budget: 0, order: 27 },
  { name: "Permissions (Police/Municipal)", hod: "", contact: "", team: "", responsibility: "Permissions", budget: 0, order: 28 },
  { name: "Parking Management", hod: "", contact: "", team: "", responsibility: "Parking", budget: 0, order: 29 },
  { name: "Photography and Videography", hod: "", contact: "", team: "", responsibility: "Photos", budget: 0, order: 30 },
  { name: "Overall Sanitation", hod: "", contact: "", team: "", responsibility: "Sanitation", budget: 0, order: 31 },
];

const DEFAULT_TASKS = [
  { title: "Obtain police and municipal permission", phase: "pre", department: "Permissions (Police/Municipal)", owner: "", deadline: "", status: "Not Started", order: 1 },
  { title: "Finalize rath route and rest points", phase: "pre", department: "Overall Coordinator", owner: "", deadline: "", status: "Not Started", order: 2 },
  { title: "Book generator, tents, barricades", phase: "pre", department: "Facilities Team", owner: "", deadline: "", status: "Not Started", order: 3 },
  { title: "Volunteer registration and duty roster", phase: "pre", department: "Overall Coordinator", owner: "", deadline: "", status: "Not Started", order: 4 },
  { title: "Rath decoration material procurement", phase: "pre", department: "Decoration of Ratha and Deities", owner: "", deadline: "", status: "Not Started", order: 5 },
  { title: "Deity dress and ornaments preparation", phase: "pre", department: "Deities", owner: "", deadline: "", status: "Not Started", order: 6 },
  { title: "Prasadam menu finalize and bulk procurement", phase: "pre", department: "Cooking (Prasadam Kitchen)", owner: "", deadline: "", status: "Not Started", order: 7 },
  { title: "Sound system and mic check", phase: "pre", department: "Speakers (Sound)", owner: "", deadline: "", status: "Not Started", order: 8 },
  { title: "First aid kits and ambulance tie-up", phase: "pre", department: "Medical and First Aid", owner: "", deadline: "", status: "Not Started", order: 9 },
  { title: "Briefing on ISKCON etiquette for volunteers", phase: "pre", department: "Overall Coordinator", owner: "", deadline: "", status: "Not Started", order: 10 },
  { title: "Trial kirtan rehearsal (1 week before)", phase: "pre", department: "Kirtan Team", owner: "", deadline: "", status: "Not Started", order: 11 },
  { title: "Design and print donation-drive posters", phase: "pre", department: "Lakshmi Seva (Donations)", owner: "", deadline: "", status: "Not Started", order: 12 },
  { title: "Plan parking layout and marshal points", phase: "pre", department: "Parking Management", owner: "", deadline: "", status: "Not Started", order: 13 },
  { title: "Prepare bhoga/gift boxes for volunteers and VIPs", phase: "pre", department: "Bahumana for VIPs", owner: "", deadline: "", status: "Not Started", order: 14 },
  { title: "Book closing venue for message and prasadam", phase: "pre", department: "Facilities Team", owner: "", deadline: "", status: "Not Started", order: 15 },
  { title: "Mangal aarti and deity dressing", phase: "event", department: "Deities", owner: "", deadline: "", status: "Not Started", order: 16 },
  { title: "Rath pulling rope lane management", phase: "event", department: "Ratha Pulling", owner: "", deadline: "", status: "Not Started", order: 17 },
  { title: "Kirtan party rotation along route", phase: "event", department: "Kirtan Team", owner: "", deadline: "", status: "Not Started", order: 18 },
  { title: "Water points every 500m", phase: "event", department: "Water for Ratha Yatra", owner: "", deadline: "", status: "Not Started", order: 19 },
  { title: "Prasadam distribution counters", phase: "event", department: "Main Prasadam Distribution", owner: "", deadline: "", status: "Not Started", order: 20 },
  { title: "Crowd control at turns and narrow points", phase: "event", department: "Security and Crowd Control", owner: "", deadline: "", status: "Not Started", order: 21 },
  { title: "Medical booth active on route", phase: "event", department: "Medical and First Aid", owner: "", deadline: "", status: "Not Started", order: 22 },
  { title: "Tilak application booths along route", phase: "event", department: "Applying Tilak", owner: "", deadline: "", status: "Not Started", order: 23 },
  { title: "Manage vehicle and VIP parking", phase: "event", department: "Parking Management", owner: "", deadline: "", status: "Not Started", order: 24 },
  { title: "Photo/video coverage throughout route", phase: "event", department: "Photography and Videography", owner: "", deadline: "", status: "Not Started", order: 25 },
  { title: "Distribute bhoga/gift boxes to VIPs", phase: "event", department: "Bahumana for VIPs", owner: "", deadline: "", status: "Not Started", order: 26 },
  { title: "Closing venue message and concluding program", phase: "event", department: "Overall Coordinator", owner: "", deadline: "", status: "Not Started", order: 27 },
  { title: "Route cleanup", phase: "post", department: "Overall Sanitation", owner: "", deadline: "", status: "Not Started", order: 28 },
  { title: "Return/dismantle tents and equipment", phase: "post", department: "Facilities Team", owner: "", deadline: "", status: "Not Started", order: 29 },
  { title: "Deity re-dressing and sanctum restoration", phase: "post", department: "Deities", owner: "", deadline: "", status: "Not Started", order: 30 },
  { title: "Thank-you message to volunteers and donors", phase: "post", department: "Overall Coordinator", owner: "", deadline: "", status: "Not Started", order: 31 },
  { title: "Feedback review with all HODs", phase: "post", department: "Overall Coordinator", owner: "", deadline: "", status: "Not Started", order: 32 },
];

const DEFAULT_CHECKPOINTS = [
  { km: "0", landmark: "", waterPoint: false, medical: false, volunteer: "", order: 1 },
  { km: "0.5", landmark: "", waterPoint: false, medical: false, volunteer: "", order: 2 },
  { km: "1", landmark: "", waterPoint: false, medical: false, volunteer: "", order: 3 },
  { km: "1.5", landmark: "", waterPoint: false, medical: false, volunteer: "", order: 4 },
  { km: "2", landmark: "", waterPoint: false, medical: false, volunteer: "", order: 5 },
  { km: "2.5", landmark: "", waterPoint: false, medical: false, volunteer: "", order: 6 },
  { km: "3", landmark: "", waterPoint: false, medical: false, volunteer: "", order: 7 },
];

const DEFAULT_PRASADAM = [
  { name: "Khichdi/Prasadam plate", qtyPerPerson: 1, vendor: "", order: 1 },
  { name: "Sweet (laddu/halwa)", qtyPerPerson: 1, vendor: "", order: 2 },
  { name: "Water pouch/cup", qtyPerPerson: 1, vendor: "", order: 3 },
  { name: "Panchamrit/Charnamrit", qtyPerPerson: 0.1, vendor: "", order: 4 },
];

const DEFAULT_ETIQUETTE = [
  { text: "Maintain respectful silence/chanting near the Deity", briefed: false, order: 1 },
  { text: "No footwear near rath/deity area or prasadam counters", briefed: false, order: 2 },
  { text: "Modest dress code for volunteers near deity zones", briefed: false, order: 3 },
  { text: "No physical contact with Deity except authorized pujaris", briefed: false, order: 4 },
  { text: "Maintain cleanliness - no littering or plastic near rath", briefed: false, order: 5 },
  { text: "Prasadam to be honored, not wasted; distribute with both hands", briefed: false, order: 6 },
  { text: "Volunteers avoid standing with back towards Deity", briefed: false, order: 7 },
  { text: "Photography of Deity as per temple guidelines only", briefed: false, order: 8 },
  { text: "Maintain kirtan decorum - no interruption during aarti", briefed: false, order: 9 },
  { text: "Alcohol/tobacco strictly prohibited on premises", briefed: false, order: 10 },
  { text: "Respect elderly, women, and children in crowd management", briefed: false, order: 11 },
  { text: "Volunteers wear ID badge at all times during duty", briefed: false, order: 12 },
];

export default function Sidebar({ activeTab, setActiveTab, events, selectedEventId, setSelectedEventId, sidebarOpen, setSidebarOpen }) {
  const { userRole, user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ festivalName: "", location: "", date: "", details: "" });
  const canManage = true;
  const isSuperAdmin = user?.email === "teamtic.hyd@gmail.com";

  const createEvent = async () => {
    if (!form.festivalName || !form.location) return alert("Festival name and location required!");
    setCreating(true);
    try {
      const eventRef = await addDoc(collection(db, "events"), { ...form, createdAt: new Date() });
      const eid = eventRef.id;
      for (const d of DEFAULT_DEPARTMENTS) await addDoc(collection(db, "events", eid, "departments"), d);
      for (const t of DEFAULT_TASKS) await addDoc(collection(db, "events", eid, "tasks"), t);
      await setDoc(doc(db, "events", eid, "crowd", "config"), { regularDevotees: 300, footfallPerKm: 800, routeKm: 3 });
      for (const c of DEFAULT_CHECKPOINTS) await addDoc(collection(db, "events", eid, "checkpoints"), c);
      for (const p of DEFAULT_PRASADAM) await addDoc(collection(db, "events", eid, "prasadam"), p);
      for (const e of DEFAULT_ETIQUETTE) await addDoc(collection(db, "events", eid, "etiquette"), e);
      setSelectedEventId(eid);
      setShowCreate(false);
      setForm({ festivalName: "", location: "", date: "", details: "" });
    } catch (err) {
      alert("Error: " + err.message);
    }
    setCreating(false);
  };

  const deleteEvent = async (eid) => {
    const currentEvent = events.find(e => e.id === eid);
    if (deleteConfirmText !== currentEvent?.festivalName) {
      alert("Please type the exact festival name to confirm deletion!");
      return;
    }

    try {
      const subs = ["departments", "tasks", "requirements", "checkpoints", "prasadam", "etiquette", "donors"];
      for (const sub of subs) {
        const snap = await getDocs(collection(db, "events", eid, sub));
        for (const d of snap.docs) await deleteDoc(d.ref);
      }
      try { await deleteDoc(doc(db, "events", eid, "crowd", "config")); } catch(e) {}
      await deleteDoc(doc(db, "events", eid));
      if (selectedEventId === eid) {
        const remaining = events.filter(e => e.id !== eid);
        setSelectedEventId(remaining.length > 0 ? remaining[0].id : null);
      }
      setShowDeleteConfirm(false);
      setDeleteConfirmText("");
      setShowAdvanced(false);
      alert("Event deleted successfully!");
    } catch (err) {
      alert("Error deleting: " + err.message);
    }
  };

  const currentEvent = events.find(e => e.id === selectedEventId);

  return (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed md:sticky top-0 left-0 h-full md:h-[calc(100vh-56px)] w-72 bg-white border-r border-gray-200 shadow-xl md:shadow-none z-40 transform transition-transform duration-300 overflow-y-auto ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}>
        <div className="p-4">
          <div className="flex justify-between items-center md:hidden mb-4">
            <span className="text-sm font-bold text-gray-700">Menu</span>
            <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>

          {/* Event Selector */}
          <div className="mb-4">
            <label className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">🎪 Select Event</label>
            <select
              value={selectedEventId || ""}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full mt-1 text-sm font-semibold bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300"
            >
              {events.length === 0 && <option value="">No events</option>}
              {events.map(e => (
                <option key={e.id} value={e.id}>
                  {e.festivalName} - {e.location}
                </option>
              ))}
            </select>
          </div>

          {/* Create Button Only (No Delete Here) */}
          {canManage && (
            <div className="mb-4">
              <button
                onClick={() => setShowCreate(!showCreate)}
                className="w-full text-xs bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-bold py-2 rounded-xl shadow"
              >
                + New Event
              </button>
            </div>
          )}

          {/* Create Form */}
          {showCreate && (
            <div className="mb-4 bg-orange-50 rounded-xl p-3 border border-orange-200 space-y-2">
              <p className="text-[10px] text-gray-500">All default data will be auto-created</p>
              <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" placeholder="Festival Name *" value={form.festivalName} onChange={(e) => setForm({ ...form, festivalName: e.target.value })} />
              <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" placeholder="Location *" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              <input type="date" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" placeholder="Details" value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
              <div className="flex gap-2">
                <button onClick={createEvent} disabled={creating} className="flex-1 bg-orange-500 text-white font-bold text-sm py-2 rounded-xl disabled:opacity-50">
                  {creating ? "Creating..." : "Create"}
                </button>
                <button onClick={() => setShowCreate(false)} className="bg-gray-200 text-gray-600 font-bold text-sm py-2 px-3 rounded-xl">Cancel</button>
              </div>
            </div>
          )}

          {/* Nav Tabs */}
          <div className="space-y-1">
            <p className="text-[10px] uppercase text-gray-400 font-bold tracking-wider mb-2">Navigation</p>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 text-sm font-medium px-3 py-2.5 rounded-xl transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-orange-500 to-yellow-500 text-white shadow-md"
                    : "text-gray-600 hover:bg-orange-50"
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Advanced Settings - Only Super Admin */}
          {isSuperAdmin && (
            <div className="mt-6 border-t border-gray-100 pt-4">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full text-left text-[10px] uppercase text-gray-400 font-bold tracking-wider flex justify-between items-center hover:text-gray-600"
              >
                <span>⚙️ Advanced Settings</span>
                <span className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`}>▼</span>
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-2">
                  <p className="text-[10px] text-gray-400">Danger Zone - Super Admin Only</p>
                  {currentEvent && (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full text-[11px] bg-red-50 text-red-500 hover:bg-red-100 font-semibold py-2 px-3 rounded-lg border border-red-200"
                    >
                      🗑️ Delete Current Event
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && currentEvent && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center mb-4">
              <div className="text-5xl mb-3">⚠️</div>
              <h2 className="text-xl font-bold text-red-600">Delete Event?</h2>
              <p className="text-sm text-gray-600 mt-2">
                This will permanently delete <strong>{currentEvent.festivalName}</strong> and ALL its data:
              </p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 space-y-1">
              <p className="text-xs text-red-700">✗ All departments</p>
              <p className="text-xs text-red-700">✗ All tasks</p>
              <p className="text-xs text-red-700">✗ All requirements</p>
              <p className="text-xs text-red-700">✗ All donations</p>
              <p className="text-xs text-red-700">✗ All checkpoints</p>
              <p className="text-xs text-red-700 font-bold">This CANNOT be undone!</p>
            </div>

            <div className="mb-4">
              <label className="text-xs font-bold text-gray-700 block mb-2">
                Type <span className="text-red-600 font-mono">{currentEvent.festivalName}</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full border-2 border-red-200 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                placeholder="Type festival name here..."
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText("");
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2.5 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteEvent(selectedEventId)}
                disabled={deleteConfirmText !== currentEvent.festivalName}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
