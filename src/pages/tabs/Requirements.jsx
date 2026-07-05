import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import { shareToWhatsApp } from "../../utils/whatsapp";

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

  // Get current user's assigned department
  const getMyDepartment = () => {
    if (userRole === "hod" && userDept) {
      const myDept = depts.find(d => d.id === userDept);
      return myDept?.name || "";
    }
    // If HOD name matches user name in any department
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
      department: myDept, // Auto-fill with HOD's department
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

  // Filter
  const filteredReqs = reqs.filter(r => {
    const searchLower = search.toLowerCase();
    const matchesSearch = !search ||
      r.item?.toLowerCase().includes(searchLower) ||
      r.department?.toLowerCase().includes(searchLower) ||
      r.requestedBy?.toLowerCase().includes(searchLower);
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalCost = reqs.reduce((sum, r) => sum + (r.estCost || 0), 0);
  const filteredCost = filteredReqs.reduce((sum, r) => sum + (r.estCost || 0), 0);
  const pending = reqs.filter(r => r.status === "Pending").length;
  const arranged = reqs.filter(r => r.status === "Arranged").length;

  const shareAllToWhatsApp = () => {
    let text = `📋 *Requirements List*\n_Total: ₹${totalCost.toLocaleString()}_\n\n`;
    reqs.forEach((r, i) => {
      const emoji = r.status === "Arranged" ? "✅" : r.status === "Cancelled" ? "❌" : r.status === "Partial" ? "🔵" : "⏳";
      text += `${emoji} *${r.item || "Item"}*\n`;
      text += `   Dept: ${r.department || "-"}\n`;
      if (r.qty) text += `   Qty: ${r.qty}\n`;
      if (r.neededBy) text += `   By: ${r.neededBy}\n`;
      if (r.estCost > 0) text += `   ₹${r.estCost.toLocaleString()}\n`;
      text += `\n`;
    });
    shareToWhatsApp(text);
  };

  return (
    <div className="space-y-4">
      {/* Sticky Header */}
      <div className="sticky top-0 bg-gray-50 z-10 pb-2 -mx-4 px-4 pt-2 border-b border-gray-100">
        <div className="flex justify-between items-center mb-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-800">📋 Requirements</h2>
            <p className="text-[10px] text-gray-500">{filteredReqs.length} of {reqs.length} · ₹{filteredCost.toLocaleString()} shown</p>
          </div>
          <div className="flex gap-1">
            <button onClick={shareAllToWhatsApp} className="bg-green-500 text-white p-2 rounded-lg text-xs shadow" title="Share to WhatsApp">💬</button>
            {canAdd && (
              <button onClick={addReq} className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white px-3 py-2 rounded-lg text-xs font-bold shadow">+ Add</button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-1 mb-2">
          <div className="bg-yellow-50 rounded-lg p-2 text-center">
            <p className="text-sm font-bold text-yellow-600">{pending}</p>
            <p className="text-[9px] text-yellow-700">Pending</p>
          </div>
          <div className="bg-green-50 rounded-lg p-2 text-center">
            <p className="text-sm font-bold text-green-600">{arranged}</p>
            <p className="text-[9px] text-green-700">Arranged</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-2 text-center col-span-2">
            <p className="text-sm font-bold text-blue-600">₹{totalCost.toLocaleString()}</p>
            <p className="text-[9px] text-blue-700">Total Est. Cost</p>
          </div>
        </div>

        {/* Search */}
        <input type="text" placeholder="🔍 Search item, dept, requester..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-300 focus:outline-none bg-white" />

        {/* Filter */}
        <div className="flex gap-1 mt-2 overflow-x-auto scrollbar-hide">
          {[{id:"all",label:"All",c:"bg-gray-100"},{id:"Pending",label:"⏳ Pending",c:"bg-yellow-100 text-yellow-700"},{id:"Arranged",label:"✅ Arranged",c:"bg-green-100 text-green-700"},{id:"Partial",label:"🔵 Partial",c:"bg-blue-100 text-blue-700"},{id:"Cancelled",label:"❌ Cancel",c:"bg-red-100 text-red-700"}].map(f => (
            <button key={f.id} onClick={() => setStatusFilter(f.id)}
              className={`flex-shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full ${f.c} ${statusFilter === f.id ? "ring-2 ring-orange-400" : "opacity-70"}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filteredReqs.length === 0 && (
        <div className="text-center text-gray-400 py-10 bg-white rounded-xl border border-dashed border-gray-200">
          {reqs.length === 0 ? "No requirements yet. Click + Add to raise one." : "No matches for your search/filter."}
        </div>
      )}

      {filteredReqs.map(req => (
        <div key={req.id} className={`bg-white rounded-xl shadow-sm border-l-4 border border-gray-100 p-3 ${
          req.status === "Arranged" ? "border-l-green-400" : req.status === "Pending" ? "border-l-yellow-400" : req.status === "Cancelled" ? "border-l-red-400" : "border-l-blue-400"
        }`}>
          <div className="space-y-2">
            {/* Requested By + Dept */}
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

            {/* Item */}
            <div>
              <label className="text-[9px] uppercase text-gray-400 font-bold">Item / Requirement *</label>
              <input className="w-full text-sm font-semibold bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-300"
                value={req.item} onChange={(e) => updateReq(req.id, "item", e.target.value)} placeholder="What is needed..." readOnly={!canAdd} />
            </div>

            {/* Qty + Date */}
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

            {/* Status + Cost */}
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

            {/* Actions */}
            <div className="flex justify-between items-center pt-1">
              <button
                onClick={() => shareToWhatsApp(`📋 *Requirement*\n${req.item}\nDept: ${req.department}\nQty: ${req.qty}\nBy: ${req.neededBy}\nStatus: ${req.status}${req.estCost > 0 ? "\n₹" + req.estCost.toLocaleString() : ""}`)}
                className="text-[10px] bg-green-500 text-white px-3 py-1 rounded-lg font-bold">💬 Share</button>
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
