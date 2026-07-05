import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";

export default function Departments({ eventId }) {
  const [depts, setDepts] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
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
      name: "New Department",
      hod: "",
      contact: "",
      team: "",
      responsibility: "",
      budget: 0,
      order: depts.length + 1,
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-800">🏛️ Seva Departments</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {depts.length} departments · Total Budget: ₹{totalBudget.toLocaleString()}
          </p>
        </div>
        {canEdit && (
          <button onClick={addDept} className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all">
            + Add Department
          </button>
        )}
      </div>

      {/* Department Cards */}
      {depts.map((dept, index) => (
        <div
          key={dept.id}
          className={`bg-white rounded-2xl shadow-sm border-l-4 ${
            dept.hod ? "border-l-green-400" : "border-l-red-300"
          } border border-gray-100 hover:shadow-md transition-all duration-200 overflow-hidden`}
        >
          {/* Card Header - Always Visible */}
          <div
            className="p-4 cursor-pointer"
            onClick={() => setExpandedId(expandedId === dept.id ? null : dept.id)}
          >
            <div className="flex justify-between items-start">
              <div className="flex items-start gap-3">
                <span className="text-lg bg-orange-100 text-orange-600 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-bold text-gray-800">{dept.name}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {dept.hod ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        👤 {dept.hod}
                      </span>
                    ) : (
                      <span className="text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-full font-medium animate-pulse">
                        ⚠️ HOD Needed
                      </span>
                    )}
                    {dept.budget > 0 && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-mono font-bold">
                        ₹{dept.budget.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <span className={`text-gray-400 transition-transform duration-200 ${expandedId === dept.id ? "rotate-180" : ""}`}>
                ▼
              </span>
            </div>
          </div>

          {/* Expanded Content */}
          {expandedId === dept.id && (
            <div className="border-t border-gray-100 bg-gray-50/50 p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Department Name</label>
                  <input
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-orange-300 focus:outline-none"
                    value={dept.name}
                    onChange={(e) => updateDept(dept.id, "name", e.target.value)}
                    readOnly={!canEdit}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">HOD Name</label>
                  <input
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:outline-none"
                    value={dept.hod}
                    onChange={(e) => updateDept(dept.id, "hod", e.target.value)}
                    readOnly={!canEdit}
                    placeholder="Assign HOD..."
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Contact No.</label>
                  <input
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:outline-none"
                    value={dept.contact}
                    onChange={(e) => updateDept(dept.id, "contact", e.target.value)}
                    readOnly={!canEdit}
                    placeholder="Phone number..."
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Budget Required (₹)</label>
                  <input
                    type="number"
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono font-bold text-orange-600 focus:ring-2 focus:ring-orange-300 focus:outline-none"
                    value={dept.budget}
                    onChange={(e) => updateDept(dept.id, "budget", Number(e.target.value))}
                    readOnly={!canEdit}
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Team Members</label>
                <div className="mt-1">
                  <input
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:outline-none"
                    value={dept.team}
                    onChange={(e) => updateDept(dept.id, "team", e.target.value)}
                    readOnly={!canEdit}
                    placeholder="Comma separated names..."
                  />
                  {dept.team && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {dept.team.split(",").map((m, i) => (
                        <span key={i} className="text-xs bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full font-medium">
                          {m.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Key Responsibility</label>
                <textarea
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:outline-none"
                  rows="2"
                  value={dept.responsibility}
                  onChange={(e) => updateDept(dept.id, "responsibility", e.target.value)}
                  readOnly={!canEdit}
                  placeholder="Key responsibilities..."
                />
              </div>
              {canEdit && (
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => deleteDept(dept.id)}
                    className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all"
                  >
                    🗑️ Delete Department
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
