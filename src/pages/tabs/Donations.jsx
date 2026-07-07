import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY;

export default function Donations({ eventId }) {
  const [donors, setDonors] = useState([]);
  const [depts, setDepts] = useState([]);
  const [reqs, setReqs] = useState([]);
  const [event, setEvent] = useState(null);
  const [expandedDonor, setExpandedDonor] = useState(null);
  const [thankYouLoading, setThankYouLoading] = useState(null);
  const { userData } = useAuth();
  const canEdit = true;

  useEffect(() => {
    const unsub1 = onSnapshot(query(collection(db, "events", eventId, "donors"), orderBy("createdAt", "desc")), snap => {
      setDonors(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsub2 = onSnapshot(query(collection(db, "events", eventId, "departments"), orderBy("order", "asc")), snap => {
      setDepts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsub3 = onSnapshot(collection(db, "events", eventId, "requirements"), snap => {
      setReqs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    // Get event details
    const unsub4 = onSnapshot(doc(db, "events", eventId), snap => {
      setEvent(snap.data());
    });
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [eventId]);

  const addDonor = async () => {
    await addDoc(collection(db, "events", eventId, "donors"), {
      name: "", amount: 0, purpose: "", phone: "", gothra: "", address: "", received: false, createdAt: new Date(),
    });
  };

  const updateDonor = (id, field, value) => {
    updateDoc(doc(db, "events", eventId, "donors", id), { [field]: value });
  };

  const deleteDonor = async (id) => {
    if (confirm("Delete donor?")) await deleteDoc(doc(db, "events", eventId, "donors", id));
  };

  const sendThankYou = async (donor) => {
    if (!donor.phone) return alert("No phone number for this donor!");
    setThankYouLoading(donor.id);
    try {
      const eventName = (event?.festivalName || "") + " - " + (event?.location || "");
      const lines = [
        `Hare Krishna ${donor.name} garu`,
        ``,
        `Thank you for your generous contribution to *${eventName}*.`,
        ``,
        `*Donation Details:*`,
        `- Amount: Rs.${(donor.amount || 0).toLocaleString("en-IN")}`,
        ...(donor.purpose ? [`- Purpose: ${donor.purpose}`] : []),
        ...(donor.gothra ? [`- Gothra: ${donor.gothra}`] : []),
        ``,
        `Your seva will help make this festival a grand success.`,
        `May Lord bless you and your family abundantly.`,
        ``,
        `Hare Krishna`,
        `-- ${eventName}`,
      ];
      const msg = lines.join("\n");
      const phone = donor.phone.replace(/\D/g, "");
      const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
      const waUrl = "https://wa.me/" + phone + "?text=" + encodeURIComponent(msg);
      const appUrl = "whatsapp://send?phone=" + phone + "&text=" + encodeURIComponent(msg);
      if (isMobile) {
        window.location.href = appUrl;
        setTimeout(() => window.open(waUrl, "_blank"), 1500);
      } else {
        window.open(waUrl, "_blank");
      }
    } catch (e) { alert(e.message); }
    setThankYouLoading(null);
  };

  const deptBudget = depts.reduce((s, d) => s + (parseFloat(d.budget) || 0), 0);
  const reqCost = reqs.reduce((s, r) => s + (parseFloat(r.estCost) || 0), 0);
  const totalBudget = deptBudget + reqCost;
  const totalDonations = donors.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
  const receivedDonations = donors.filter(d => d.received).reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
  const surplus = receivedDonations - totalBudget;

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Donations</h2>
          <p className="text-xs text-gray-500 mt-0.5">Track donors and send thank you messages</p>
        </div>
        {canEdit && (
          <button onClick={addDonor} className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md">
            + Add Donor
          </button>
        )}
      </div>

      {/* Budget Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 font-bold uppercase">Dept Budget</p>
          <p className="text-2xl font-extrabold text-gray-700 mt-1">Rs.{deptBudget.toLocaleString("en-IN")}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 font-bold uppercase">Total Required</p>
          <p className="text-2xl font-extrabold text-gray-700 mt-1">Rs.{totalBudget.toLocaleString("en-IN")}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 font-bold uppercase">Total Pledged</p>
          <p className="text-2xl font-extrabold text-blue-600 mt-1">Rs.{totalDonations.toLocaleString("en-IN")}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 font-bold uppercase">Received</p>
          <p className="text-2xl font-extrabold text-green-600 mt-1">Rs.{receivedDonations.toLocaleString("en-IN")}</p>
        </div>
      </div>

      {/* Surplus/Deficit */}
      <div className={`rounded-2xl p-4 flex items-center justify-between ${surplus >= 0 ? "bg-green-50 border border-green-100" : "bg-red-50 border border-red-100"}`}>
        <span className={`font-bold ${surplus >= 0 ? "text-green-700" : "text-red-700"}`}>
          {surplus >= 0 ? "Surplus" : "Deficit"}
        </span>
        <span className={`text-2xl font-extrabold ${surplus >= 0 ? "text-green-700" : "text-red-700"}`}>
          Rs.{Math.abs(surplus).toLocaleString("en-IN")}
        </span>
      </div>

      {/* Donor List */}
      <div className="space-y-3">
        <h3 className="font-bold text-gray-700">Donor List ({donors.length})</h3>
        {donors.length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center">
            <p className="text-gray-400 text-sm">No donors yet. Click + Add Donor to start.</p>
          </div>
        )}
        {donors.map(donor => (
          <div key={donor.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Main Row */}
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-bold text-gray-400 uppercase">Donor Name</label>
                      <input
                        className="w-full text-sm font-bold bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 mt-0.5"
                        value={donor.name || ""}
                        onChange={e => updateDonor(donor.id, "name", e.target.value)}
                        placeholder="Full name..."
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-gray-400 uppercase">Amount (Rs.)</label>
                      <input
                        type="number"
                        className="w-full text-sm font-bold bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 mt-0.5"
                        value={donor.amount || ""}
                        onChange={e => updateDonor(donor.id, "amount", parseFloat(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-gray-400 uppercase">Phone</label>
                      <input
                        type="tel"
                        className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 mt-0.5"
                        value={donor.phone || ""}
                        onChange={e => updateDonor(donor.id, "phone", e.target.value)}
                        placeholder="WhatsApp number..."
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-gray-400 uppercase">Gothra</label>
                      <input
                        className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 mt-0.5"
                        value={donor.gothra || ""}
                        onChange={e => updateDonor(donor.id, "gothra", e.target.value)}
                        placeholder="Gothra..."
                      />
                    </div>
                  </div>

                  {/* Expandable fields */}
                  <button onClick={() => setExpandedDonor(expandedDonor === donor.id ? null : donor.id)} className="text-[10px] text-purple-500 font-bold">
                    {expandedDonor === donor.id ? "Hide details ▲" : "More details ▼"}
                  </button>

                  {expandedDonor === donor.id && (
                    <div className="space-y-2 pt-1">
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 uppercase">Address</label>
                        <textarea
                          className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 mt-0.5 resize-none"
                          value={donor.address || ""}
                          onChange={e => updateDonor(donor.id, "address", e.target.value)}
                          placeholder="Full address..."
                          rows={2}
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 uppercase">Purpose</label>
                        <input
                          className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 mt-0.5"
                          value={donor.purpose || ""}
                          onChange={e => updateDonor(donor.id, "purpose", e.target.value)}
                          placeholder="e.g. Prasadam, Decoration..."
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
                <label className="flex items-center gap-2 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={donor.received || false}
                    onChange={e => updateDonor(donor.id, "received", e.target.checked)}
                    className="w-4 h-4 accent-green-500"
                  />
                  <span className={`text-xs font-bold ${donor.received ? "text-green-600" : "text-gray-400"}`}>
                    {donor.received ? "Amount Received" : "Mark as Received"}
                  </span>
                </label>
                {donor.phone && (
                  <button
                    onClick={() => sendThankYou(donor)}
                    disabled={thankYouLoading === donor.id}
                    className="bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 flex items-center gap-1"
                  >
                    {thankYouLoading === donor.id ? "..." : "Thank You"}
                  </button>
                )}
                <button onClick={() => deleteDonor(donor.id)} className="text-red-300 hover:text-red-500 text-sm px-2">✕</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
