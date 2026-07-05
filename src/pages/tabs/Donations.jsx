import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";

export default function Donations({ eventId }) {
  const [donors, setDonors] = useState([]);
  const [depts, setDepts] = useState([]);
  const [reqs, setReqs] = useState([]);
  const { userRole } = useAuth();
  const canEdit = userRole === "admin" || userRole === "spoc";

  useEffect(() => {
    const unsub1 = onSnapshot(query(collection(db, "events", eventId, "donors"), orderBy("createdAt", "desc")), (snap) => {
      setDonors(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsub2 = onSnapshot(query(collection(db, "events", eventId, "departments"), orderBy("order", "asc")), (snap) => {
      setDepts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsub3 = onSnapshot(collection(db, "events", eventId, "requirements"), (snap) => {
      setReqs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [eventId]);

  const addDonor = async () => {
    if (!canEdit) return alert("No permission");
    await addDoc(collection(db, "events", eventId, "donors"), {
      name: "", amount: 0, purpose: "", received: false, createdAt: new Date(),
    });
  };

  const updateDonor = (id, field, value) => {
    updateDoc(doc(db, "events", eventId, "donors", id), { [field]: value });
  };

  const deleteDonor = async (id) => {
    if (confirm("Delete?")) await deleteDoc(doc(db, "events", eventId, "donors", id));
  };

  const deptBudget = depts.reduce((s, d) => s + (d.budget || 0), 0);
  const reqCost = reqs.reduce((s, r) => s + (r.estCost || 0), 0);
  const totalBudget = deptBudget + reqCost;
  const totalDonations = donors.reduce((s, d) => s + (d.amount || 0), 0);
  const receivedDonations = donors.filter(d => d.received).reduce((s, d) => s + (d.amount || 0), 0);
  const surplus = totalDonations - totalBudget;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800">💰 Budget vs Donations</h2>
        <p className="text-xs text-gray-500">Budget from Departments tab. Track donors here.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
          <p className="text-[10px] uppercase text-gray-400 font-bold">Dept Budget</p>
          <p className="text-lg font-bold text-gray-800">₹{deptBudget.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
          <p className="text-[10px] uppercase text-gray-400 font-bold">Facility Requests</p>
          <p className="text-lg font-bold text-gray-800">₹{reqCost.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-yellow-500 rounded-2xl p-4 shadow-md text-center text-white">
          <p className="text-[10px] uppercase font-bold opacity-80">Total Required</p>
          <p className="text-lg font-bold">₹{totalBudget.toLocaleString()}</p>
        </div>
        <div className={`rounded-2xl p-4 shadow-md text-center text-white ${surplus >= 0 ? "bg-gradient-to-br from-green-500 to-green-600" : "bg-gradient-to-br from-red-500 to-red-600"}`}>
          <p className="text-[10px] uppercase font-bold opacity-80">{surplus >= 0 ? "Surplus" : "Deficit"}</p>
          <p className="text-lg font-bold">₹{Math.abs(surplus).toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
        <div className="flex justify-center gap-8">
          <div>
            <p className="text-[10px] uppercase text-gray-400 font-bold">Total Pledged</p>
            <p className="text-2xl font-bold text-orange-600">₹{totalDonations.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-gray-400 font-bold">Received</p>
            <p className="text-2xl font-bold text-green-600">₹{receivedDonations.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Donor List */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-gray-700">🤲 Donor List</h3>
        {canEdit && (
          <button onClick={addDonor} className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md">
            + Add Donor
          </button>
        )}
      </div>

      {donors.length === 0 && (
        <div className="text-center text-gray-400 py-10 bg-white rounded-xl border border-dashed border-gray-200">
          No donors yet. Add donors to track contributions.
        </div>
      )}

      {donors.map(donor => (
        <div key={donor.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
            <div>
              <label className="text-[10px] uppercase text-gray-400 font-bold">Donor Name</label>
              <input
                className="w-full text-sm font-semibold bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-300"
                value={donor.name}
                onChange={(e) => updateDonor(donor.id, "name", e.target.value)}
                placeholder="Donor name..."
                readOnly={!canEdit}
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-gray-400 font-bold">Amount (₹)</label>
              <input
                type="number"
                className="w-full text-sm font-mono font-bold text-orange-600 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-300"
                value={donor.amount}
                onChange={(e) => updateDonor(donor.id, "amount", Number(e.target.value))}
                readOnly={!canEdit}
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-gray-400 font-bold">Purpose</label>
              <input
                className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-300"
                value={donor.purpose}
                onChange={(e) => updateDonor(donor.id, "purpose", e.target.value)}
                placeholder="For..."
                readOnly={!canEdit}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={donor.received}
                onChange={(e) => updateDonor(donor.id, "received", e.target.checked)}
                className="accent-green-500 w-5 h-5"
                disabled={!canEdit}
              />
              <span className={`text-xs font-bold ${donor.received ? "text-green-600" : "text-yellow-600"}`}>
                {donor.received ? "✅ Received" : "⏳ Pledged"}
              </span>
            </div>
            {canEdit && (
              <div className="flex justify-end">
                <button onClick={() => deleteDonor(donor.id)} className="text-xs text-red-400 hover:text-red-600">✕ Delete</button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
