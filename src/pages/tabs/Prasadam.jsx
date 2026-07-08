import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs, writeBatch, setDoc } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY || "";

export default function Prasadam({ eventId }) {
  const { userData } = useAuth();
  const isSuperAdmin = userData?.globalRole === "superadmin" || userData?.role === "admin";

  const [mahaItems, setMahaItems] = useState([]);
  const [donnaItems, setDonnaItems] = useState([]);
  const [counts, setCounts] = useState({ adultCount: "", childCount: "" });
  const [aiEstimates, setAiEstimates] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [rejectedIds, setRejectedIds] = useState(new Set());
  const [addedIds, setAddedIds] = useState(new Set());
  const [activeTab, setActiveTab] = useState("maha");
  const [event, setEvent] = useState(null);

  useEffect(() => {
    if (!eventId) return;

    getDoc(doc(db, "events", eventId)).then(s => setEvent(s.data()));

    const q1 = query(collection(db, "events", eventId, "prasadam_maha"), orderBy("order", "asc"));
    const u1 = onSnapshot(q1, s => setMahaItems(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    const q2 = query(collection(db, "events", eventId, "prasadam_donna"), orderBy("order", "asc"));
    const u2 = onSnapshot(q2, s => setDonnaItems(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    const u3 = onSnapshot(doc(db, "events", eventId, "prasadam_config", "counts"), s => {
      if (s.exists()) setCounts(s.data());
    });

    // Load saved AI estimates
    const u4 = onSnapshot(query(collection(db, "events", eventId, "prasadam_ai_estimates"), orderBy("order", "asc")), s => {
      if (!s.empty) setAiEstimates(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { u1(); u2(); u3(); u4(); };
  }, [eventId]);

  const saveCounts = async (field, value) => {
    const val = value === "" ? 0 : parseInt(value);
    const ref = doc(db, "events", eventId, "prasadam_config", "counts");
    try {
      await setDoc(ref, { [field]: val }, { merge: true });
      setCounts(prev => ({ ...prev, [field]: val }));
    } catch (e) {
      console.error("Error saving counts:", e);
    }
  };

  const totalMaha = (parseInt(counts.adultCount) || 0) + Math.ceil((parseInt(counts.childCount) || 0) / 2);
  const totalDonna = donnaItems.reduce((s, i) => s + (parseInt(i.count) || 0), 0);

  // Maha Items
  const addMahaItem = () => addDoc(collection(db, "events", eventId, "prasadam_maha"), { name: "", order: mahaItems.length + 1 });
  const updateMahaItem = (id, field, val) => updateDoc(doc(db, "events", eventId, "prasadam_maha", id), { [field]: val });
  const deleteMahaItem = (id) => { if (confirm("Delete?")) deleteDoc(doc(db, "events", eventId, "prasadam_maha", id)); };

  // Donna Items
  const addDonnaItem = () => addDoc(collection(db, "events", eventId, "prasadam_donna"), { variety: "", count: 0, order: donnaItems.length + 1 });
  const updateDonnaItem = (id, field, val) => updateDoc(doc(db, "events", eventId, "prasadam_donna", id), { [field]: val });
  const deleteDonnaItem = (id) => { if (confirm("Delete?")) deleteDoc(doc(db, "events", eventId, "prasadam_donna", id)); };

  // AI Estimates
  const getAIEstimates = async () => {
    setAiLoading(true);
    setAiEstimates([]);
    try {
      const prompt = `You are an HKM festival prasadam planning expert.

Event: ${event?.festivalName} at ${event?.location}
Maha Prasadam (Full meal):
- Adult count: ${counts.adultCount || 0}
- Child count: ${counts.childCount || 0}
- Total: ${totalMaha}
- Menu items: ${mahaItems.map(i => i.name).join(", ") || "Not specified"}

Donna Prasadam (Route distribution):
${donnaItems.map(d => `- ${d.variety}: ${d.count}`).join("\n") || "- Not specified"}
- Total donna: ${totalDonna}

Estimate requirements. Return JSON:
{
  "estimates": [
    {
      "item": "item name",
      "quantity": "number with unit",
      "category": "vessels|serving|furniture|volunteers|disposables|water",
      "section": "maha|donna|both",
      "reason": "short reason max 8 words",
      "addTo": "requirements"
    }
  ]
}

Include:
- Cooking vessels (size and count)
- Serving spoons/ladles
- Tables and chairs
- Paper plates/leaf plates
- Glasses/cups
- Water drums/cans
- Cooking volunteers
- Serving volunteers
- Distribution volunteers
- Cleaning volunteers
- Packing volunteers (for donna)
- Gas cylinders
- Firewood if needed`;

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" }
        })
      });
      const data = await res.json();
      const parsed = JSON.parse(data.choices[0].message.content);
      const estimates = parsed.estimates || [];

      // Delete old estimates first
      const oldSnap = await getDocs(collection(db, "events", eventId, "prasadam_ai_estimates"));
      const batch = writeBatch(db);
      oldSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();

      // Save new estimates
      for (let i = 0; i < estimates.length; i++) {
        await addDoc(collection(db, "events", eventId, "prasadam_ai_estimates"), { ...estimates[i], order: i });
      }

      setAiEstimates(estimates);
      setAddedIds(new Set());
      setRejectedIds(new Set());
    } catch (e) { alert("AI Error: " + e.message); }
    setAiLoading(false);
  };

  const addToRequirements = async (item, id) => {
    await addDoc(collection(db, "events", eventId, "requirements"), {
      item: item.item,
      quantity: item.quantity,
      department: "Prasadam",
      status: "Pending",
      cost: 0,
      notes: item.reason,
      createdAt: new Date()
    });
    setAddedIds(prev => new Set([...prev, id]));
  };

  const categoryColor = (cat) => {
    const map = {
      vessels: "bg-blue-50 text-blue-700 border-blue-100",
      serving: "bg-green-50 text-green-700 border-green-100",
      furniture: "bg-yellow-50 text-yellow-700 border-yellow-100",
      volunteers: "bg-purple-50 text-purple-700 border-purple-100",
      disposables: "bg-orange-50 text-orange-700 border-orange-100",
      water: "bg-teal-50 text-teal-700 border-teal-100",
    };
    return map[cat] || "bg-gray-50 text-gray-700 border-gray-100";
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Prasadam Planning</h2>
          <p className="text-xs text-gray-500 mt-0.5">Plan maha prasadam and donna prasadam separately</p>
        </div>
      </div>

      {/* Tab Switch */}
      <div className="grid grid-cols-3 bg-white p-1 rounded-2xl border border-gray-100 shadow-sm gap-1">
        {[
          { id: "maha", label: "Maha Prasadam" },
          { id: "donna", label: "Donna Prasadam" },
          { id: "ai", label: "AI Estimates" },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`py-2 rounded-xl text-xs font-bold transition-all ${activeTab === t.id ? "bg-orange-500 text-white" : "text-gray-400"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Maha Prasadam */}
      {activeTab === "maha" && (
        <div className="space-y-3">
          {/* Counts */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="font-bold text-gray-700 mb-3 text-sm">Headcount</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Adults</label>
                <input type="number" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-center"
                  value={counts.adultCount || ""} onChange={e => saveCounts("adultCount", e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Children (x0.5)</label>
                <input type="number" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-center"
                  value={counts.childCount || ""} onChange={e => saveCounts("childCount", e.target.value)} placeholder="0" />
              </div>
              <div className="bg-orange-50 rounded-xl p-2 text-center">
                <p className="text-[10px] font-bold text-orange-400 uppercase">Total (A + C/2)</p>
                <p className="text-2xl font-extrabold text-orange-600">{totalMaha}</p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-700 text-sm">Menu Items</h3>
              <button onClick={addMahaItem} className="bg-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl">+ Add Item</button>
            </div>
            {mahaItems.length === 0 && (
              <p className="text-center text-gray-300 py-6 text-sm">No menu items yet. Add items above.</p>
            )}
            <div className="space-y-2">
              {mahaItems.map((item, i) => (
                <div key={item.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                  <span className="text-xs text-gray-400 font-bold w-5">{i + 1}</span>
                  <input
                    className="flex-1 bg-transparent text-sm font-medium outline-none"
                    value={item.name}
                    onChange={e => updateMahaItem(item.id, "name", e.target.value)}
                    placeholder="e.g. Rice, Dal, Sambar..."
                  />
                  <button onClick={() => deleteMahaItem(item.id)} className="text-gray-300 hover:text-red-400 text-sm">✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Donna Prasadam */}
      {activeTab === "donna" && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-gray-700 text-sm">Donna Varieties</h3>
                <p className="text-[10px] text-gray-400">Add each variety with count separately</p>
              </div>
              <button onClick={addDonnaItem} className="bg-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl">+ Add Variety</button>
            </div>
            {donnaItems.length === 0 && (
              <p className="text-center text-gray-300 py-6 text-sm">No donna varieties yet. Add varieties above.</p>
            )}
            <div className="space-y-2">
              {donnaItems.map((item, i) => (
                <div key={item.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                  <span className="text-xs text-gray-400 font-bold w-5">{i + 1}</span>
                  <input
                    className="flex-1 bg-transparent text-sm font-medium outline-none"
                    value={item.variety}
                    onChange={e => updateDonnaItem(item.id, "variety", e.target.value)}
                    placeholder="e.g. Pulihora, Sweet Pongal..."
                  />
                  <input
                    type="number"
                    className="w-24 bg-white border border-gray-200 rounded-lg px-2 py-1 text-sm text-center font-bold"
                    value={item.count || ""}
                    onChange={e => updateDonnaItem(item.id, "count", e.target.value)}
                    placeholder="Count"
                  />
                  <button onClick={() => deleteDonnaItem(item.id)} className="text-gray-300 hover:text-red-400 text-sm">✕</button>
                </div>
              ))}
            </div>
            {donnaItems.length > 0 && (
              <div className="mt-3 bg-orange-50 rounded-xl px-4 py-2 flex items-center justify-between">
                <span className="text-sm text-orange-600 font-medium">Total Donna Count</span>
                <span className="text-lg font-extrabold text-orange-600">{totalDonna.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Estimates */}
      {activeTab === "ai" && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="font-bold text-gray-700 text-sm">AI Prasadam Estimates</h3>
            <p className="text-xs text-gray-400 mt-1">AI calculates vessels, volunteers, equipment based on your counts</p>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="bg-orange-50 rounded-xl p-2 text-center">
                <p className="text-xs text-orange-400 font-bold">Maha Total</p>
                <p className="text-xl font-extrabold text-orange-600">{totalMaha}</p>
              </div>
              <div className="bg-teal-50 rounded-xl p-2 text-center">
                <p className="text-xs text-teal-400 font-bold">Donna Total</p>
                <p className="text-xl font-extrabold text-teal-600">{totalDonna}</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-2 text-center">
                <p className="text-xs text-purple-400 font-bold">Menu Items</p>
                <p className="text-xl font-extrabold text-purple-600">{mahaItems.length}</p>
              </div>
            </div>
            <button onClick={getAIEstimates} disabled={aiLoading} className="w-full mt-4 bg-purple-600 text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-50">
              {aiLoading ? "AI is calculating..." : "✨ Get AI Estimates"}
            </button>
          </div>

          {aiEstimates.length > 0 && (
            <div className="space-y-2">
              {["volunteers", "vessels", "serving", "disposables", "furniture", "water"].map(cat => {
                const catItems = aiEstimates.filter(e => e.category === cat);
                if (catItems.length === 0) return null;
                return (
                  <div key={cat} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">{cat}</h4>
                    <div className="space-y-2">
                      {catItems.map((item, i) => {
                        const id = `${cat}-${i}`;
                        if (rejectedIds.has(id)) return null;
                        return (
                          <div key={id} className={`p-3 rounded-xl border ${categoryColor(cat)} flex items-center justify-between gap-2`}>
                            <div className="flex-1">
                              <p className="text-sm font-bold">{item.item}</p>
                              <p className="text-xs opacity-70">{item.quantity} — {item.reason}</p>
                              <span className="text-[9px] font-bold uppercase opacity-60">{item.section}</span>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              {isSuperAdmin ? (
                                <>
                                  <button onClick={() => setRejectedIds(prev => new Set([...prev, id]))} className="text-gray-300 hover:text-red-400 px-2 py-1 text-sm">✕</button>
                                  {addedIds.has(id) ? (
                                    <span className="text-green-500 text-xs font-bold px-2">Added</span>
                                  ) : (
                                    <button onClick={() => addToRequirements(item, id)} className="bg-purple-600 text-white px-3 py-1 rounded-lg text-xs font-bold">+ Add</button>
                                  )}
                                </>
                              ) : (
                                <span className="text-[10px] text-gray-400 italic">View only</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
