import { useState, useEffect } from "react";
import { collection, onSnapshot, addDoc, doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";

const GROQ_KEY = "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";

const callGroq = async (prompt, json = true) => {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      ...(json ? { response_format: { type: "json_object" } } : {})
    })
  });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error?.message || "AI Error");
  return json ? JSON.parse(d.choices[0].message.content) : d.choices[0].message.content;
};

export default function AIAssistant({ eventId }) {
  const { userData } = useAuth();
  const isSuperAdmin = userData?.globalRole === "superadmin" || userData?.role === "admin";

  const [event, setEvent] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [depts, setDepts] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [users, setUsers] = useState([]);
  const [view, setView] = useState("actions");
  const [loading, setLoading] = useState(false);
  const [nudgeLoading, setNudgeLoading] = useState(null);
  const [missingItems, setMissingItems] = useState(null);
  const [missingTab, setMissingTab] = useState("tasks");
  const [rejectedIds, setRejectedIds] = useState(new Set());
  const [addedIds, setAddedIds] = useState(new Set());
  const [planForm, setPlanForm] = useState({ startLoc: "", endLoc: "", procStart: "", procEnd: "", crowdDarshan: "", donnaCount: "", mahaCount: "", volunteerCount: "", notes: "" });

  const daysRemaining = event?.date ? Math.ceil((new Date(event.date) - new Date()) / 86400000) : null;

  useEffect(() => {
    if (!eventId) return;
    getDoc(doc(db, "events", eventId)).then(s => {
      const d = s.data();
      setEvent(d);
      setPlanForm(prev => ({
        ...prev,
        startLoc: d?.startLoc || "",
        endLoc: d?.endLoc || "",
        procStart: d?.procStart || "",
        procEnd: d?.procEnd || "",
        crowdDarshan: d?.crowdDarshan || "",
        donnaCount: d?.donnaCount || "",
        mahaCount: d?.mahaCount || "",
      }));
    });
    const u1 = onSnapshot(collection(db, "events", eventId, "tasks"), s => setTasks(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(collection(db, "events", eventId, "departments"), s => setDepts(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u3 = onSnapshot(collection(db, "events", eventId, "requirements"), s => setRequirements(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u4 = onSnapshot(collection(db, "users"), s => setUsers(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); u3(); u4(); };
  }, [eventId]);

  // ── Rule-based action items ──────────────────────────────────
  const getActionItems = () => {
    const items = [];
    const missingHOD = depts.filter(d => !(d.hodName || d.hod || "").trim());
    if (missingHOD.length > 0) {
      items.push({ level: "red", title: `${missingHOD.length} Departments Missing HOD`, detail: missingHOD.map(d => d.name).join(", ") });
    }
    const pendingTasks = tasks.filter(t => t.status !== "Done");
    if (pendingTasks.length > 0) {
      items.push({ level: daysRemaining <= 7 ? "red" : "yellow", title: `${pendingTasks.length} Tasks Pending`, detail: `${tasks.filter(t => t.status === "Done").length} done out of ${tasks.length}` });
    }
    const pendingReqs = requirements.filter(r => r.status !== "Arranged");
    if (pendingReqs.length > 0) {
      items.push({ level: "yellow", title: `${pendingReqs.length} Requirements Not Arranged`, detail: pendingReqs.slice(0, 3).map(r => r.item || r.name).join(", ") });
    }
    if (daysRemaining !== null && daysRemaining <= 7) {
      items.push({ level: "red", title: `Only ${daysRemaining} Days Remaining!`, detail: "Accelerate all pending items immediately" });
    }
    // Timing based
    if (event?.procEnd) {
      const hour = parseInt(event.procEnd.split(":")[0]);
      if (hour >= 17) items.push({ level: "yellow", title: "Evening Procession — Check Lighting", detail: "Procession ends after sunset. Arrange lights on route." });
    }
    // Team size check
    depts.forEach(d => {
      const team = d.team ? d.team.split(",").filter(t => t.trim()).length : 0;
      if (team < 3 && (d.hodName || d.hod)) {
        items.push({ level: "yellow", title: `${d.name} — Less than 3 Team Members`, detail: `Current team: ${team} member(s). Please add more.` });
      }
    });
    return items;
  };

  // ── HOD nudge ────────────────────────────────────────────────
  const nudgeHOD = async (dept) => {
    const hodName = dept.hodName || dept.hod || "HOD";
    const hodPhone = dept.hodPhone || dept.contact || "";
    const pendingDeptTasks = tasks.filter(t => t.department?.toLowerCase() === dept.name?.toLowerCase() && t.status !== "Done");
    const teamCount = dept.team ? dept.team.split(",").filter(t => t.trim()).length : 0;
    const hodUser = users.find(u => u.email === dept.hodEmail);
    const lang = hodUser?.preferredLanguage || "english";

    setNudgeLoading(dept.id);
    try {
      const prompt = lang === "telugu"
        ? `HKM ఉత్సవ HOD కి WhatsApp రిమైండర్ రాయండి (Telugu లో):
HOD పేరు: ${hodName}, విభాగం: ${dept.name}
Pending పనులు: ${pendingDeptTasks.map(t => t.title).join(", ") || "లేవు"}
Team సభ్యులు: ${teamCount} (కనీసం 3 ఉండాలి)
రోజులు మిగిలాయి: ${daysRemaining}
*bold* formatting వాడండి. Hare Krishna తో ముగించండి.`
        : `Write a warm WhatsApp reminder for HKM festival HOD:
HOD: ${hodName}, Dept: ${dept.name}
Pending Tasks: ${pendingDeptTasks.map(t => t.title).join(", ") || "None"}
Team Members: ${teamCount} (minimum 3 needed)
Days Remaining: ${daysRemaining}
${teamCount < 3 ? "IMPORTANT: Ask them to add more team members." : ""}
Use *bold* formatting. Keep it warm and motivating. End with Hare Krishna!`;

      const msg = await callGroq(prompt, false);
      const phone = hodPhone.replace(/\D/g, "");
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
    } catch (e) { alert(e.message); }
    setNudgeLoading(null);
  };

  // ── Missing items ─────────────────────────────────────────────
  const findMissingItems = async () => {
    setLoading(true);
    try {
      const prompt = `You are an HKM festival planner. Check what is MISSING.
Festival: ${event?.festivalName}, Crowd: ${event?.crowdDarshan || planForm.crowdDarshan}, Donna: ${event?.donnaCount || planForm.donnaCount}, Maha: ${event?.mahaCount || planForm.mahaCount}
Route: ${event?.startLoc || planForm.startLoc} to ${event?.endLoc || planForm.endLoc}
Procession: ${event?.procStart || planForm.procStart} to ${event?.procEnd || planForm.procEnd}

EXISTING Tasks: ${tasks.map(t => t.title).join(", ")}
EXISTING Departments: ${depts.map(d => d.name).join(", ")}
EXISTING Requirements: ${requirements.map(r => r.item || r.name).join(", ")}

Suggest ONLY items that are NOT already in the existing lists above.
Return JSON: {
  "tasks": [{"title":"","phase":"pre","department":"","status":"Not Started"}],
  "requirements": [{"item":"","quantity":"","unit":"","department":"","status":"Pending","cost":0}],
  "depts": [{"name":"","responsibility":""}]
}`;
      const res = await callGroq(prompt);
      setMissingItems(res);
      setView("missing");
    } catch (e) { alert(e.message); }
    setLoading(false);
  };

  // ── Silent add ───────────────────────────────────────────────
  const silentAdd = async (type, item, id) => {
    const colMap = { tasks: "tasks", requirements: "requirements", depts: "departments" };
    await addDoc(collection(db, "events", eventId, colMap[type]), { ...item, createdAt: new Date() });
    setAddedIds(prev => new Set([...prev, id]));
  };

  const renderMissingList = (type, items) => (
    <div className="space-y-2 mt-3">
      {(items || []).filter((_, i) => !rejectedIds.has(`${type}-${i}`) && !addedIds.has(`${type}-${i}`)).map((item, i) => (
        <div key={i} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <input
                className="text-sm font-bold text-gray-800 w-full border-b border-transparent focus:border-purple-300 outline-none bg-transparent"
                defaultValue={item.title || item.name || item.item}
                onChange={e => {
                  if (item.title !== undefined) item.title = e.target.value;
                  if (item.name !== undefined) item.name = e.target.value;
                  if (item.item !== undefined) item.item = e.target.value;
                }}
              />
              <p className="text-[10px] text-purple-500 font-bold mt-1">Dept: {item.department || "General"} {item.quantity ? `· ${item.quantity} ${item.unit || ""}` : ""}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => setRejectedIds(prev => new Set([...prev, `${type}-${i}`]))} className="text-gray-300 hover:text-red-400 px-2 py-1 text-sm">✕</button>
              <button
                onClick={() => silentAdd(type, item, `${type}-${i}`)}
                className="bg-purple-600 text-white px-3 py-1 rounded-lg text-xs font-bold"
              >
                + Add
              </button>
            </div>
          </div>
          {addedIds.has(`${type}-${i}`) && <p className="text-xs text-green-500 mt-1">✅ Added!</p>}
        </div>
      ))}
      {(items || []).length === 0 && <p className="text-center text-gray-400 text-sm py-4">No missing items found!</p>}
    </div>
  );

  // ── Locked screen ─────────────────────────────────────────────
  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-xl font-bold text-gray-700">AI Features Restricted</h2>
        <p className="text-sm text-gray-400 mt-2">AI Assistant is only available to Super Admin.</p>
        <p className="text-sm text-gray-400 mt-1">Contact <strong>Hari Bhajana Dasa</strong> for access.</p>
      </div>
    );
  }

  const actionItems = getActionItems();
  const hodWithPending = depts.filter(d => {
    const pending = tasks.filter(t => t.department?.toLowerCase() === d.name?.toLowerCase() && t.status !== "Done");
    return pending.length > 0 && (d.hodName || d.hod);
  });

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4 pb-24">
      {/* Top Nav */}
      <div className="grid grid-cols-4 bg-white p-1 rounded-2xl border border-gray-100 shadow-sm gap-1">
        {[
          { id: "actions", label: "🚨 Actions" },
          { id: "nudge", label: "👥 Nudge" },
          { id: "missing", label: "📋 Missing" },
          { id: "planner", label: "✨ Planner" },
        ].map(t => (
          <button key={t.id} onClick={() => setView(t.id)} className={`py-2 rounded-xl text-xs font-bold transition-all ${view === t.id ? "bg-purple-600 text-white" : "text-gray-400"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Action Required ──────────────────────────── */}
      {view === "actions" && (
        <div className="space-y-3">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-800">🚨 Action Required</h2>
              <p className="text-xs text-gray-400">Based on current event data</p>
            </div>
            {daysRemaining !== null && (
              <div className={`text-center px-3 py-2 rounded-xl ${daysRemaining <= 7 ? "bg-red-100" : daysRemaining <= 30 ? "bg-yellow-100" : "bg-green-100"}`}>
                <p className={`text-2xl font-extrabold ${daysRemaining <= 7 ? "text-red-600" : daysRemaining <= 30 ? "text-yellow-600" : "text-green-600"}`}>{daysRemaining}</p>
                <p className="text-[10px] text-gray-500">days left</p>
              </div>
            )}
          </div>
          {actionItems.length === 0 && (
            <div className="bg-green-50 border border-green-100 rounded-2xl p-6 text-center">
              <p className="text-3xl mb-2">🎉</p>
              <p className="font-bold text-green-700">All Good! No urgent actions.</p>
            </div>
          )}
          {actionItems.map((item, i) => (
            <div key={i} className={`p-4 rounded-2xl border ${item.level === "red" ? "bg-red-50 border-red-200" : item.level === "yellow" ? "bg-yellow-50 border-yellow-200" : "bg-green-50 border-green-200"}`}>
              <p className={`font-bold text-sm ${item.level === "red" ? "text-red-700" : item.level === "yellow" ? "text-yellow-700" : "text-green-700"}`}>
                {item.level === "red" ? "🔴" : item.level === "yellow" ? "🟡" : "🟢"} {item.title}
              </p>
              <p className="text-xs text-gray-500 mt-1">{item.detail}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── HOD Nudge Center ─────────────────────────── */}
      {view === "nudge" && (
        <div className="space-y-3">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <h2 className="font-bold text-gray-800">👥 HOD Nudge Center</h2>
            <p className="text-xs text-gray-400 mt-1">Send AI-written WhatsApp reminders to HODs with pending tasks</p>
          </div>
          {hodWithPending.length === 0 && (
            <div className="bg-green-50 border border-green-100 rounded-2xl p-6 text-center">
              <p className="text-3xl mb-2">🎉</p>
              <p className="font-bold text-green-700">All HODs are up to date!</p>
            </div>
          )}
          {depts.map(dept => {
            const pending = tasks.filter(t => t.department?.toLowerCase() === dept.name?.toLowerCase() && t.status !== "Done");
            const hodName = dept.hodName || dept.hod || "";
            const teamCount = dept.team ? dept.team.split(",").filter(t => t.trim()).length : 0;
            if (!hodName) return null;
            return (
              <div key={dept.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex-1 mr-3">
                    <h4 className="font-bold text-gray-800 text-sm">{dept.name}</h4>
                    <p className="text-xs text-gray-500">HOD: {hodName}</p>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {pending.length > 0 && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">{pending.length} pending</span>}
                      {teamCount < 3 && <span className="text-[10px] bg-yellow-100 text-yellow-600 px-2 py-0.5 rounded-full font-bold">Team: {teamCount}/3</span>}
                      {pending.length === 0 && teamCount >= 3 && <span className="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-bold">✅ All good</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => nudgeHOD(dept)}
                    disabled={nudgeLoading === dept.id}
                    className="bg-green-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm disabled:opacity-50 whitespace-nowrap"
                  >
                    {nudgeLoading === dept.id ? "Writing..." : "📱 Nudge"}
                  </button>
                </div>
                {pending.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {pending.slice(0, 3).map((t, i) => (
                      <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t.title}</span>
                    ))}
                    {pending.length > 3 && <span className="text-[10px] text-gray-400">+{pending.length - 3} more</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Missing Items ─────────────────────────────── */}
      {view === "missing" && (
        <div className="space-y-3">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <h2 className="font-bold text-gray-800">📋 Missing Items</h2>
            <p className="text-xs text-gray-400 mt-1">AI checks existing data and suggests only what is missing</p>
            <button onClick={findMissingItems} disabled={loading} className="mt-3 w-full bg-purple-600 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50">
              {loading ? "AI is checking..." : "🔍 Find Missing Items"}
            </button>
          </div>
          {missingItems && (
            <>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {[
                  { id: "tasks", label: "✅ Tasks", count: missingItems.tasks?.length || 0 },
                  { id: "requirements", label: "📦 Reqs", count: missingItems.requirements?.length || 0 },
                  { id: "depts", label: "🏢 Depts", count: missingItems.depts?.length || 0 },
                ].map(t => (
                  <button key={t.id} onClick={() => setMissingTab(t.id)} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border ${missingTab === t.id ? "bg-purple-100 border-purple-200 text-purple-700" : "bg-white border-gray-100 text-gray-400"}`}>
                    {t.label} ({t.count})
                  </button>
                ))}
              </div>
              {renderMissingList(missingTab, missingItems[missingTab])}
            </>
          )}
        </div>
      )}

      {/* ── Smart Planner ─────────────────────────────── */}
      {view === "planner" && (
        <div className="space-y-3">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h2 className="font-bold text-gray-800">✨ Smart Planner</h2>
            <p className="text-xs text-gray-400">Pre-filled from event data. Edit if needed.</p>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-[10px] font-bold text-gray-400 uppercase">Start Location</label>
                <input className="w-full bg-gray-50 rounded-xl px-3 py-2 text-sm mt-1" value={planForm.startLoc} onChange={e => setPlanForm({...planForm, startLoc: e.target.value})} placeholder="Temple gate" /></div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase">End Location</label>
                <input className="w-full bg-gray-50 rounded-xl px-3 py-2 text-sm mt-1" value={planForm.endLoc} onChange={e => setPlanForm({...planForm, endLoc: e.target.value})} placeholder="Main ground" /></div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase">Proc Start</label>
                <input type="time" className="w-full bg-gray-50 rounded-xl px-3 py-2 text-sm mt-1" value={planForm.procStart} onChange={e => setPlanForm({...planForm, procStart: e.target.value})} /></div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase">Proc End</label>
                <input type="time" className="w-full bg-gray-50 rounded-xl px-3 py-2 text-sm mt-1" value={planForm.procEnd} onChange={e => setPlanForm({...planForm, procEnd: e.target.value})} /></div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase">Crowd (Darshan)</label>
                <input type="number" className="w-full bg-gray-50 rounded-xl px-3 py-2 text-sm mt-1" value={planForm.crowdDarshan} onChange={e => setPlanForm({...planForm, crowdDarshan: e.target.value})} placeholder="5000" /></div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase">Volunteer Count</label>
                <input type="number" className="w-full bg-gray-50 rounded-xl px-3 py-2 text-sm mt-1" value={planForm.volunteerCount} onChange={e => setPlanForm({...planForm, volunteerCount: e.target.value})} placeholder="100" /></div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase">Donna Count</label>
                <input type="number" className="w-full bg-gray-50 rounded-xl px-3 py-2 text-sm mt-1" value={planForm.donnaCount} onChange={e => setPlanForm({...planForm, donnaCount: e.target.value})} placeholder="5000" /></div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase">Maha Prasadam</label>
                <input type="number" className="w-full bg-gray-50 rounded-xl px-3 py-2 text-sm mt-1" value={planForm.mahaCount} onChange={e => setPlanForm({...planForm, mahaCount: e.target.value})} placeholder="500" /></div>
            </div>
            <textarea className="w-full bg-gray-50 rounded-xl px-3 py-2 text-sm" rows="2" placeholder="Special notes, VIPs, requirements..." value={planForm.notes} onChange={e => setPlanForm({...planForm, notes: e.target.value})} />
            <button onClick={findMissingItems} disabled={loading} className="w-full bg-purple-600 text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-50">
              {loading ? "AI Planning..." : "✨ Generate Smart Plan"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
