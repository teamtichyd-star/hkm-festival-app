import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { doc, onSnapshot, setDoc, collection, query, orderBy, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";

export default function Crowd({ eventId, event }) {
  const [crowd, setCrowd] = useState({ regularDevotees: 300, footfallPerKm: 800, routeKm: 3 });
  const [checkpoints, setCheckpoints] = useState([]);
  const { userRole } = useAuth();
  const canEdit = userRole === "admin" || userRole === "spoc";

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "events", eventId, "crowd", "config"), (snap) => {
      if (snap.exists()) setCrowd(snap.data());
    });
    return () => unsub;
  }, [eventId]);

  useEffect(() => {
    const q = query(collection(db, "events", eventId, "checkpoints"), orderBy("order", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setCheckpoints(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [eventId]);

  const updateCrowd = (field, value) => {
    const updated = { ...crowd, [field]: Number(value) };
    setCrowd(updated);
    setDoc(doc(db, "events", eventId, "crowd", "config"), updated);
  };

  const updateCheckpoint = (id, field, value) => {
    updateDoc(doc(db, "events", eventId, "checkpoints", id), { [field]: value });
  };

  const addCheckpoint = async () => {
    await addDoc(collection(db, "events", eventId, "checkpoints"), {
      km: "", landmark: "", waterPoint: false, medical: false, volunteer: "", order: checkpoints.length + 1,
    });
  };

  const deleteCheckpoint = async (id) => {
    if (confirm("Delete?")) await deleteDoc(doc(db, "events", eventId, "checkpoints", id));
  };

  const estimatedCrowd = crowd.regularDevotees + (crowd.footfallPerKm * crowd.routeKm);

  return (
    <div className="space-y-6">
      {/* Crowd Estimation */}
      <div>
        <h2 className="text-xl font-bold text-gray-800">👥 Crowd Estimation</h2>
        <p className="text-xs text-gray-500">Rough sizing to plan prasadam, water, and security.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] uppercase text-gray-400 font-bold">Regular devotee base</label>
            <input
              type="number"
              className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300"
              value={crowd.regularDevotees}
              onChange={(e) => updateCrowd("regularDevotees", e.target.value)}
              placeholder="e.g. 300"
              readOnly={!canEdit}
            />
          </div>
          <div>
            <label className="text-[10px] uppercase text-gray-400 font-bold">Footfall per km (public route)</label>
            <input
              type="number"
              className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300"
              value={crowd.footfallPerKm}
              onChange={(e) => updateCrowd("footfallPerKm", e.target.value)}
              placeholder="e.g. 800"
              readOnly={!canEdit}
            />
          </div>
          <div>
            <label className="text-[10px] uppercase text-gray-400 font-bold">Route length (km)</label>
            <input
              type="number"
              className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300"
              value={crowd.routeKm}
              onChange={(e) => updateCrowd("routeKm", e.target.value)}
              placeholder="e.g. 3"
              readOnly={!canEdit}
            />
          </div>
        </div>
        <div className="mt-4 bg-gradient-to-r from-orange-100 to-yellow-100 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500">Estimated total crowd</p>
          <p className="text-3xl font-bold text-orange-600">{estimatedCrowd.toLocaleString()}</p>
        </div>
      </div>

      {/* Route Checkpoints */}
      <div>
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-800">🗺️ Route Checkpoints</h2>
            <p className="text-xs text-gray-500">One every ~500m along the route.</p>
          </div>
          {canEdit && (
            <button onClick={addCheckpoint} className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md">
              + Add Checkpoint
            </button>
          )}
        </div>
      </div>

      {checkpoints.map((cp, i) => (
        <div key={cp.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-center">
            <div>
              <label className="text-[10px] uppercase text-gray-400 font-bold">KM</label>
              <input
                className="w-full text-sm font-bold bg-orange-50 border border-orange-200 rounded-lg px-2 py-1.5 text-center"
                value={cp.km}
                onChange={(e) => updateCheckpoint(cp.id, "km", e.target.value)}
                readOnly={!canEdit}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] uppercase text-gray-400 font-bold">Landmark</label>
              <input
                className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5"
                value={cp.landmark}
                onChange={(e) => updateCheckpoint(cp.id, "landmark", e.target.value)}
                placeholder="Landmark name..."
                readOnly={!canEdit}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={cp.waterPoint}
                onChange={(e) => updateCheckpoint(cp.id, "waterPoint", e.target.checked)}
                className="accent-blue-500"
                disabled={!canEdit}
              />
              <span className="text-xs">💧 Water</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={cp.medical}
                onChange={(e) => updateCheckpoint(cp.id, "medical", e.target.checked)}
                className="accent-red-500"
                disabled={!canEdit}
              />
              <span className="text-xs">🏥 Medical</span>
            </div>
            <div className="flex items-center gap-1">
              <input
                className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5"
                value={cp.volunteer}
                onChange={(e) => updateCheckpoint(cp.id, "volunteer", e.target.value)}
                placeholder="Volunteer"
                readOnly={!canEdit}
              />
              {canEdit && (
                <button onClick={() => deleteCheckpoint(cp.id)} className="text-red-300 hover:text-red-500 text-sm">✕</button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
