import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";

const GROQ_KEY = "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";

export default function AIAssistant({ eventId }) {
  const [data, setData] = useState({ tasks: [], depts: [], event: null });
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!eventId) return;
    const unsub1 = onSnapshot(collection(db, "events", eventId, "tasks"), s => 
      setData(prev => ({ ...prev, tasks: s.docs.map(d => d.data()) })));
    const unsub2 = onSnapshot(collection(db, "events", eventId, "departments"), s => 
      setData(prev => ({ ...prev, depts: s.docs.map(d => d.data()) })));
    return () => { unsub1(); unsub2(); };
  }, [eventId]);

  const askAI = async () => {
    setLoading(true);
    try {
      const prompt = `HKM Event status: ${data.depts.length} departments, ${data.tasks.length} tasks. 
      Pending tasks: ${data.tasks.filter(t => t.status !== "Done").length}. 
      Give 5 specific actionable suggestions for the coordinator. 
      Format: JSON object {"suggestions": ["s1","s2","s3","s4","s5"]}`;

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" }
        })
      });
      const result = await res.json();
      const parsed = JSON.parse(result.choices[0].message.content);
      setInsights(parsed.suggestions || []);
    } catch (e) {
      alert("AI Error: " + e.message);
    }
    setLoading(false);
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
        <div className="text-5xl mb-4">✨</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">AI Festival Assistant</h2>
        <p className="text-gray-500 mb-6 text-sm">Analyze your event and get smart suggestions to speed up preparation.</p>
        
        <button 
          onClick={askAI}
          disabled={loading}
          className="bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-3 px-8 rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
        >
          {loading ? "AI is thinking..." : "✨ Analyze Event & Give Suggestions"}
        </button>
      </div>

      {insights.length > 0 && (
        <div className="mt-6 space-y-3">
          <h3 className="font-bold text-gray-700 ml-1">AI Suggestions:</h3>
          {insights.map((s, i) => (
            <div key={i} className="bg-purple-50 border border-purple-100 p-4 rounded-xl flex gap-3 items-start">
              <span className="bg-purple-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i+1}</span>
              <p className="text-gray-700 text-sm leading-relaxed">{s}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
