import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";

const STATUS_COLORS = {
  "Not Started": "bg-gray-100 text-gray-600",
  "In Progress": "bg-blue-100 text-blue-700",
  "Done": "bg-green-100 text-green-700",
  "Blocked": "bg-red-100 text-red-600",
};

const PHASE_LABELS = {
  pre: { label: "Pre-Event", icon: "📋", color: "border-blue-400" },
  event: { label: "Event Day", icon: "🎉", color: "border-orange-400" },
  post: { label: "Post-Event", icon: "✅", color: "border-green-400" },
};

export default function Tasks({ eventId }) {
  const [tasks, setTasks] = useState([]);
  const [depts, setDepts] = useState([]);
  const { userRole } = useAuth();
  const canEdit = userRole === "admin" || userRole === "spoc" || userRole === "hod";

  useEffect(() => {
    const q = query(collection(db, "events", eventId, "tasks"), orderBy("order", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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

  // Get HOD name for a department
  const getHodForDept = (deptName) => {
    const dept = depts.find(d => d.name === deptName);
    return dept?.hod || "";
  };

  const updateTask = (id, field, value) => {
    const updates = { [field]: value };
    // If department is changed, auto-fill owner with HOD name
    if (field === "department") {
      const hod = getHodForDept(value);
      if (hod) updates.owner = hod;
    }
    updateDoc(doc(db, "events", eventId, "tasks", id), updates);
  };

  const deleteTask = async (id) => {
    if (confirm("Delete this task?")) {
      await deleteDoc(doc(db, "events", eventId, "tasks", id));
    }
  };

  const addTask = async (phase) => {
    if (!canEdit) return alert("No permission");
    await addDoc(collection(db, "events", eventId, "tasks"), {
      title: "New Task",
      phase,
      department: "",
      owner: "",
      deadline: "",
      status: "Not Started",
      order: tasks.length + 1,
    });
  };

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.status === "Done").length;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-800">✅ Master Task Tracker</h2>
        <p className="text-xs text-gray-500 mt-0.5">Pre-event, event day, and post-event tasks. Update status as you go.</p>
        <div className="mt-3 bg-gray-100 rounded-full h-4 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-green-500 rounded-full transition-all duration-500 flex items-center justify-center"
            style={{ width: progress + "%" }}
          >
            {progress > 10 && <span className="text-[10px] text-white font-bold">{progress}%</span>}
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-1">{progress}% done ({doneTasks}/{totalTasks})</p>
      </div>

      {/* Tasks by Phase */}
      {["pre", "event", "post"].map(phase => {
        const phaseTasks = tasks.filter(t => t.phase === phase);
        const phaseInfo = PHASE_LABELS[phase];
        const phaseDone = phaseTasks.filter(t => t.status === "Done").length;

        return (
          <div key={phase} className="space-y-2">
            <div className="flex justify-between items-center bg-gray-50 rounded-xl px-4 py-2">
              <h3 className="text-sm font-bold text-gray-700">
                {phaseInfo.icon} {phaseInfo.label}
                <span className="text-xs text-gray-400 font-normal ml-2">({phaseDone}/{phaseTasks.length})</span>
              </h3>
              {canEdit && (
                <button
                  onClick={() => addTask(phase)}
                  className="text-[11px] bg-orange-100 text-orange-600 hover:bg-orange-200 font-bold px-3 py-1 rounded-lg transition-all"
                >
                  + Add Task
                </button>
              )}
            </div>

            {phaseTasks.map(task => {
              const autoOwner = task.department ? getHodForDept(task.department) : "";
              const displayOwner = task.owner || autoOwner;

              return (
                <div key={task.id} className={`bg-white rounded-xl border-l-4 ${phaseInfo.color} border border-gray-100 shadow-sm p-3 hover:shadow-md transition-all`}>
                  {/* Mobile Layout */}
                  <div className="block md:hidden space-y-2">
                    <input
                      className="w-full text-sm font-semibold bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-gray-800"
                      value={task.title}
                      onChange={(e) => updateTask(task.id, "title", e.target.value)}
                      readOnly={!canEdit}
                    />
                    <div className="flex flex-wrap gap-2">
                      <select
                        className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-300 flex-1 min-w-[120px]"
                        value={task.department}
                        onChange={(e) => updateTask(task.id, "department", e.target.value)}
                        disabled={!canEdit}
                      >
                        <option value="">-- Dept --</option>
                        {depts.map(d => (
                          <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                      </select>
                      <select
                        className={`text-xs font-semibold rounded-lg px-2 py-1.5 border-none focus:outline-none flex-1 min-w-[100px] ${STATUS_COLORS[task.status] || "bg-gray-100"}`}
                        value={task.status}
                        onChange={(e) => updateTask(task.id, "status", e.target.value)}
                      >
                        <option value="Not Started">Not Started</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Done">Done</option>
                        <option value="Blocked">Blocked</option>
                      </select>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      {displayOwner && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                          👤 {displayOwner}
                        </span>
                      )}
                      {!displayOwner && (
                        <input
                          className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 flex-1"
                          value={task.owner}
                          onChange={(e) => updateTask(task.id, "owner", e.target.value)}
                          placeholder="Assign owner..."
                          readOnly={!canEdit}
                        />
                      )}
                      <input
                        type="date"
                        className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5"
                        value={task.deadline}
                        onChange={(e) => updateTask(task.id, "deadline", e.target.value)}
                        readOnly={!canEdit}
                      />
                      {canEdit && (
                        <button onClick={() => deleteTask(task.id)} className="text-red-300 hover:text-red-500 text-sm">✕</button>
                      )}
                    </div>
                  </div>

                  {/* Desktop Layout */}
                  <div className="hidden md:grid md:grid-cols-12 gap-2 items-center">
                    <div className="col-span-4">
                      <input
                        className="w-full text-sm font-medium bg-transparent border-none p-0 focus:ring-0 focus:outline-none"
                        value={task.title}
                        onChange={(e) => updateTask(task.id, "title", e.target.value)}
                        readOnly={!canEdit}
                      />
                    </div>
                    <div className="col-span-2">
                      <select
                        className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-300"
                        value={task.department}
                        onChange={(e) => updateTask(task.id, "department", e.target.value)}
                        disabled={!canEdit}
                      >
                        <option value="">-- Dept --</option>
                        {depts.map(d => (
                          <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      {displayOwner ? (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium inline-block">
                          👤 {displayOwner}
                        </span>
                      ) : (
                        <input
                          className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-300"
                          value={task.owner}
                          onChange={(e) => updateTask(task.id, "owner", e.target.value)}
                          placeholder="Owner"
                          readOnly={!canEdit}
                        />
                      )}
                    </div>
                    <div className="col-span-2">
                      <input
                        type="date"
                        className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg px-1 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-300"
                        value={task.deadline}
                        onChange={(e) => updateTask(task.id, "deadline", e.target.value)}
                        readOnly={!canEdit}
                      />
                    </div>
                    <div className="col-span-1">
                      <select
                        className={`w-full text-xs font-semibold rounded-lg px-2 py-1.5 border-none focus:outline-none focus:ring-1 focus:ring-orange-300 ${STATUS_COLORS[task.status] || "bg-gray-100"}`}
                        value={task.status}
                        onChange={(e) => updateTask(task.id, "status", e.target.value)}
                      >
                        <option value="Not Started">Not Started</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Done">Done</option>
                        <option value="Blocked">Blocked</option>
                      </select>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      {canEdit && (
                        <button onClick={() => deleteTask(task.id)} className="text-red-300 hover:text-red-500 text-sm transition-all">✕</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
