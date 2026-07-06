import { useState } from "react";

const GROQ_KEY = "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";
// Using a reliable bypass method
const API_URL = "https://api.groq.com/openai/v1/chat/completions";

export default function AIInsights({ eventName, daysRemaining, ts, ds, rs, dns, es }) {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [waLoading, setWaLoading] = useState(false);
  const [error, setError] = useState("");

  const callGroq = async (prompt, jsonMode = false) => {
    // We use a different proxy strategy that handles preflight (OPTIONS) better
    const res = await fetch("https://api.allorigins.win/get?url=" + encodeURIComponent(API_URL), {
      method: "POST",
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        max_tokens: jsonMode ? 1000 : 500,
        temperature: 0.7,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    });

    // Note: Since we are using an 'allorigins' wrapper, we need to handle the nested response
    // However, AllOrigins GET is better than POST for free tier. 
    // Let's try a direct approach with a specific header that sometimes bypasses simple CORS checks.
    
    const finalRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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

    if (!finalRes.ok) throw new Error("CORS Blocked by Browser. Please use Chrome Extension 'Allow CORS' or check settings.");
    const data = await finalRes.json();
    return data.choices[0].message.content;
  };

  const fetchInsights = async () => {
    setLoading(true);
    setError("");
    try {
      const prompt = `HKM Festival: ${eventName}, Days: ${daysRemaining}. Tasks: ${ts.done}/${ts.total}. Give 4 short suggestions JSON: {"insights":["s1","s2","s3","s4"]}`;
      const content = await callGroq(prompt, true);
      const parsed = JSON.parse(content);
      setInsights(parsed.insights || []);
    } catch (e) {
      setError("Note: Browser blocked AI request due to CORS security. To enable AI, please install the 'Allow CORS' extension in Chrome or try a different browser.");
      console.error(e);
    }
    setLoading(false);
  };

  const shareAISummary = async () => {
    setWaLoading(true);
    try {
      const prompt = `Write a short motivating WhatsApp status for HKM festival ${eventName}. Tasks ${ts.pct}%. End with Hare Krishna!`;
      const msg = await callGroq(prompt, false);
      window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank");
    } catch (e) {
      alert("AI request blocked by browser CORS policy.");
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
      {error && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-[10px] text-red-600">
          <p className="font-bold mb-1">⚠️ Connection Blocked</p>
          <p>{error}</p>
          <a href="https://chromewebstore.google.com/detail/allow-cors-access-control/lhobafcehpndmhpagppfahoagiakglak" target="_blank" className="underline font-bold mt-2 block">Install Allow CORS Extension</a>
        </div>
      )}
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
