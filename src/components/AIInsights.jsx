import { useState } from "react";

const GROQ_KEY = "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";
const PROXY_URL = "https://corsproxy.io/?";
const API_URL = "https://api.groq.com/openai/v1/chat/completions";

export default function AIInsights({ eventName, daysRemaining, ts, ds, rs, dns, es }) {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [waLoading, setWaLoading] = useState(false);
  const [error, setError] = useState("");

  const callGroq = async (prompt, jsonMode = false) => {
    const res = await fetch(PROXY_URL + encodeURIComponent(API_URL), {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + GROQ_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        max_tokens: jsonMode ? 1000 : 500,
        temperature: 0.7,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "AI Request Failed");
    }
    const data = await res.json();
    return data.choices[0].message.content;
  };

  const fetchInsights = async () => {
    setLoading(true);
    setError("");
    try {
      const prompt = `You are an HKM Festival assistant. Event: ${eventName}, Days: ${daysRemaining}. 
      Tasks: ${ts.done}/${ts.total}. Reqs: ${rs.arranged}/${rs.total}. 
      Budget Deficit: Rs.${Math.abs(dns.surplus)}.
      Give 4 short actionable suggestions as JSON: {"insights":["s1","s2","s3","s4"]}`;
      
      const content = await callGroq(prompt, true);
      const parsed = JSON.parse(content);
      setInsights(parsed.insights || []);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const shareAISummary = async () => {
    setWaLoading(true);
    try {
      const prompt = `Write a warm motivating WhatsApp message for HKM team for ${eventName} in ${daysRemaining} days. 
      Summary: Tasks ${ts.pct}%, Reqs ${rs.pct}%, Budget Rs.${dns.received}/${dns.totalBudget}. 
      Use *bold*. End with Hare Krishna!`;
      
      const msg = await callGroq(prompt, false);
      window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank");
    } catch (e) {
      alert("Error: " + e.message);
    }
    setWaLoading(false);
  };

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-100 rounded-2xl p-4 my-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-800 flex items-center gap-2"><span className="text-xl">✨</span> AI Insights</h3>
        <button onClick={shareAISummary} disabled={waLoading} className="bg-green-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50">
          {waLoading ? "..." : "AI WhatsApp"}
        </button>
      </div>
      {insights.length === 0 && !loading && (
        <div className="text-center py-4">
          <button onClick={fetchInsights} className="bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-semibold px-6 py-2 rounded-xl">
            ✨ Get AI Suggestions
          </button>
        </div>
      )}
      {loading && <p className="text-sm text-center py-4 animate-pulse text-purple-600">AI is analyzing...</p>}
      {error && <p className="text-red-500 text-xs text-center">{error}</p>}
      {insights.length > 0 && (
        <div className="space-y-2">
          {insights.map((ins, i) => (
            <div key={i} className="bg-white p-3 rounded-xl shadow-sm text-sm text-gray-700 flex gap-2">
              <span className="font-bold text-purple-500">{i+1}.</span>{ins}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
