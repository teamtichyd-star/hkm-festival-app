import { useState } from "react";
import { getDashboardInsights, generateWhatsAppSummary } from "../services/gemini";

export default function AIInsights({ eventName, daysRemaining, ts, ds, rs, dns, es }) {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [waLoading, setWaLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchInsights = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getDashboardInsights({
        eventName,
        daysRemaining,
        tasks: { done: ts.done, inProgress: ts.inProgress, pending: ts.pending, total: ts.total },
        departments: { withHOD: ds.withHOD, missingHOD: ds.missingHOD },
        requirements: { arranged: rs.arranged, pending: rs.pending },
        donations: { received: dns.received, budget: dns.totalBudget, surplus: dns.surplus },
        etiquette: { briefed: es.briefed, total: es.total },
      });
      setInsights(result);
    } catch (e) {
      setError("Could not load AI insights. " + e.message);
    }
    setLoading(false);
  };

  const shareAISummary = async () => {
    setWaLoading(true);
    try {
      const summary = await generateWhatsAppSummary({
        eventName,
        daysRemaining,
        tasks: ts,
        departments: ds,
        requirements: rs,
        donations: { received: dns.received, budget: dns.totalBudget, surplus: dns.surplus },
        etiquette: es,
      });
      window.open("https://wa.me/?text=" + encodeURIComponent(summary), "_blank");
    } catch (e) {
      alert("AI summary failed: " + e.message);
    }
    setWaLoading(false);
  };

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-100 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <span className="text-xl">✨</span> AI Insights
        </h3>
        <button
          onClick={shareAISummary}
          disabled={waLoading}
          className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
        >
          {waLoading ? "Generating..." : "AI WhatsApp"}
        </button>
      </div>

      {insights.length === 0 && !loading && (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500 mb-3">Get AI-powered suggestions based on current event status</p>
          <button onClick={fetchInsights} className="bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-semibold px-6 py-2 rounded-xl hover:opacity-90 transition-all">
            ✨ Get AI Suggestions
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 py-4">
          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin shrink-0" />
          <p className="text-sm text-purple-600">AI is analyzing your event...</p>
        </div>
      )}

      {error && <p className="text-red-500 text-xs bg-red-50 p-2 rounded-lg mt-2">{error}</p>}

      {insights.length > 0 && (
        <div className="space-y-2">
          {insights.map((insight, i) => (
            <div key={i} className="flex items-start gap-2 bg-white rounded-xl p-3 shadow-sm">
              <span className="text-purple-500 font-bold text-sm shrink-0">{i + 1}.</span>
              <p className="text-sm text-gray-700">{insight}</p>
            </div>
          ))}
          <button onClick={fetchInsights} className="w-full text-xs text-purple-500 hover:text-purple-700 pt-1 text-center">
            Refresh suggestions
          </button>
        </div>
      )}
    </div>
  );
}
