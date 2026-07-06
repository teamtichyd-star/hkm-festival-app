import { useState, useEffect } from "react";
import { collection, onSnapshot, addDoc } from "firebase/firestore";
import { db } from "../../firebase";

const GROQ_KEY = "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";

export default function AIAssistant({ eventId }) {
  const [data, setData] = useState({ tasks: [], depts: [] });
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("hub"); 
  const [plan, setPlan] = useState(null);
  const [form, setForm] = useState({ crowd: "1000", duration: "8", details: "" });

  useEffect(() => {
    if (!eventId) return;
    const unsub1 = onSnapshot(collection(db, "events", eventId, "tasks"), s => 
      setData(prev => ({ ...prev, tasks: s.docs.map(d => ({id: d.id, ...d.data()})) })));
    const unsub2 = onSnapshot(collection(db, "events", eventId, "departments"), s => 
      setData(prev => ({ ...prev, depts: s.docs.map(d => ({id: d.id, ...d.data()})) })));
    return () => { unsub1(); unsub2(); };
  }, [eventId]);

  const callGroq = async (prompt, json = true) => {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        ...(json ? { response_format: { type: "json_object" } } : {})
      })
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error?.message || "AI Error");
    return json ? JSON.parse(d.choices[0].message.content) : d.choices[0].message.content;
  };

  const getHODReminders = () => {
    return data.depts.map(d => {
      const pending = data.tasks.filter(t => 
        t.department?.toLowerCase() === d.name?.toLowerCase() && t.status !== "Done"
      );
      return { ...d, pendingCount: pending.length, pendingTasks: pending.map(p => p.title) };
    }).filter(d => d.pendingCount > 0);
  };

  const nudgeHOD = async (hod) => {
    const prompt = `Write a short, warm, motivating WhatsApp nudge for an HKM festival HOD. 
    HOD: ${hod.hodName || hod.hod || 'HOD'}, Dept: ${hod.name}. 
    Pending Tasks: ${hod.pendingTasks.join(", ")}. 
    Use *bold* for emphasis. End with Hare Krishna!`;
    setLoading(true);
    try {
      const msg = await callGroq(prompt, false);
      window.open(`https://wa.me/${hod.hodPhone || hod.contact || ''}?text=${encodeURIComponent(msg)}`, "_blank");
    } catch (e) { alert(e.message); }
    setLoading(false);
  };

  const generatePlan = async () => {
    setLoading(true);
    try {
      const prompt = `You are an expert HKM (Hare Krishna Movement) festival planner in India.
Plan a complete Ratha Yatra festival with these details:
- Expected Crowd: ${form.crowd} for dinner, 5000 total darshan
- Duration: ${form.duration} hours
- Additional Info: ${form.details}

Generate a COMPREHENSIVE plan. Return ONLY this JSON with AT LEAST:
- 12 departments 
- 20 tasks (split across pre/event/post phases)
- 15 requirements with realistic quantities and costs in INR

{"depts":[{"name":"string","responsibility":"string","order":1,"budget":0}],
"tasks":[{"title":"string","phase":"pre","department":"string","status":"Not Started","order":1,"owner":""}],
"requirements":[{"item":"string","quantity":"string","unit":"string","department":"string","status":"Pending","cost":0,"notes":"string"}]}

Make everything specific to Ratha Yatra with 2 carts, procession, prasadam distribution for 5000 people.`;
      const res = await callGroq(prompt);
      setPlan(res);
      setView("results");
    } catch (e) { alert(e.message); }
    setLoading(false);
  };

  const saveToEvent = async () => {
    setLoading(true);
    try {
      for (const d of (plan.depts || [])) await addDoc(collection(db, "events", eventId, "departments"), d);
      for (const t of (plan.tasks || [])) await addDoc(collection(db, "events", eventId, "tasks"), t);
      for (const r of (plan.requirements || [])) await addDoc(collection(db, "events", eventId, "requirements"), { ...r, createdAt: new Date() });
      setView("hub");
      alert("Saved successfully!");
    } catch (e) { alert(e.message); }
    setLoading(false);
  };

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      <div className="flex bg-white p-1 rounded-2xl border border-gray-100 shadow-sm">
        {["hub", "planner"].map(t => (
          <button key={t} onClick={() => setView(t)} className={`flex-1 py-2 rounded-xl text-sm font-bold capitalize transition-all ${view === t || (view === 'results' && t === 'planner') ? 'bg-purple-600 text-white' : 'text-gray-500'}`}>
            {t === 'hub' ? '🚀 Action Hub' : '✨ AI Planner'}
          </button>
        ))}
      </div>

      {view === "hub" && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-center">
            <h2 className="text-xl font-bold text-gray-800">Action Hub</h2>
            <p className="text-sm text-gray-500 mt-1">Nudge HODs to finish pending tasks</p>
          </div>
          <div className="grid gap-3">
            {getHODReminders().map((hod, i) => (
              <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                <div className="flex-1 mr-4">
                  <h4 className="font-bold text-gray-800 truncate">{hod.name}</h4>
                  <p className="text-xs text-red-500 font-bold">{hod.pendingCount} Tasks Pending</p>
                </div>
                <button onClick={() => nudgeHOD(hod)} disabled={loading} className="bg-green-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm whitespace-nowrap">
                  WhatsApp Nudge
                </button>
              </div>
            ))}
            {getHODReminders().length === 0 && <p className="text-center text-gray-400 py-10">No pending tasks found for assigned departments!</p>}
          </div>
        </div>
      )}

      {view === "planner" && (
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <h2 className="text-xl font-bold text-gray-800">Smart Event Planner</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-gray-400 ml-1">Expected Crowd</label>
              <input type="number" value={form.crowd} onChange={e => setForm({...form, crowd: e.target.value})} className="w-full bg-gray-50 border-0 rounded-xl px-4 py-3 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-gray-400 ml-1">Duration (Hours)</label>
              <input type="number" value={form.duration} onChange={e => setForm({...form, duration: e.target.value})} className="w-full bg-gray-50 border-0 rounded-xl px-4 py-3 text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-gray-400 ml-1">Additional Details</label>
            <textarea value={form.details} onChange={e => setForm({...form, details: e.target.value})} className="w-full bg-gray-50 border-0 rounded-xl px-4 py-3 text-sm" rows="3" placeholder="Special requirements, VIPs, etc."></textarea>
          </div>
          <button onClick={generatePlan} disabled={loading} className="w-full bg-purple-600 text-white font-bold py-3 rounded-2xl shadow-lg disabled:opacity-50">
            {loading ? "AI is planning..." : "✨ Generate Full Event Plan"}
          </button>
        </div>
      )}

      {view === "results" && plan && (
        <div className="space-y-4">
          <div className="bg-purple-600 p-6 rounded-3xl text-white">
            <h2 className="text-xl font-bold">AI Plan Preview</h2>
            <p className="text-sm opacity-80">Review items before adding to tabs</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white p-3 rounded-2xl text-center shadow-sm">
                <p className="text-lg font-bold">{plan.depts?.length || 0}</p>
                <p className="text-[10px] text-gray-500 font-bold">Depts</p>
            </div>
            <div className="bg-white p-3 rounded-2xl text-center shadow-sm">
                <p className="text-lg font-bold">{plan.tasks?.length || 0}</p>
                <p className="text-[10px] text-gray-500 font-bold">Tasks</p>
            </div>
            <div className="bg-white p-3 rounded-2xl text-center shadow-sm">
                <p className="text-lg font-bold">{plan.requirements?.length || 0}</p>
                <p className="text-[10px] text-gray-500 font-bold">Reqs</p>
            </div>
          </div>
          <button onClick={saveToEvent} disabled={loading} className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl shadow-lg">
            {loading ? "Adding to tabs..." : "➕ Add to All Tabs Now"}
          </button>
          <button onClick={() => setView("planner")} className="w-full text-gray-400 text-xs py-2">Discard</button>
        </div>
      )}
    </div>
  );
}
