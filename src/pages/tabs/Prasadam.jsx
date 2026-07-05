import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";

export default function Prasadam({ eventId }) {
  const [items, setItems] = useState([]);
  const [crowd, setCrowd] = useState({ regularDevotees: 300, footfallPerKm: 800, routeKm: 3 });
  const { userRole } = useAuth();
  const canEdit = true;

  useEffect(() => {
    const q = query(collection(db, "events", eventId, "prasadam"), orderBy("order", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [eventId]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "events", eventId, "crowd", "config"), (snap) => {
      if (snap.exists()) setCrowd(snap.data());
    });
    return () => unsub;
  }, [eventId]);

  const estimatedCrowd = crowd.regularDevotees + (crowd.footfallPerKm * crowd.routeKm);

  const updateItem = (id, field, value) => {
    updateDoc(doc(db, "events", eventId, "prasadam", id), { [field]: value });
  };

  const addItem = async () => {
    await addDoc(collection(db, "events", eventId, "prasadam"), {
      name: "New Item", qtyPerPerson: 1, vendor: "", order: items.length + 1,
    });
  };

  const deleteItem = async (id) => {
    if (confirm("Delete?")) await deleteDoc(doc(db, "events", eventId, "prasadam", id));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-800">🍛 Prasadam Planning</h2>
          <p className="text-xs text-gray-500">Per-person qty; total auto-calculates from estimated crowd.</p>
          <p className="text-xs text-orange-600 font-bold mt-1">Estimated Crowd: {estimatedCrowd.toLocaleString()}</p>
        </div>
        {canEdit && (
          <button onClick={addItem} className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md">
            + Add Item
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-5 gap-2 p-3 bg-gray-50 text-[10px] uppercase font-bold text-gray-500">
          <span>Item</span>
          <span>Qty/Person</span>
          <span>Est. Crowd</span>
          <span>Total Needed</span>
          <span>Vendor/Cook</span>
        </div>
        {items.map(item => (
          <div key={item.id} className="grid grid-cols-5 gap-2 p-3 border-t border-gray-50 items-center hover:bg-orange-50/30">
            <input
              className="text-sm font-medium bg-transparent border-none p-0 focus:ring-0 focus:outline-none"
              value={item.name}
              onChange={(e) => updateItem(item.id, "name", e.target.value)}
              readOnly={!canEdit}
            />
            <input
              type="number"
              step="0.1"
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 w-20"
              value={item.qtyPerPerson}
              onChange={(e) => updateItem(item.id, "qtyPerPerson", Number(e.target.value))}
              readOnly={!canEdit}
            />
            <span className="text-sm text-gray-500">{estimatedCrowd.toLocaleString()}</span>
            <span className="text-sm font-bold text-orange-600">
              {Math.ceil(item.qtyPerPerson * estimatedCrowd).toLocaleString()}
            </span>
            <div className="flex items-center gap-1">
              <input
                className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 flex-grow"
                value={item.vendor}
                onChange={(e) => updateItem(item.id, "vendor", e.target.value)}
                placeholder="Vendor/Cook"
                readOnly={!canEdit}
              />
              {canEdit && (
                <button onClick={() => deleteItem(item.id)} className="text-red-300 hover:text-red-500 text-sm">✕</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
