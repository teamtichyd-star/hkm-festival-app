import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import { shareToWhatsApp, sendWhatsAppTo } from "../../utils/whatsapp";

const DEPT_CATEGORIES = {
  "🎯 Coordination": ["Overall Coordinator", "Facilities Team", "Lakshmi Seva (Donations)"],
  "🛕 Deities & Ratha": ["Deities", "Ratha Arrangement", "Decoration of Ratha and Deities", "Flower Decoration"],
  "🍛 Prasadam": ["Cooking (Prasadam Kitchen)", "Main Prasadam Distribution", "Dhonna Prasadam Distribution", "Water for Ratha Yatra", "Water at Lunch Menu"],
  "🎁 VIP & Guests": ["Bahumana for VIPs", "Inviting Devotees"],
  "📿 Spiritual": ["Mantra Cards Distribution", "Kirtan Team", "Ratha Pulling", "Rangoli", "Books Distribution", "Applying Tilak"],
  "🎪 Cultural & Support": ["Local People Engagement", "Sweeping / Cleaning in Front", "Flags", "Speakers (Sound)", "Kolatam Teams"],
  "🔒 Logistics & Safety": ["Security and Crowd Control", "Medical and First Aid", "Permissions (Police/Municipal)", "Parking Management", "Photography and Videography", "Overall Sanitation"],
};

