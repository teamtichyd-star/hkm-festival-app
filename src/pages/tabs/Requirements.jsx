import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import { shareToWhatsApp, sendWhatsAppTo } from "../../utils/whatsapp";

const STATUS_COLORS = {
  Pending: "bg-yellow-100 text-yellow-700",
  Arranged: "bg-green-100 text-green-700",
  Partial: "bg-blue-100 text-blue-700",
  Cancelled: "bg-red-100 text-red-600",
};

export default function Requirements({ eventId }) {
  const [reqs, setReqs] = useState([]);
  const [depts, setDepts] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const { userRole, user, userDept } = useAuth();
  const canAdd = userRole === "admin" || userRole === "spoc" || userRole === "hod";
  const canUpdateStatus = userRole === "admin" || userRole === "spoc";

  useEffect(() => {
    const q = query(collection(db, "events", eventId, "requirements"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setReqs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [eventId]);

  useEffect(() => {
    const q = query(collection(db, "events", eventId, "departments"), orderBy("order", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setDepts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [eventId]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Get Facilities Team department & HOD info
  const facilitiesDept = depts.find(d => d.name === "Facilities Team");
  const facilitiesHod = facilitiesDept?.hod || "";
  const facilitiesContact = facilitiesDept?.contact || "";

  // Get current user's assigned department
  const getMyDepartment = () => {
    if (userRole === "hod" && userDept) {
      const myDept = depts.find(d => d.id === userDept);
      return myDept?.name || "";
    }
    const currentUser = users.find(u => u.id === user?.uid);
    if (currentUser?.name || user?.displayName) {
      const nameToMatch = (currentUser?.name || user?.displayName).toLowerCase();
      const dept = depts.find(d => d.hod?.toLowerCase().includes(nameToMatch) || nameToMatch.includes(d.hod?.toLowerCase()));
      return dept?.name || "";
    }
    return "";
  };

  const addReq = async () => {
    if (!canAdd) return alert("No permission");
    const myDept = getMyDepartment();
    await addDoc(collection(db, "events", eventId, "requirements"), {
      department: myDept,
      requestedBy: user?.displayName || "",
      item: "",
      qty: "",
      neededBy: "",
      status: "Pending",
      estCost: 0,
      createdAt: new Date(),
    });
  };

  const updateReq = (id, field, value) => {
    updateDoc(doc(db, "events", eventId, "requirements", id), { [field]: value });
  };

  const deleteReq = async (id) => {
    if (confirm("Delete this requirement?")) await deleteDoc(doc(db, "events", eventId, "requirements", id));
  };

  // Filters
  const filteredReqs = reqs.filter(r => {
    const searchLower = search.toLowerCase();
    const matchesSearch = !search ||
      r.item?.toLowerCase().includes(searchLower) ||
      r.department?.toLowerCase().includes(searchLower) ||
      r.requestedBy?.toLowerCase().includes(searchLower);
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    const matchesDept = deptFilter === "all" || r.department === deptFilter;
    return matchesSearch && matchesStatus && matchesDept;
  });

  const totalCost = reqs.reduce((sum, r) => sum + (r.estCost || 0), 0);
  const filteredCost = filteredReqs.reduce((sum, r) => sum + (r.estCost || 0), 0);
  const pending = reqs.filter(r => r.status === "Pending").length;
  const arranged = reqs.filter(r => r.status === "Arranged").length;
  const partial = reqs.filter(r => r.status === "Partial").length;

  // Get unique departments that raised requirements
  const uniqueReqDepts = [...new Set(reqs.filter(r => r.department).map(r => r.department))];

  // Format single requirement
  const formatReq = (r, showStatus = true) => {
    const emoji = r.status === "Arranged" ? "✅" : r.status === "Cancelled" ? "❌" : r.status === "Partial" ? "🔵" : "⏳";
    let t = `${emoji} *${r.item || "Item"}*\n`;
    if (r.department) t += `   🏛️ ${r.department}\n`;
    if (r.requestedBy) t += `   👤 By: ${r.requestedBy}\n`;
    if (r.qty) t += `   📦 Qty: ${r.qty}\n`;
    if (r.neededBy) {
      const d = new Date(r.neededBy);
      t += `   📅 Needed: ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}\n`;
    }
    if (r.estCost > 0) t += `   💰 ₹${r.estCost.toLocaleString()}\n`;
    if (showStatus) t += `   Status: ${r.status}\n`;
    return t + `\n`;
  };

  // Send pending requirements to Facilities HOD
  const sendPendingToFacilities = () => {
    const pendingReqs = reqs.filter(r => r.status === "Pending" || r.status === "Partial");
    if (pendingReqs.length === 0) return alert("No pending requirements!");

    let text = `🙏 Hare Krishna *${facilitiesHod || "Facilities Team"}*!\n\n`;
    text += `📋 *Pending Requirements to Arrange*\n`;
    text += `━━━━━━━━━━━━━━━\n`;
    text += `Total: ${pendingReqs.length} items\n`;
    text += `Est. Cost: ₹${pendingReqs.reduce((s, r) => s + (r.estCost || 0), 0).toLocaleString()}\n\n`;

    // Sort by needed by date
    pendingReqs.sort((a, b) => {
      if (!a.neededBy) return 1;
      if (!b.neededBy) return -1;
      return new Date(a.neededBy) - new Date(b.neededBy);
    });

    // Group by urgency
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const urgent = [];
    const thisWeek = [];
    const later = [];
    const noDate = [];

    pendingReqs.forEach(r => {
      if (!r.neededBy) { noDate.push(r); return; }
      const d = new Date(r.neededBy);
      d.setHours(0, 0, 0, 0);
      const days = Math.floor((d - today) / (1000 * 60 * 60 * 24));
      if (days <= 3) urgent.push(r);
      else if (days <= 7) thisWeek.push(r);
      else later.push(r);
    });

    if (urgent.length > 0) {
      text += `\n🔴 *URGENT (${urgent.length})*\n━━━━━━━━━━━━━━━\n`;
      urgent.forEach(r => text += formatReq(r, false));
    }
    if (thisWeek.length > 0) {
      text += `\n🟡 *THIS WEEK (${thisWeek.length})*\n━━━━━━━━━━━━━━━\n`;
      thisWeek.forEach(r => text += formatReq(r, false));
    }
    if (later.length > 0) {
      text += `\n🟢 *UPCOMING (${later.length})*\n━━━━━━━━━━━━━━━\n`;
      later.forEach(r => text += formatReq(r, false));
    }
    if (noDate.length > 0) {
      text += `\n⚪ *NO DATE (${noDate.length})*\n━━━━━━━━━━━━━━━\n`;
      noDate.forEach(r => text += formatReq(r, false));
    }

    text += `\nPlease update status in the app 🙏\n\n`;
    text += `_HKM Festival App_\n${window.location.origin}`;

    if (facilitiesContact) {
      sendWhatsAppTo(facilitiesContact, text);
    } else {
      alert("Facilities HOD contact not set! Add contact in Departments tab.");
      shareToWhatsApp(text);
    }
  };

  // Send one requirement to Facilities
  const sendOneToFacilities = (req) => {
    let text = `🙏 Hare Krishna *${facilitiesHod || "Facilities Team"}*!\n\n`;
    text += `📋 *New Requirement Request*\n`;
    text += `━━━━━━━━━━━━━━━\n`;
    text += formatReq(req, false);
    text += `\nPlease arrange and update status 🙏\n\n`;
    text += `_HKM Festival App_\n${window.location.origin}`;

    if (facilitiesContact) {
      sendWhatsAppTo(facilitiesContact, text);
    } else {
      alert("Facilities HOD contact not set!");
      shareToWhatsApp(text);
    }
  };

  // Share all requirements
  const shareAllToWhatsApp = () => {
    let text = `📋 *All Requirements*\n_Total: ₹${totalCost.toLocaleString()}_\n\n`;
    text += `⏳ Pending: ${pending} | ✅ Arranged: ${arranged} | 🔵 Partial: ${partial}\n\n`;
    reqs.forEach(r => text += formatReq(r));
    shareToWhatsApp(text);
  };

  // Send dept-specific report
  const sendDeptReport = (deptName) => {
    const deptReqs = reqs.filter(r => r.department === deptName);
    if (deptReqs.length === 0) return alert("No requirements for " + deptName);

    const dept = depts.find(d => d.name === deptName);
    const hodName = dept?.hod || deptName;
    const hodContact = dept?.contact;

    let text = `🙏 Hare Krishna *${hodName}*!\n\n`;
    text += `📋 *${deptName} - Requirements Status*\n`;
    text += `━━━━━━━━━━━━━━━\n`;
    text += `Total: ${deptReqs.length}\n`;
    text += `Cost: ₹${deptReqs.reduce((s, r) => s + (r.estCost || 0), 0).toLocaleString()}\n\n`;
    deptReqs.forEach(r => text += formatReq(r));
    text += `\n_HKM Festival App_`;

    if (hodContact) {
      sendWhatsAppTo(hodContact, text);
    } else {
      shareToWhatsApp(text);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sticky Header */}
      <div className="sticky top-0 bg-gray-50 z-10 pb-2 -mx-4 px-4 pt-2 border-b border-gray-100">
        <div className="flex justify-between items-center mb-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-800">📋 Requirements</h2>
            <p className="text-[10px] text-gray-500">{filteredReqs.length} of {reqs.length} · ₹{filteredCost.toLocaleString()}</p>
          </div>
          <div className="flex gap-1">
            <button onClick={shareAllToWhatsApp} className="bg-green-500 text-white p-2 rounded-lg text-xs shadow" title="Share all">💬</button>
            {canAdd && (
              <button onClick={addReq} className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white px-3 py-2 rounded-lg text-xs font-bold shadow">+ Add</button>
            )}
          </div>
        </div>

        {/* Send to Facilities Button - PROMINENT */}
        {pending > 0 && (
          <button
            onClick={sendPendingToFacilities}
            className="w-full mb-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold text-sm py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <span>📤 Send {pending} Pending to Facilities HOD</span>
            {facilitiesHod && <span className="text-xs opacity-80">({facilitiesHod})</span>}
          </button>
        )}

        {!facilitiesHod && reqs.length > 0 && (
          <div className="mb-3 bg-red-50 border border-red-200 rounded-xl p-2">
            <p className="text-xs text-red-600 font-semibold">⚠️ Assign HOD & contact for "Facilities Team" department to use auto-send feature!</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-1 mb-2">
          <div className="bg-yellow-50 rounded-lg p-2 text-center">
            <p className="text-sm font-bold text-yellow-600">{pending}</p>
            <p className="text-[9px] text-yellow-700">Pending</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-2 text-center">
            <p className="text-sm font-bold text-blue-600">{partial}</p>
            <p className="text-[9px] text-blue-700">Partial</p>
          </div>
          <div className="bg-green-50 rounded-lg p-2 text-center">
            <p className="text-sm font-bold text-green-600">{arranged}</p>
            <p className="text-[9px] text-green-700">Arranged</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-2 text-center">
            <p className="text-sm font-bold text-orange-600">₹{(totalCost/1000).toFixed(1)}K</p>
            <p className="text-[9px] text-orange-700">Total</p>
          </div>
        </div>

        {/* Search */}
        <input type="text" placeholder="🔍 Search item, dept, requester..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-300 focus:outline-none bg-white" />

        {/* Status Filter */}
        <div className="flex gap-1 mt-2 overflow-x-auto scrollbar-hide">
          {[{id:"all",label:"All",c:"bg-gray-100"},{id:"Pending",label:"⏳ Pending",c:"bg-yellow-100 text-yellow-700"},{id:"Arranged",label:"✅ Arranged",c:"bg-green-100 text-green-700"},{id:"Partial",label:"🔵 Partial",c:"bg-blue-100 text-blue-700"},{id:"Cancelled",label:"❌ Cancel",c:"bg-red-100 text-red-700"}].map(f => (
            <button key={f.id} onClick={() => setStatusFilter(f.id)}
              className={`flex-shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full ${f.c} ${statusFilter === f.id ? "ring-2 ring-orange-400" : "opacity-70"}`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Dept Filter */}
        {uniqueReqDepts.length > 0 && (
          <div className="flex gap-1 mt-1 overflow-x-auto scrollbar-hide">
            <p className="text-[10px] text-gray-400 font-bold self-center whitespace-nowrap">Dept:</p>
            <button onClick={() => setDeptFilter("all")} className={`flex-shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full ${deptFilter === "all" ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600"}`}>All</button>
            {uniqueReqDepts.map(d => (
              <button key={d} onClick={() => setDeptFilter(d)}
                className={`flex-shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full ${deptFilter === d ? "bg-orange-500 text-white" : "bg-orange-50 text-orange-700"} max-w-[120px] truncate`}>
                {d}
              </button>
            ))}
          </div>
        )}

        {/* Quick dept reports */}
        {uniqueReqDepts.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            <p className="text-[10px] text-gray-400 font-bold self-center whitespace-nowrap">Send Report:</p>
            {uniqueReqDepts.map(d => (
              <button key={d} onClick={() => sendDeptReport(d)}
                className="text-[10px] bg-green-50 text-green-700 hover:bg-green-100 px-2 py-1 rounded-full font-semibold max-w-[120px] truncate">
                💬 {d}
              </button>
            ))}
          </div>
        )}
      </div>

      {filteredReqs.length === 0 && (
        <div className="text-center text-gray-400 py-10 bg-white rounded-xl border border-dashed border-gray-200">
          {reqs.length === 0 ? "No requirements yet. Click + Add to raise one." : "No matches for your filter."}
        </div>
      )}

      {filteredReqs.map(req => (
        <div key={req.id} className={`bg-white rounded-xl shadow-sm border-l-4 border border-gray-100 p-3 ${
          req.status === "Arranged" ? "border-l-green-400" : req.status === "Pending" ? "border-l-yellow-400" : req.status === "Cancelled" ? "border-l-red-400" : "border-l-blue-400"
        }`}>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] uppercase text-gray-400 font-bold">Requested By (Dept)</label>
                <select className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-300"
                  value={req.department} onChange={(e) => updateReq(req.id, "department", e.target.value)} disabled={!canAdd}>
                  <option value="">-- Select --</option>
                  {depts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] uppercase text-gray-400 font-bold">Requested By (Person)</label>
                <input className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-300"
                  value={req.requestedBy || ""} onChange={(e) => updateReq(req.id, "requestedBy", e.target.value)} placeholder="Your name" readOnly={!canAdd} />
              </div>
            </div>

            <div>
              <label className="text-[9px] uppercase text-gray-400 font-bold">Item / Requirement *</label>
              <input className="w-full text-sm font-semibold bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-300"
                value={req.item} onChange={(e) => updateReq(req.id, "item", e.target.value)} placeholder="What is needed..." readOnly={!canAdd} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] uppercase text-gray-400 font-bold">Quantity</label>
                <input className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-300"
                  value={req.qty} onChange={(e) => updateReq(req.id, "qty", e.target.value)} placeholder="e.g. 10 kg" />
              </div>
              <div>
                <label className="text-[9px] uppercase text-gray-400 font-bold">Needed By</label>
                <input type="date" className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-300"
                  value={req.neededBy} onChange={(e) => updateReq(req.id, "neededBy", e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] uppercase text-gray-400 font-bold">Status (by Facilities)</label>
                <select className={`w-full text-xs font-semibold rounded-lg px-2 py-1.5 border-none ${STATUS_COLORS[req.status] || "bg-gray-100"}`}
                  value={req.status} onChange={(e) => updateReq(req.id, "status", e.target.value)} disabled={!canUpdateStatus}>
                  <option value="Pending">⏳ Pending</option>
                  <option value="Arranged">✅ Arranged</option>
                  <option value="Partial">🔵 Partial</option>
                  <option value="Cancelled">❌ Cancelled</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] uppercase text-gray-400 font-bold">Est. Cost (₹)</label>
                <input type="number" className="w-full text-xs font-mono font-bold text-orange-600 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-300"
                  value={req.estCost} onChange={(e) => updateReq(req.id, "estCost", Number(e.target.value))} readOnly={!canUpdateStatus} />
              </div>
            </div>

            <div className="flex justify-between items-center pt-1 flex-wrap gap-1">
              <div className="flex gap-1">
                <button
                  onClick={() => sendOneToFacilities(req)}
                  className="text-[10px] bg-purple-500 text-white px-3 py-1 rounded-lg font-bold">
                  📤 To Facilities
                </button>
                <button
                  onClick={() => shareToWhatsApp(`📋 *Requirement*\n${formatReq(req)}`)}
                  className="text-[10px] bg-green-500 text-white px-3 py-1 rounded-lg font-bold">
                  💬 Share
                </button>
              </div>
              {canAdd && (
                <button onClick={() => deleteReq(req.id)} className="text-[10px] text-red-400 hover:text-red-600">✕ Delete</button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
