import { useState } from "react";

const GROQ_KEY = "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";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const callGroq = async (prompt, jsonMode = false) => {
  const resp = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: jsonMode ? 1000 : 500,
      temperature: 0.7,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  const body = await resp.json();
  if (!resp.ok) throw new Error(body.error?.message || "Groq error");
  return body.choices?.[0]?.message?.content || "";
};

export default function AIInsights({ eventName, daysRemaining, ts, ds, rs, dns, es }) {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [waLoading, setWaLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchInsights = async () => {
    setLoading(true);
    setError("");
    try {
      const prompt = `You are an HKM Festival assistant.
Event: ${eventName}, Days Remaining: ${daysRemaining}
Tasks: ${ts.done}/${ts.total} done, ${ts.pending} pending
Departments: ${ds.withHOD} have HOD, ${ds.missingHOD} missing HOD
Requirements: ${rs.arranged}/${rs.total} arranged
Donations: Rs.${dns.received} received vs Rs.${dns.totalBudget} budget
Etiquette: ${es.briefed}/${es.total} done
Give 4 short actionable suggestions. Return ONLY JSON: {"insights":["s1","s2","s3","s4"]}`;
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
      const prompt = `Write a short warm WhatsApp message for HKM festival team.
Event: ${eventName}, Days: ${daysRemaining}
Tasks: ${ts.done}/${ts.total} (${ts.pct}%), Reqs: ${rs.arranged}/${rs.total}
Budget: Rs.${dns.received}/Rs.${dns.totalBudget}
Use *bold*. Max 100 words. End with Hare Krishna!`;
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
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <span className="text-xl">✨</span> AI Insights
        </h3>
        <button onClick={shareAISummary} disabled={waLoading} className="bg-green-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50">
          {waLoading ? "..." : "AI WhatsApp"}
        </button>
      </div>

      {insights.length === 0 && !loading && (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500 mb-3">Get AI-powered suggestions based on current event status</p>
          <button onClick={fetchInsights} className="bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-semibold px-6 py-2 rounded-xl hover:opacity-90">
            ✨ Get AI Suggestions
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-3 py-6">
          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-purple-600">AI is analyzing your event...</p>
        </div>
      )}

      {error && (
        <p className="text-red-500 text-xs bg-red-50 p-2 rounded-lg mt-2">{error}</p>
      )}

      {insights.length > 0 && (
        <div className="space-y-2">
          {insights.map((ins, i) => (
            <div key={i} className="bg-white p-3 rounded-xl shadow-sm text-sm text-gray-700 flex gap-2">
              <span className="font-bold text-purple-500 shrink-0">{i + 1}.</span>
              <span>{ins}</span>
            </div>
          ))}
          <button onClick={fetchInsights} className="w-full text-xs text-purple-500 pt-1 text-center">
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}
