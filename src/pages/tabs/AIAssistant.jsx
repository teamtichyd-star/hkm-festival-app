import { useState, useEffect } from "react";
import { collection, onSnapshot, addDoc, doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";

const GROQ_KEY = "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";

export default function AIAssistant({ eventId }) {
  const [event, setEvent] = useState(null);
  const [data, setData] = useState({ tasks: [], depts: [] });
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("hub"); 
  const [aiTab, setAiTab] = useState("tasks"); 
  const [plan, setPlan] = useState(null);
  const [addedIds, setAddedIds] = useState(new Set());

  useEffect(() => {
    if (!eventId) return;
    getDoc(doc(db, "events", eventId)).then(s => setEvent(s.data()));
    const unsub1 = onSnapshot(collection(db, "events", eventId, "tasks"), s => 
      setData(prev => ({ ...prev, tasks: s.docs.map(d => d.data().title?.toLowerCase()) })));
    const unsub2 = onSnapshot(collection(db, "events", eventId, "departments"), s => 
      setData(prev => ({ ...prev, depts: s.docs.map(d => d.data().name?.toLowerCase()) })));
    return () => { unsub1(); unsub2(); };
  }, [eventId]);

  const callGroq = async (prompt) => {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      })
    });
    const d = await res.json();
    return JSON.parse(d.choices[0].message.content);
  };

  const generatePlan = async () => {
    setLoading(true);
    const prompt = `Plan HKM Festival: ${event?.festivalName}. 
    Details: ${event?.startLoc} to ${event?.endLoc}. 
    Proc: ${event?.procStart}-${event?.procEnd}. Dinner: ${event?.dinnerTime}. 
    Darshan: ${event?.crowdDarshan}, Dinner: ${event?.crowdDinner}, Donna: ${event?.donnaCount}, Maha: ${event?.mahaCount}. 
    Timing-based: Suggest lighting if late, water if long.
    Return JSON: {"depts":[{"name":"","responsibility":""}],"tasks":[{"title":"","phase":"pre","department":"","status":"Not Started"}],"requirements":[{"item":"","quantity":"","unit":"","department":""}],"etiquette":[{"rule":"","category":""}]}`;
    try {
      const res = await callGroq(prompt);
      setPlan(res);
      setView("planner");
    } catch (e) { alert(e.message); }
    setLoading(false);
  };

  const silentAdd = async (type, item, aiId) => {
    try {
      const col = type === 'depts' ? 'departments' : type;
      const cleanItem = { ...item };
      delete cleanItem.id; // remove temp ai id
      await addDoc(collection(db, "events", eventId, col), cleanItem);
      setAddedIds(prev => new Set([...prev, aiId]));
    } catch (e) { alert(e.message); }
  };

  const renderAiList = (type, items) => (
    <div className="space-y-2 mt-4">
      {items?.map((item, i) => {
        const id = `${type}-${i}`;
        const exists = type === 'tasks' ? data.tasks.includes(item.title?.toLowerCase()) : data.depts.includes(item.name?.toLowerCase());
        if (addedIds.has(id)) return null;

        return (
          <div key={id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div className="flex-1 pr-4">
              <input 
                className="font-bold text-gray-800 w-full border-b border-transparent focus:border-purple-200 outline-none" 
                defaultValue={item.title || item.name || item.item || item.rule}
                onChange={(e) => {
                   if(item.title) item.title = e.target.value;
                   if(item.name) item.name = e.target.value;
                   if(item.item) item.item = e.target.value;
                   if(item.rule) item.rule = e.target.value;
                }}
              />
              <p className="text-[10px] text-purple-500 font-bold uppercase mt-1">Suggested Dept: {item.department || 'General'}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAddedIds(prev => new Set([...prev, id]))} className="text-gray-300 hover:text-red-500 px-2">✕</button>
              <button 
                onClick={() => silentAdd(type, item, id)}
                className="bg-purple-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold"
              >
                + Add
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <div className="flex bg-white p-1 rounded-2xl border border-gray-100 shadow-sm">
        <button onClick={() => setView("hub")} className={`flex-1 py-2 rounded-xl text-sm font-bold ${view === 'hub' ? 'bg-purple-600 text-white' : 'text-gray-500'}`}>🚀 Action Hub</button>
        <button onClick={() => setView("planner")} className={`flex-1 py-2 rounded-xl text-sm font-bold ${view === 'planner' ? 'bg-purple-600 text-white' : 'text-gray-500'}`}>✨ AI Planner</button>
      </div>

      {view === "hub" && (
        <div className="bg-white p-10 rounded-3xl text-center border border-dashed border-gray-200">
           <h2 className="text-xl font-bold text-gray-800">Ready to plan?</h2>
           <p className="text-sm text-gray-400 mt-2 mb-6">AI will use your event details to suggest departments, tasks and logistics.</p>
           <button onClick={generatePlan} disabled={loading} className="bg-purple-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg">
             {loading ? "AI is Analyzing Event..." : "✨ Generate AI Suggestions"}
           </button>
        </div>
      )}

      {view === "planner" && plan && (
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {[
              {id: "depts", label: "Depts", icon: "🏢"},
              {id: "tasks", label: "Tasks", icon: "✅"},
              {id: "requirements", label: "Reqs", icon: "📦"},
              {id: "etiquette", label: "Rules", icon: "🙏"}
            ].map(t => (
              <button key={t.id} onClick={() => setAiTab(t.id)} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-2 border transition-all ${aiTab === t.id ? 'bg-purple-100 border-purple-200 text-purple-700' : 'bg-white border-gray-100 text-gray-400'}`}>
                <span>{t.icon}</span> {t.label} ({plan[t.id]?.length || 0})
              </button>
            ))}
          </div>
          
          {renderAiList(aiTab, plan[aiTab])}
          
          <button onClick={() => setView("hub")} className="w-full py-4 text-gray-400 text-xs font-bold">← Back to Hub</button>
        </div>
      )}
    </div>
  );
}
