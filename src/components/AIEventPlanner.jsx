import { useState } from "react";
import { generateEventPlan } from "../services/gemini";
import { db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";

export default function AIEventPlanner({ eventId, eventData, onClose, onDone }) {
  const [step, setStep] = useState("form");
  const [form, setForm] = useState({ expectedCrowd: "", durationHours: "", details: "" });
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

  const generate = async () => {
    if (!form.expectedCrowd || !form.durationHours) { setError("Please fill expected crowd and duration."); return; }
    setError("");
    setStep("generating");
    try {
      const result = await generateEventPlan({
        festivalName: eventData?.festivalName || "Festival",
        location: eventData?.location || "",
        date: eventData?.date || "",
        expectedCrowd: form.expectedCrowd,
        durationHours: form.durationHours,
        details: form.details,
      });
      setPlan(result);
      setStep("preview");
    } catch (e) {
      setError("AI generation failed: " + e.message);
      setStep("form");
    }
  };

  const saveToFirestore = async () => {
    if (!plan || !eventId) return;
    setStep("saving");
    try {
      setProgress("Saving departments...");
      for (const d of (plan.departments || [])) await addDoc(collection(db, "events", eventId, "departments"), d);
      setProgress("Saving tasks...");
      for (const t of (plan.tasks || [])) await addDoc(collection(db, "events", eventId, "tasks"), t);
      setProgress("Saving requirements...");
      for (const r of (plan.requirements || [])) await addDoc(collection(db, "events", eventId, "requirements"), { ...r, createdAt: new Date() });
      setProgress("Saving etiquette...");
      for (const e of (plan.etiquette || [])) await addDoc(collection(db, "events", eventId, "etiquette"), e);
      setProgress("Saving checkpoints...");
      for (const c of (plan.checkpoints || [])) await addDoc(collection(db, "events", eventId, "checkpoints"), c);
      setStep("done");
      setTimeout(() => { onDone && onDone(); onClose && onClose(); }, 1800);
    } catch (e) {
      setError("Save failed: " + e.message);
      setStep("preview");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 rounded-t-2xl flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg">✨ AI Event Planner</h2>
            <p className="text-purple-100 text-xs">{eventData?.festivalName} · {eventData?.location}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl font-bold">✕</button>
        </div>

        <div className="p-4">
          {step === "form" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">AI will generate departments, tasks, requirements, etiquette and crowd checkpoints for your event.</p>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Expected Crowd *</label>
                <input type="number" placeholder="e.g. 5000" value={form.expectedCrowd} onChange={e => setForm({ ...form, expectedCrowd: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Event Duration (hours) *</label>
                <input type="number" placeholder="e.g. 8" value={form.durationHours} onChange={e => setForm({ ...form, durationHours: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Additional Details (optional)</label>
                <textarea placeholder="e.g. Ratha Yatra procession 2km route, VIP guests, cultural programs, dinner prasadam..." value={form.details} onChange={e => setForm({ ...form, details: e.target.value })} rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-400 resize-none" />
              </div>
              {error && <p className="text-red-500 text-xs bg-red-50 p-2 rounded-lg">{error}</p>}
              <button onClick={generate} className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-3 rounded-xl hover:opacity-90 transition-all">
                ✨ Generate Event Plan with AI
              </button>
            </div>
          )}

          {step === "generating" && (
            <div className="text-center py-12">
              <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="font-semibold text-gray-700">AI is planning your event...</p>
              <p className="text-sm text-gray-400 mt-2">Generating departments, tasks, requirements and more</p>
              <p className="text-xs text-purple-500 mt-3">This may take 15-30 seconds</p>
            </div>
          )}

          {step === "preview" && plan && (
            <div className="space-y-4">
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                <p className="text-sm font-semibold text-purple-700 mb-1">AI Generated Plan Ready!</p>
                <p className="text-xs text-purple-600">{plan.budgetSummary}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Departments", val: plan.departments?.length || 0, color: "bg-blue-50 text-blue-700" },
                  { label: "Tasks", val: plan.tasks?.length || 0, color: "bg-green-50 text-green-700" },
                  { label: "Requirements", val: plan.requirements?.length || 0, color: "bg-orange-50 text-orange-700" },
                  { label: "Etiquette", val: plan.etiquette?.length || 0, color: "bg-indigo-50 text-indigo-700" },
                  { label: "Checkpoints", val: plan.checkpoints?.length || 0, color: "bg-teal-50 text-teal-700" },
                ].map(s => (
                  <div key={s.label} className={"rounded-xl p-2 text-center " + s.color}>
                    <div className="text-xl font-extrabold">{s.val}</div>
                    <div className="text-xs">{s.label}</div>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Departments Preview</p>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {plan.departments?.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-1.5">
                      <span className="text-gray-400 text-xs w-5">{i + 1}</span>
                      <span className="font-medium text-gray-700">{d.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Tasks Preview</p>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {plan.tasks?.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-1.5">
                      <span className={"text-xs px-1.5 py-0.5 rounded font-medium " + (t.phase === "pre" ? "bg-blue-100 text-blue-600" : t.phase === "event" ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-600")}>
                        {t.phase}
                      </span>
                      <span className="text-gray-700">{t.title}</span>
                    </div>
                  ))}
                </div>
              </div>
              {plan.keyRisks?.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                  <p className="text-xs font-semibold text-red-600 mb-2">Key Risks</p>
                  {plan.keyRisks.map((r, i) => <p key={i} className="text-xs text-red-600">• {r}</p>)}
                </div>
              )}
              {plan.suggestions?.length > 0 && (
                <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                  <p className="text-xs font-semibold text-green-600 mb-2">AI Suggestions</p>
                  {plan.suggestions.map((s, i) => <p key={i} className="text-xs text-green-700">• {s}</p>)}
                </div>
              )}
              {error && <p className="text-red-500 text-xs bg-red-50 p-2 rounded-lg">{error}</p>}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button onClick={() => { setPlan(null); setStep("form"); }} className="border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-50 text-sm">Regenerate</button>
                <button onClick={saveToFirestore} className="bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-2.5 rounded-xl hover:opacity-90 text-sm">Save to Event</button>
              </div>
            </div>
          )}

          {step === "saving" && (
            <div className="text-center py-12">
              <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="font-semibold text-gray-700">Saving to Firestore...</p>
              <p className="text-sm text-purple-500 mt-2">{progress}</p>
            </div>
          )}

          {step === "done" && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎉</div>
              <p className="font-bold text-gray-700 text-lg">Event Plan Saved!</p>
              <p className="text-sm text-gray-400 mt-2">All departments, tasks and requirements added</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