export default function Departments({ eventId }) {
  const [depts, setDepts] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [compact, setCompact] = useState(false);
  const { userRole } = useAuth();
  const canEdit = userRole === "admin" || userRole === "spoc";

  useEffect(() => {
    const q = query(collection(db, "events", eventId, "departments"), orderBy("order", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setDepts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [eventId]);

  const addDept = async () => {
    if (!canEdit) return alert("Admin/SPOC only");
    await addDoc(collection(db, "events", eventId, "departments"), {
      name: "New Department", hod: "", contact: "", team: "", responsibility: "", budget: 0, order: depts.length + 1,
    });
  };

  const updateDept = (id, field, value) => {
    updateDoc(doc(db, "events", eventId, "departments", id), { [field]: value });
  };

  const deleteDept = async (id) => {
    if (confirm("Delete this department?")) {
      await deleteDoc(doc(db, "events", eventId, "departments", id));
    }
  };

  const totalBudget = depts.reduce((sum, d) => sum + (d.budget || 0), 0);
  const withHOD = depts.filter(d => d.hod).length;
  const missingHOD = depts.filter(d => !d.hod).length;

  // Filter departments
  const filteredDepts = depts.filter(d => {
    const searchLower = search.toLowerCase();
    const matchesSearch = !search ||
      d.name?.toLowerCase().includes(searchLower) ||
      d.hod?.toLowerCase().includes(searchLower) ||
      d.team?.toLowerCase().includes(searchLower) ||
      d.responsibility?.toLowerCase().includes(searchLower);

    const matchesFilter =
      filter === "all" ||
      (filter === "hod" && d.hod) ||
      (filter === "missing" && !d.hod) ||
      (filter === "budget" && d.budget > 0);

    return matchesSearch && matchesFilter;
  });

  // Group departments
  const groupedDepts = {};
  const uncategorized = [];
  filteredDepts.forEach(d => {
    let placed = false;
    for (const [cat, names] of Object.entries(DEPT_CATEGORIES)) {
      if (names.some(n => d.name?.includes(n) || n.includes(d.name))) {
        if (!groupedDepts[cat]) groupedDepts[cat] = [];
        groupedDepts[cat].push(d);
        placed = true;
        break;
      }
    }
    if (!placed) uncategorized.push(d);
  });
  if (uncategorized.length > 0) groupedDepts["📁 Other"] = uncategorized;

  const toggleGroup = (cat) => {
    setCollapsedGroups(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const shareAllToWhatsApp = () => {
    let text = `🪔 *Seva Departments*\n\n`;
    depts.forEach((d, i) => {
      text += `${i + 1}. *${d.name}*\n`;
      if (d.hod) text += `   👤 HOD: ${d.hod}\n`;
      if (d.contact) text += `   📞 ${d.contact}\n`;
      if (d.team) text += `   👥 Team: ${d.team}\n`;
      if (d.budget > 0) text += `   💰 Budget: ₹${d.budget.toLocaleString()}\n`;
      text += `\n`;
    });
    text += `\n_Total Budget: ₹${totalBudget.toLocaleString()}_`;
    shareToWhatsApp(text);
  };

  const shareOneToWhatsApp = (dept) => {
    let text = `🪔 *${dept.name}*\n\n`;
    if (dept.hod) text += `👤 HOD: ${dept.hod}\n`;
    if (dept.contact) text += `📞 Contact: ${dept.contact}\n`;
    if (dept.team) text += `👥 Team: ${dept.team}\n`;
    if (dept.responsibility) text += `📋 Responsibility:\n${dept.responsibility}\n`;
    if (dept.budget > 0) text += `💰 Budget: ₹${dept.budget.toLocaleString()}\n`;
    shareToWhatsApp(text);
  };

  return (
    <div className="space-y-4">
      {/* Sticky Header */}
      <div className="sticky top-0 bg-gray-50 z-10 pb-2 -mx-4 px-4 pt-2 border-b border-gray-100">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-800">🏛️ Seva Departments</h2>
            <p className="text-[10px] text-gray-500">{filteredDepts.length} of {depts.length} shown · ₹{totalBudget.toLocaleString()}</p>
          </div>
          <div className="flex gap-1">
            <button onClick={shareAllToWhatsApp} className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg text-xs shadow" title="Share to WhatsApp">
              💬
            </button>
            <button onClick={() => setCompact(!compact)} className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-2 rounded-lg text-xs" title="Toggle view">
              {compact ? "📋" : "📄"}
            </button>
            {canEdit && (
              <button onClick={addDept} className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white px-3 py-2 rounded-lg text-xs font-bold shadow">
                + Add
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="🔍 Search name, HOD, team, responsibility..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-300 focus:outline-none bg-white"
        />

        {/* Filter Chips */}
        <div className="flex gap-1 mt-2 overflow-x-auto scrollbar-hide">
          {[
            { id: "all", label: `All (${depts.length})`, color: "bg-gray-100 text-gray-700" },
            { id: "hod", label: `✅ HOD (${withHOD})`, color: "bg-green-100 text-green-700" },
            { id: "missing", label: `⚠️ Missing (${missingHOD})`, color: "bg-red-100 text-red-700" },
            { id: "budget", label: `💰 Budget`, color: "bg-blue-100 text-blue-700" },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex-shrink-0 text-[11px] font-semibold px-3 py-1 rounded-full transition-all ${
                filter === f.id ? "ring-2 ring-orange-400 " + f.color : f.color + " opacity-70"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped Departments */}
      {Object.entries(groupedDepts).map(([cat, catDepts]) => (
        <div key={cat} className="space-y-2">
          <div
            onClick={() => toggleGroup(cat)}
            className="flex items-center justify-between bg-gradient-to-r from-orange-100 to-yellow-100 rounded-xl px-3 py-2 cursor-pointer hover:from-orange-200 hover:to-yellow-200"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-700">{cat}</span>
              <span className="text-[10px] bg-white text-gray-600 px-2 py-0.5 rounded-full font-bold">{catDepts.length}</span>
            </div>
            <span className={`text-gray-500 text-sm transition-transform ${collapsedGroups[cat] ? "" : "rotate-180"}`}>▼</span>
          </div>

          {!collapsedGroups[cat] && catDepts.map((dept, index) => (
            <div key={dept.id} className={`bg-white rounded-xl shadow-sm border-l-4 ${dept.hod ? "border-l-green-400" : "border-l-red-300"} border border-gray-100 hover:shadow-md transition-all`}>
              {/* Compact View */}
              {compact ? (
                <div className="flex items-center gap-3 p-3">
                  <span className="text-xs bg-orange-100 text-orange-600 w-6 h-6 rounded-lg flex items-center justify-center font-bold flex-shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{dept.name}</p>
                    <p className="text-[10px] text-gray-500 truncate">
                      {dept.hod ? "👤 " + dept.hod : "⚠️ HOD Needed"}
                      {dept.budget > 0 && " · ₹" + dept.budget.toLocaleString()}
                    </p>
                  </div>
                  <button onClick={() => setExpandedId(expandedId === dept.id ? null : dept.id)} className="text-orange-500 text-xs font-bold">
                    Edit
                  </button>
                </div>
              ) : (
                <div className="p-3 cursor-pointer" onClick={() => setExpandedId(expandedId === dept.id ? null : dept.id)}>
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className="text-sm bg-orange-100 text-orange-600 w-8 h-8 rounded-lg flex items-center justify-center font-bold flex-shrink-0">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-800 text-sm truncate">{dept.name}</h3>
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          {dept.hod ? (
                            <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">👤 {dept.hod}</span>
                          ) : (
                            <span className="text-[10px] bg-red-100 text-red-500 px-2 py-0.5 rounded-full font-medium">⚠️ HOD Needed</span>
                          )}
                          {dept.budget > 0 && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-mono font-bold">₹{dept.budget.toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className={`text-gray-400 text-xs transition-transform ${expandedId === dept.id ? "rotate-180" : ""}`}>▼</span>
                  </div>
                </div>
              )}

              {/* Expanded Details */}
              {expandedId === dept.id && (
                <div className="border-t border-gray-100 bg-gray-50/50 p-3 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] uppercase text-gray-400 font-bold">Department Name</label>
                      <input className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-semibold focus:ring-2 focus:ring-orange-300 focus:outline-none"
                        value={dept.name} onChange={(e) => updateDept(dept.id, "name", e.target.value)} readOnly={!canEdit} />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase text-gray-400 font-bold">HOD Name</label>
                      <input className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-orange-300 focus:outline-none"
                        value={dept.hod} onChange={(e) => updateDept(dept.id, "hod", e.target.value)} readOnly={!canEdit} placeholder="Assign HOD..." />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase text-gray-400 font-bold">Contact No.</label>
                      <div className="flex gap-1">
                        <input className="flex-1 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-orange-300 focus:outline-none"
                          value={dept.contact} onChange={(e) => updateDept(dept.id, "contact", e.target.value)} readOnly={!canEdit} placeholder="Phone..." />
                        {dept.contact && (
                          <button onClick={() => sendWhatsAppTo(dept.contact, `Hare Krishna ${dept.hod}! Regarding ${dept.name}...`)}
                            className="bg-green-500 text-white px-2 rounded-lg text-xs">💬</button>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] uppercase text-gray-400 font-bold">Budget (₹)</label>
                      <input type="number" className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-mono font-bold text-orange-600 focus:ring-2 focus:ring-orange-300 focus:outline-none"
                        value={dept.budget} onChange={(e) => updateDept(dept.id, "budget", Number(e.target.value))} readOnly={!canEdit} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] uppercase text-gray-400 font-bold">Team Members</label>
                    <input className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-orange-300 focus:outline-none"
                      value={dept.team} onChange={(e) => updateDept(dept.id, "team", e.target.value)} readOnly={!canEdit} placeholder="Comma separated..." />
                    {dept.team && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {dept.team.split(",").map((m, i) => (
                          <span key={i} className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">{m.trim()}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-[9px] uppercase text-gray-400 font-bold">Key Responsibility</label>
                    <textarea className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-orange-300 focus:outline-none"
                      rows="2" value={dept.responsibility} onChange={(e) => updateDept(dept.id, "responsibility", e.target.value)} readOnly={!canEdit} />
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <button onClick={() => shareOneToWhatsApp(dept)} className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg font-bold">
                      💬 Share
                    </button>
                    {canEdit && (
                      <button onClick={() => deleteDept(dept.id)} className="text-[11px] text-red-400 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg">
                        🗑️ Delete
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
