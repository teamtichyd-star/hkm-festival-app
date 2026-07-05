import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot, query, orderBy, updateDoc, doc } from "firebase/firestore";

export default function Etiquette({ eventId }) {
  const [rules, setRules] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "events", eventId, "etiquette"), orderBy("order", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setRules(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [eventId]);

  const toggleBriefed = (id, current) => {
    updateDoc(doc(db, "events", eventId, "etiquette", id), { briefed: !current });
  };

  const briefedCount = rules.filter(r => r.briefed).length;
  const progress = rules.length > 0 ? Math.round((briefedCount / rules.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-800">🙏 ISKCON Etiquette — Volunteer Briefing</h2>
        <p className="text-xs text-gray-500">Check off after briefing volunteers before the event.</p>
        <div className="mt-3 bg-gray-100 rounded-full h-4 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-500 flex items-center justify-center"
            style={{ width: progress + "%" }}
          >
            {progress > 10 && <span className="text-[10px] text-white font-bold">{progress}%</span>}
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-1">{progress}% briefed ({briefedCount}/{rules.length})</p>
      </div>

      <div className="space-y-2">
        {rules.map((rule, i) => (
          <div
            key={rule.id}
            onClick={() => toggleBriefed(rule.id, rule.briefed)}
            className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
              rule.briefed
                ? "bg-green-50 border-green-200 shadow-sm"
                : "bg-white border-gray-100 hover:border-orange-200 hover:shadow-sm"
            }`}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-sm font-bold ${
              rule.briefed
                ? "bg-green-500 text-white"
                : "bg-gray-200 text-gray-500"
            }`}>
              {rule.briefed ? "✓" : i + 1}
            </div>
            <p className={`text-sm leading-relaxed ${rule.briefed ? "text-green-700" : "text-gray-700"}`}>
              {rule.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
