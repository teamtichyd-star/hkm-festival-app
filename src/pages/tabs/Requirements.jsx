import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";

const STATUS_COLORS = {
  Pending: "bg-yellow-100 text-yellow-700",
  Arranged: "bg-green-100 text-green-700",
  Partial: "bg-blue-100 text-blue-700",
  Cancelled: "bg-red-100 text-red-600",
};

export default function Requirements({ eventId }) {
  const [reqs, setReqs] = useState([]);
  const [depts, setDepts] = useState([]);
  const { userRole } = useAuth();
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

  const addReq = async () => {
    if (!canAdd) return alert("No permission");
    await addDoc(collection(db, "events", eventId, "requirements"), {
      department: "",
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
    if (confirm("Delete this requirement?")) {
      await deleteDoc(doc(db, "events", eventId, "requirements", id));
    }
  };

  const totalCost = reqs.reduce((sum, r) => sum + (r.estCost || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-800">📋 Requirements to Facilities Team</h2>
          <p className="text-xs text-gray-500 mt-0.5">Each HOD logs what they need. Facilities Team fills Status and Est. Cost.</p>
          <p className="text-xs text-orange-600 font-bold mt-1">Total Estimated Cost: ₹{totalCost.toLocaleString()}</p>
        </div>
        {canAdd && (
          <button onClick={addReq} className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md">
            + Add Requirement
          </button>
        )}
      </div>

      {reqs.length === 0 && (
        <div className="text-center text-gray-400 py-10 bg-white rounded-xl border border-dashed border-gray-200">
          No requirements yet. HODs can add requirements here.
        </div>
      )}

      {reqs.map(req => (
        <div key={req.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-start">
            <div>
              <label className="text-[10px] uppercase text-gray-400 font-bold">Requested By (Dept)</label>
              <select
                className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-300"
                value={req.department}
                onChange={(e) => updateReq(req.id, "department", e.target.value)}
                disabled={!canAdd}
              >
                <option value="">-- Select --</option>
                {depts.map(d => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] uppercase text-gray-400 font-bold">Item / Requirement</label>
              <input
                className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-300"
                value={req.item}
                onChange={(e) => updateReq(req.id, "item", e.target.value)}
                placeholder="What is needed..."
                readOnly={!canAdd}
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-gray-400 font-bold">Qty</label>
              <input
                className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-300"
                value={req.qty}
                onChange={(e) => updateReq(req.id, "qty", e.target.value)}
                placeholder="Qty"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-gray-400 font-bold">Needed By</label>
              <input
                type="date"
                className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-300"
                value={req.neededBy}
                onChange={(e) => updateReq(req.id, "neededBy", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <div>
                <label className="text-[10px] uppercase text-gray-400 font-bold">Status</label>
                <select
                  className={`w-full text-xs font-semibold rounded-lg px-2 py-1.5 border-none ${STATUS_COLORS[req.status] || "bg-gray-100"}`}
                  value={req.status}
                  onChange={(e) => updateReq(req.id, "status", e.target.value)}
                  disabled={!canUpdateStatus}
                >
                  <option value="Pending">Pending</option>
                  <option value="Arranged">Arranged</option>
                  <option value="Partial">Partial</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase text-gray-400 font-bold">Est. Cost (₹)</label>
                <input
                  type="number"
                  className="w-full text-sm font-mono font-bold text-orange-600 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-300"
                  value={req.estCost}
                  onChange={(e) => updateReq(req.id, "estCost", Number(e.target.value))}
                  readOnly={!canUpdateStatus}
                />
              </div>
              {canAdd && (
                <button onClick={() => deleteReq(req.id)} className="text-xs text-red-400 hover:text-red-600">✕ Delete</button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
