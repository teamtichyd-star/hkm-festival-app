import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import { shareToWhatsApp, sendWhatsAppTo } from "../../utils/whatsapp";

const STATUS_COLORS = {
  "Not Started": "bg-gray-100 text-gray-600",
  "In Progress": "bg-blue-100 text-blue-700",
  "Done": "bg-green-100 text-green-700",
  "Blocked": "bg-red-100 text-red-600",
};

const PHASE_LABELS = {
  pre: { label: "Pre-Event", color: "border-blue-400", bgColor: "bg-blue-100 text-blue-700" },
  event: { label: "Event Day", color: "border-orange-400", bgColor: "bg-orange-100 text-orange-700" },
  post: { label: "Post-Event", color: "border-green-400", bgColor: "bg-green-100 text-green-700" },
};

export default function Tasks({ eventId }) {
  const [tasks, setTasks] = useState([]);
  const [depts, setDepts] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [hodFilter, setHodFilter] = useState("all");
  const [collapsedPhases, setCollapsedPhases] = useState({});
  const [showHodReport, setShowHodReport] = useState(false);
  const canEdit = true;

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

  const getHodForDept = (deptName) => depts.find(d => d.name === deptName)?.hod || "";

  const updateTask = (id, field, value) => {
    const updates = { [field]: value };
    if (field === "department") {
      const hod = getHodForDept(value);
      if (hod) updates.owner = hod;
    }
    updateDoc(doc(db, "events", eventId, "tasks", id), updates);
  };

  const deleteTask = async (id) => {
    if (confirm("Delete this task?")) await deleteDoc(doc(db, "events", eventId, "tasks", id));
  };

  const addTask = async (phase) => {
    await addDoc(collection(db, "events", eventId, "tasks"), {
      title: "New Task", phase, department: "", owner: "", deadline: "", status: "Not Started", order: tasks.length + 1,
    });
  };

  const uniqueHODs = [...new Set(depts.filter(d => d.hod).map(d => d.hod))];

  const filteredTasks = tasks.filter(t => {
    const searchLower = search.toLowerCase();
    const matchesSearch = !search || t.title?.toLowerCase().includes(searchLower) || t.department?.toLowerCase().includes(searchLower) || t.owner?.toLowerCase().includes(searchLower);
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    const matchesPhase = phaseFilter === "all" || t.phase === phaseFilter;
    const owner = t.owner || getHodForDept(t.department);
    const matchesHod = hodFilter === "all" || owner === hodFilter;
    return matchesSearch && matchesStatus && matchesPhase && matchesHod;
  });

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.status === "Done").length;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const togglePhase = (phase) => setCollapsedPhases(prev => ({ ...prev, [phase]: !prev[phase] }));

  // CLEAN HOD Report
  const generateHodReport = (hodName) => {
    const hodTasks = tasks.filter(t => (t.owner || getHodForDept(t.department)) === hodName);
    if (hodTasks.length === 0) return null;

    const notStarted = hodTasks.filter(t => t.status === "Not Started");
    const inProgress = hodTasks.filter(t => t.status === "In Progress");
    const blocked = hodTasks.filter(t => t.status === "Blocked");
    const done = hodTasks.filter(t => t.status === "Done");

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdue = [], dueSoon = [], upcoming = [], noDate = [];

    [...notStarted, ...inProgress, ...blocked].forEach(t => {
      if (!t.deadline) { noDate.push(t); return; }
      const d = new Date(t.deadline);
      d.setHours(0, 0, 0, 0);
      const days = Math.floor((d - today) / (1000 * 60 * 60 * 24));
      if (days < 0) overdue.push({...t, daysDiff: days});
      else if (days <= 7) dueSoon.push({...t, daysDiff: days});
      else upcoming.push({...t, daysDiff: days});
    });

    overdue.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    dueSoon.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    let text = `Hare Krishna *${hodName}*!\n`;
    text += `━━━━━━━━━━━━━━━━\n\n`;
    text += `*YOUR TASK SUMMARY*\n\n`;
    text += `Total Tasks: ${hodTasks.length}\n`;
    text += `Done: ${done.length}\n`;
    text += `In Progress: ${inProgress.length}\n`;
    text += `Not Started: ${notStarted.length}\n`;
    if (blocked.length > 0) text += `Blocked: ${blocked.length}\n`;
    text += `\nPending: ${notStarted.length + inProgress.length + blocked.length}\n`;

    const formatTask = (t) => {
      let s = `*${t.title}*\n`;
      s += `   Phase: ${PHASE_LABELS[t.phase]?.label || t.phase}\n`;
      if (t.department) s += `   Dept: ${t.department}\n`;
      s += `   Status: ${t.status}\n`;
      if (t.deadline) {
        const d = new Date(t.deadline);
        const formatted = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        s += `   Due: ${formatted}`;
        if (t.daysDiff !== undefined) {
          if (t.daysDiff < 0) s += ` (${Math.abs(t.daysDiff)} days OVERDUE)`;
          else if (t.daysDiff === 0) s += ` (TODAY)`;
          else if (t.daysDiff === 1) s += ` (tomorrow)`;
          else s += ` (in ${t.daysDiff} days)`;
        }
        s += `\n`;
      }
      return s + `\n`;
    };

    if (overdue.length > 0) {
      text += `\n*OVERDUE TASKS (${overdue.length})*\n━━━━━━━━━━━━━━━━\n`;
      overdue.forEach(t => text += formatTask(t));
    }
    if (dueSoon.length > 0) {
      text += `\n*DUE THIS WEEK (${dueSoon.length})*\n━━━━━━━━━━━━━━━━\n`;
      dueSoon.forEach(t => text += formatTask(t));
    }
    if (upcoming.length > 0) {
      text += `\n*UPCOMING (${upcoming.length})*\n━━━━━━━━━━━━━━━━\n`;
      upcoming.forEach(t => text += formatTask(t));
    }
    if (noDate.length > 0) {
      text += `\n*NO DEADLINE (${noDate.length})*\n━━━━━━━━━━━━━━━━\n`;
      noDate.forEach(t => text += formatTask(t));
    }

    text += `\nPlease update status in the app.`;
    return text;
  };

  const sendHodReport = (hodName) => {
    const text = generateHodReport(hodName);
    if (!text) return alert("No tasks for " + hodName);
    const hodDept = depts.find(d => d.hod === hodName);
    const contact = hodDept?.contact;
    if (contact) sendWhatsAppTo(contact, text);
    else shareToWhatsApp(text);
  };

  const shareAllTasks = () => {
    let text = `*MASTER TASK TRACKER*\n`;
    text += `━━━━━━━━━━━━━━━━\n`;
    text += `Progress: ${progress}% done (${doneTasks}/${totalTasks})\n\n`;

    ["pre", "event", "post"].forEach(phase => {
      const phaseTasks = tasks.filter(t => t.phase === phase);
      if (phaseTasks.length === 0) return;
      const info = PHASE_LABELS[phase];
      text += `\n*${info.label.toUpperCase()}*\n━━━━━━━━━━━━━━━━\n`;
      phaseTasks.forEach((t) => {
        const status = t.status === "Done" ? "[Done]" : t.status === "Blocked" ? "[Blocked]" : t.status === "In Progress" ? "[Doing]" : "[Pending]";
        text += `${status} ${t.title}`;
        if (t.owner) text += ` - ${t.owner}`;
        text += `\n`;
      });
    });

    shareToWhatsApp(text);
  };

  return (
    <div className="space-y-4">
      <div className="sticky top-0 bg-gray-50 z-10 pb-2 -mx-4 px-4 pt-2 border-b border-gray-100">
        <div className="flex justify-between items-center mb-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-800">Task Tracker</h2>
            <p className="text-[10px] text-gray-500">{filteredTasks.length} of {totalTasks} · {progress}% done</p>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setShowHodReport(!showHodReport)} className="bg-purple-500 text-white p-2 rounded-lg text-xs shadow" title="Send report to HOD">Report</button>
            <button onClick={shareAllTasks} className="bg-green-500 text-white p-2 rounded-lg text-xs shadow">Share</button>
          </div>
        </div>

        <div className="bg-gray-200 rounded-full h-3 overflow-hidden mb-3">
          <div className="h-full bg-gradient-to-r from-orange-500 to-green-500 rounded-full transition-all duration-500 flex items-center justify-center"
            style={{ width: progress + "%" }}>
            {progress > 10 && <span className="text-[9px] text-white font-bold">{progress}%</span>}
          </div>
        </div>

        <input type="text" placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-300 focus:outline-none bg-white" />

        <div className="flex gap-1 mt-2 overflow-x-auto scrollbar-hide">
          <p className="text-[10px] text-gray-400 font-bold self-center whitespace-nowrap">Phase:</p>
          {[{id:"all",label:"All"},{id:"pre",label:"Pre"},{id:"event",label:"Event"},{id:"post",label:"Post"}].map(f => (
            <button key={f.id} onClick={() => setPhaseFilter(f.id)}
              className={`flex-shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full ${phaseFilter === f.id ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600"}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 mt-1 overflow-x-auto scrollbar-hide">
          <p className="text-[10px] text-gray-400 font-bold self-center whitespace-nowrap">Status:</p>
          {[{id:"all",label:"All",c:"bg-gray-100"},{id:"Not Started",label:"Not",c:"bg-gray-100"},{id:"In Progress",label:"Doing",c:"bg-blue-100 text-blue-700"},{id:"Done",label:"Done",c:"bg-green-100 text-green-700"},{id:"Blocked",label:"Block",c:"bg-red-100 text-red-700"}].map(f => (
            <button key={f.id} onClick={() => setStatusFilter(f.id)}
              className={`flex-shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full ${f.c} ${statusFilter === f.id ? "ring-2 ring-orange-400" : "opacity-70"}`}>
              {f.label}
            </button>
          ))}
        </div>
        {uniqueHODs.length > 0 && (
          <div className="flex gap-1 mt-1 overflow-x-auto scrollbar-hide">
            <p className="text-[10px] text-gray-400 font-bold self-center whitespace-nowrap">HOD:</p>
            <button onClick={() => setHodFilter("all")} className={`flex-shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full ${hodFilter === "all" ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600"}`}>All</button>
            {uniqueHODs.map(hod => (
              <button key={hod} onClick={() => setHodFilter(hod)}
                className={`flex-shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full ${hodFilter === hod ? "bg-purple-500 text-white" : "bg-purple-50 text-purple-700"}`}>
                {hod}
              </button>
            ))}
          </div>
        )}
      </div>

      {showHodReport && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-2xl p-4">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="text-sm font-bold text-purple-700">Send Task Report to HOD</h3>
              <p className="text-[10px] text-purple-600">Click any HOD to send their pending tasks via WhatsApp</p>
            </div>
            <button onClick={() => setShowHodReport(false)} className="text-purple-400 text-lg">x</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {uniqueHODs.map(hod => {
              const hodTasks = tasks.filter(t => (t.owner || getHodForDept(t.department)) === hod);
              const pending = hodTasks.filter(t => t.status !== "Done").length;
              const contact = depts.find(d => d.hod === hod)?.contact;
              return (
                <button key={hod} onClick={() => sendHodReport(hod)}
                  className="bg-white hover:bg-purple-50 border border-purple-200 rounded-xl p-3 text-left transition-all shadow-sm">
                  <p className="text-sm font-bold text-purple-700 truncate">{hod}</p>
                  <p className="text-[10px] text-gray-500">{pending} pending / {hodTasks.length} total</p>
                  {contact ? <p className="text-[9px] text-green-600 truncate">Ph: {contact}</p> : <p className="text-[9px] text-gray-400">No phone</p>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {["pre", "event", "post"].map(phase => {
        const phaseTasks = filteredTasks.filter(t => t.phase === phase);
        if (phaseTasks.length === 0 && phaseFilter !== "all") return null;
        const info = PHASE_LABELS[phase];
        const done = phaseTasks.filter(t => t.status === "Done").length;

        return (
          <div key={phase} className="space-y-2">
            <div className={`flex justify-between items-center rounded-xl px-3 py-2 cursor-pointer ${info.bgColor}`}
              onClick={() => togglePhase(phase)}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{info.label}</span>
                <span className="text-[10px] bg-white/50 px-2 py-0.5 rounded-full font-bold">{done}/{phaseTasks.length}</span>
              </div>
              <div className="flex gap-1 items-center">
                {canEdit && (
                  <button onClick={(e) => { e.stopPropagation(); addTask(phase); }}
                    className="text-[10px] bg-white/50 hover:bg-white font-bold px-2 py-0.5 rounded-full">+ Add</button>
                )}
                <span className={`text-xs transition-transform ${collapsedPhases[phase] ? "" : "rotate-180"}`}>▼</span>
              </div>
            </div>

            {!collapsedPhases[phase] && phaseTasks.map(task => {
              const displayOwner = task.owner || getHodForDept(task.department);
              return (
                <div key={task.id} className={`bg-white rounded-xl border-l-4 ${info.color} border border-gray-100 shadow-sm p-3`}>
                  <input className="w-full text-sm font-semibold bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-gray-800 mb-2"
                    value={task.title} onChange={(e) => updateTask(task.id, "title", e.target.value)} />
                  <div className="flex flex-wrap gap-1 items-center">
                    <select className="text-[10px] bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 flex-shrink-0 max-w-[130px]"
                      value={task.department} onChange={(e) => updateTask(task.id, "department", e.target.value)}>
                      <option value="">-- Dept --</option>
                      {depts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                    </select>
                    {displayOwner ? (
                      <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">{displayOwner}</span>
                    ) : (
                      <input className="text-[10px] bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 flex-1 min-w-[80px]"
                        value={task.owner} onChange={(e) => updateTask(task.id, "owner", e.target.value)} placeholder="Owner" />
                    )}
                    <input type="date" className="text-[10px] bg-gray-50 border border-gray-200 rounded-lg px-1 py-1"
                      value={task.deadline} onChange={(e) => updateTask(task.id, "deadline", e.target.value)} />
                    <select className={`text-[10px] font-semibold rounded-lg px-2 py-1 border-none ${STATUS_COLORS[task.status] || "bg-gray-100"}`}
                      value={task.status} onChange={(e) => updateTask(task.id, "status", e.target.value)}>
                      <option value="Not Started">Not Started</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Done">Done</option>
                      <option value="Blocked">Blocked</option>
                    </select>
                    <button onClick={() => deleteTask(task.id)} className="text-red-300 hover:text-red-500 text-xs ml-auto">x</button>
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
