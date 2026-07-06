import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";

const Dashboard = ({ currentEvent, currentUser }) => {
  const [departments, setDepartments] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [donations, setDonations] = useState([]);
  const [etiquette, setEtiquette] = useState([]);
  const [crowd, setCrowd] = useState([]);
  const [loading, setLoading] = useState(true);

  const eventId = currentEvent?.id;

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      setDepartments([]);
      setTasks([]);
      setRequirements([]);
      setDonations([]);
      setEtiquette([]);
      setCrowd([]);
      return;
    }

    setLoading(true);
    const unsubs = [];

    const listenTo = (col, setter, orderField) => {
      try {
        const ref = collection(db, "events", eventId, col);
        const q = orderField ? query(ref, orderBy(orderField, "asc")) : ref;
        const unsub = onSnapshot(q, (snap) => {
          setter(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }, (err) => {
          console.warn(col + " error:", err);
          setter([]);
        });
        unsubs.push(unsub);
      } catch(e) {
        console.warn(col + " catch:", e);
        setter([]);
      }
    };

    listenTo("departments", setDepartments, "order");
    listenTo("tasks", setTasks, "order");
    listenTo("requirements", setRequirements, null);
    listenTo("donors", setDonations, null);
    listenTo("etiquette", setEtiquette, "order");
    listenTo("checkpoints", setCrowd, "order");

    setLoading(false);
    return () => unsubs.forEach((u) => u());
  }, [eventId]);

  const daysRemaining = () => {
    if (!currentEvent?.date) return null;
    const eventDate = new Date(currentEvent.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
  };

  const taskStats = () => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "Done").length;
    const inProgress = tasks.filter((t) => t.status === "In Progress").length;
    const pending = tasks.filter((t) => !t.status || t.status === "Pending" || t.status === "Not Started" || t.status === "Blocked").length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const phases = {};
    tasks.forEach((t) => {
      const ph = t.phase || "General";
      if (!phases[ph]) phases[ph] = { total: 0, done: 0 };
      phases[ph].total++;
      if (t.status === "Done") phases[ph].done++;
    });
    return { total, done, inProgress, pending, pct, phases };
  };

  const deptStats = () => {
    const total = departments.length;
    const withHOD = departments.filter((d) => (d.hodName || d.hod || "").trim()).length;
    const missingHOD = total - withHOD;
    const totalBudget = departments.reduce((s, d) => s + (parseFloat(d.budget) || 0), 0);
    return { total, withHOD, missingHOD, totalBudget };
  };

  const reqStats = () => {
    const total = requirements.length;
    const arranged = requirements.filter((r) => r.status === "Arranged").length;
    const pending = requirements.filter((r) => r.status === "Pending" || !r.status).length;
    const partial = requirements.filter((r) => r.status === "Partial").length;
    const totalCost = requirements.reduce((s, r) => s + (parseFloat(r.cost) || 0), 0);
    const pct = total ? Math.round((arranged / total) * 100) : 0;
    return { total, arranged, pending, partial, totalCost, pct };
  };

  const donationStats = () => {
    const totalBudget = departments.reduce((s, d) => s + (parseFloat(d.budget) || 0), 0);
    const received = donations.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
    const surplus = received - totalBudget;
    const pct = totalBudget ? Math.min(Math.round((received / totalBudget) * 100), 100) : 0;
    return { totalBudget, received, surplus, pct };
  };

  const etiquetteStats = () => {
    const total = etiquette.length;
    const briefed = etiquette.filter((e) => e.briefed || e.status === "Done").length;
    const pct = total ? Math.round((briefed / total) * 100) : 0;
    return { total, briefed, pct };
  };

  const crowdStats = () => {
    const totalEstimate = crowd.reduce((s, c) => s + (parseFloat(c.estimate) || parseFloat(c.count) || 0), 0);
    return { totalEstimate, zones: crowd.length };
  };

  const ts = taskStats();
  const ds = deptStats();
  const rs = reqStats();
  const dns = donationStats();
  const es = etiquetteStats();
  const cs = crowdStats();
  const days = daysRemaining();

  const eventName = currentEvent?.festivalName || currentEvent?.name || "Festival";

  const shareWhatsApp = () => {
    const dayText =
      days === null
        ? null
        : days > 0
          ? `${days} days remaining`
          : days === 0
            ? "Today"
            : "Event completed";

    const lines = [
      `🎉 *${eventName} - Status Report*`,
      "",
      ...(currentEvent?.date
        ? [`📅 *Date:* ${new Date(currentEvent.date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}`]
        : []),
      ...(currentEvent?.location ? [`📍 *Location:* ${currentEvent.location}`] : []),
      ...(dayText ? [`⏳ *Days Remaining:* ${dayText}`] : []),
      "",
      "━━━━━━━━━━━━━━",
      "✅ *TASKS*",
      `• Done: ${ts.done}/${ts.total} (${ts.pct}%)`,
      `• In Progress: ${ts.inProgress}`,
      `• Pending: ${ts.pending}`,
      "",
      "🏢 *DEPARTMENTS*",
      `• Total: ${ds.total}`,
      `• HOD Assigned: ${ds.withHOD}`,
      `• Missing HOD: ${ds.missingHOD}`,
      `• Budget: Rs.${ds.totalBudget.toLocaleString("en-IN")}`,
      "",
      "📦 *REQUIREMENTS*",
      `• Arranged: ${rs.arranged}/${rs.total} (${rs.pct}%)`,
      `• Pending: ${rs.pending}`,
      `• Cost: Rs.${rs.totalCost.toLocaleString("en-IN")}`,
      "",
      "💰 *DONATIONS*",
      `• Received: Rs.${dns.received.toLocaleString("en-IN")}`,
      `• Budget Needed: Rs.${dns.totalBudget.toLocaleString("en-IN")}`,
      `• ${dns.surplus >= 0 ? "Surplus" : "Deficit"}: Rs.${Math.abs(dns.surplus).toLocaleString("en-IN")}`,
      ...(es.total > 0
        ? ["", "🙏 *ETIQUETTE*", `• Briefed: ${es.briefed}/${es.total} (${es.pct}%)`]
        : []),
      ...(cs.zones > 0
        ? ["", "👥 *CROWD ESTIMATE*", `• Total Estimate: ${cs.totalEstimate.toLocaleString("en-IN")}`, `• Zones: ${cs.zones}`]
        : []),
      "",
      "📲 _Shared from HKM Festival App_",
    ];

    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`, "_blank");
  };

  const sharePendingWhatsApp = () => {
    const pendingTasks = tasks.filter((t) => t.status !== "Done");
    const pendingReqs = requirements.filter((r) => r.status !== "Arranged");
    const missingDepts = departments.filter((d) => !(d.hodName || d.hod || "").trim());

    const lines = [
      `⚠️ *${eventName} - Pending Items*`,
      "",
      ...(currentEvent?.date
        ? [`📅 *Date:* ${new Date(currentEvent.date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}`]
        : []),
      ...(currentEvent?.location ? [`📍 *Location:* ${currentEvent.location}`] : []),
      "",
      "━━━━━━━━━━━━━━",
    ];

    if (pendingTasks.length > 0) {
      lines.push(`✅ *PENDING TASKS (${pendingTasks.length})*`);
      pendingTasks.slice(0, 10).forEach((t) => {
        lines.push(`• ${t.title || t.task || "Task"} — ${t.status || "Pending"}`);
      });
      if (pendingTasks.length > 10) lines.push(`• ...and ${pendingTasks.length - 10} more`);
      lines.push("");
    }

    if (pendingReqs.length > 0) {
      lines.push(`📦 *PENDING REQUIREMENTS (${pendingReqs.length})*`);
      pendingReqs.slice(0, 8).forEach((r) => {
        lines.push(`• ${r.item || r.name || "Item"} — ${r.status || "Pending"}`);
      });
      if (pendingReqs.length > 8) lines.push(`• ...and ${pendingReqs.length - 8} more`);
      lines.push("");
    }

    if (missingDepts.length > 0) {
      lines.push(`🏢 *DEPARTMENTS MISSING HOD (${missingDepts.length})*`);
      missingDepts.forEach((d) => {
        lines.push(`• ${d.name}`);
      });
      lines.push("");
    }

    if (pendingTasks.length === 0 && pendingReqs.length === 0 && missingDepts.length === 0) {
      lines.push("🎉 No pending items. Everything looks clear.");
      lines.push("");
    }

    lines.push("📲 _Shared from HKM Festival App_");

    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`, "_blank");
  };

  const ProgressBar = ({ pct, color = "bg-orange-500", height = "h-3" }) => (
    <div className={"w-full bg-gray-200 rounded-full overflow-hidden " + height}>
      <div className={color + " " + height + " rounded-full transition-all duration-700"} style={{ width: pct + "%" }} />
    </div>
  );

  const StatBadge = ({ label, value, color }) => (
    <div className={color + " rounded-xl px-3 py-2 text-center min-w-[70px]"}>
      <div className="text-lg font-bold leading-tight">{value}</div>
      <div className="text-xs opacity-80 leading-tight">{label}</div>
    </div>
  );

  if (!currentEvent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400">
        <div className="text-6xl mb-4">🎪</div>
        <p className="text-lg font-semibold">No Event Selected</p>
        <p className="text-sm mt-1">Please select or create an event to view the dashboard</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-500 text-sm">Loading dashboard...</p>
      </div>
    );
  }

  const dayLabel = days === null ? "--" : days < 0 ? Math.abs(days) + "d ago" : days === 0 ? "TODAY" : days + " days";
  const scores = [ts.pct, rs.pct, dns.pct];
  if (es.total > 0) scores.push(es.pct);
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const scoreColor = avgScore >= 80 ? "text-green-400" : avgScore >= 50 ? "text-yellow-400" : "text-red-400";
  const scoreBg = avgScore >= 80 ? "bg-green-400" : avgScore >= 50 ? "bg-yellow-400" : "bg-red-400";
  const scoreLabel = avgScore >= 80 ? "Excellent" : avgScore >= 60 ? "Good Progress" : avgScore >= 40 ? "Needs Attention" : "Critical";

  return (
    <div className="max-w-3xl mx-auto pb-24 px-2 sm:px-0 space-y-4">

      {/* Event Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 via-orange-600 to-yellow-500 text-white shadow-lg p-5">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
        <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/10 rounded-full translate-y-6 -translate-x-6" />
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-orange-100 text-xs font-medium uppercase tracking-wider mb-1">Current Event</p>
              <h2 className="text-xl sm:text-2xl font-bold leading-tight">{eventName}</h2>
              {currentEvent.location && <p className="text-orange-100 text-sm mt-1">📍 {currentEvent.location}</p>}
              {currentEvent.date && (
                <p className="text-orange-100 text-sm mt-0.5">
                  📅 {new Date(currentEvent.date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
                </p>
              )}
            </div>
            <div className="text-center bg-white/20 backdrop-blur rounded-xl px-3 py-2 min-w-[76px] shrink-0">
              <div className="text-2xl font-extrabold text-white">{dayLabel}</div>
              <div className="text-orange-100 text-xs mt-0.5">{days === 0 ? "Event Day!" : days > 0 ? "remaining" : "completed"}</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {[
              { icon: "✅", val: ts.pct + "%", label: "Tasks" },
              { icon: "📦", val: rs.pct + "%", label: "Reqs" },
              { icon: "💰", val: dns.pct + "%", label: "Funds" },
              { icon: "🏢", val: ds.total, label: "Depts" },
            ].map((s) => (
              <div key={s.label} className="bg-white/20 backdrop-blur rounded-lg px-2 py-1.5 text-center">
                <div className="text-sm font-bold">{s.icon} {s.val}</div>
                <div className="text-xs text-orange-100">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={shareWhatsApp} className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white rounded-xl py-3 px-4 font-semibold text-sm shadow transition-all active:scale-95">
          <span className="text-lg">📤</span> Share Status
        </button>
        <button onClick={sharePendingWhatsApp} className="flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white rounded-xl py-3 px-4 font-semibold text-sm shadow transition-all active:scale-95">
          <span className="text-lg">⚠️</span> Pending Items
        </button>
      </div>

      {/* Tasks */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-800 flex items-center gap-2"><span className="text-xl">✅</span> Task Progress</h3>
          <span className="text-2xl font-extrabold text-orange-500">{ts.pct}%</span>
        </div>
        <ProgressBar pct={ts.pct} color="bg-orange-500" height="h-3" />
        <div className="flex gap-2 mt-3 flex-wrap">
          <StatBadge label="Done" value={ts.done} color="bg-green-100 text-green-700" />
          <StatBadge label="In Progress" value={ts.inProgress} color="bg-blue-100 text-blue-700" />
          <StatBadge label="Pending" value={ts.pending} color="bg-red-100 text-red-700" />
          <StatBadge label="Total" value={ts.total} color="bg-gray-100 text-gray-700" />
        </div>
        {Object.keys(ts.phases).length > 1 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">By Phase</p>
            {Object.entries(ts.phases).map(([phase, ph]) => {
              const phasePct = ph.total ? Math.round((ph.done / ph.total) * 100) : 0;
              return (
                <div key={phase}>
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span className="font-medium">{phase}</span>
                    <span>{ph.done}/{ph.total} ({phasePct}%)</span>
                  </div>
                  <ProgressBar pct={phasePct} color="bg-blue-400" height="h-2" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Departments */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-3"><span className="text-xl">🏢</span> Departments</h3>
        <div className="flex gap-2 flex-wrap mb-3">
          <StatBadge label="Total" value={ds.total} color="bg-purple-100 text-purple-700" />
          <StatBadge label="HOD Assigned" value={ds.withHOD} color="bg-green-100 text-green-700" />
          <StatBadge label="Missing HOD" value={ds.missingHOD} color={ds.missingHOD > 0 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-400"} />
        </div>
        <div className="flex items-center justify-between bg-purple-50 rounded-xl px-4 py-3">
          <span className="text-sm text-purple-700 font-medium">Total Budget</span>
          <span className="text-lg font-extrabold text-purple-700">Rs.{ds.totalBudget.toLocaleString("en-IN")}</span>
        </div>
        {ds.missingHOD > 0 && (
          <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl">
            <p className="text-xs text-red-600 font-semibold mb-2">Departments Missing HOD:</p>
            <div className="flex flex-wrap gap-1">
              {departments.filter((d) => !(d.hodName || d.hod || "").trim()).map((d) => (
                <span key={d.id} className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">{d.name}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Requirements */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-800 flex items-center gap-2"><span className="text-xl">📦</span> Requirements</h3>
          <span className="text-2xl font-extrabold text-teal-500">{rs.pct}%</span>
        </div>
        <ProgressBar pct={rs.pct} color="bg-teal-500" height="h-3" />
        <div className="flex gap-2 mt-3 flex-wrap">
          <StatBadge label="Arranged" value={rs.arranged} color="bg-green-100 text-green-700" />
          <StatBadge label="Partial" value={rs.partial} color="bg-yellow-100 text-yellow-700" />
          <StatBadge label="Pending" value={rs.pending} color="bg-red-100 text-red-700" />
          <StatBadge label="Total" value={rs.total} color="bg-gray-100 text-gray-700" />
        </div>
        <div className="flex items-center justify-between bg-teal-50 rounded-xl px-4 py-3 mt-3">
          <span className="text-sm text-teal-700 font-medium">Total Cost</span>
          <span className="text-lg font-extrabold text-teal-700">Rs.{rs.totalCost.toLocaleString("en-IN")}</span>
        </div>
      </div>

      {/* Donations */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-800 flex items-center gap-2"><span className="text-xl">💰</span> Donations vs Budget</h3>
          <span className="text-2xl font-extrabold text-yellow-500">{dns.pct}%</span>
        </div>
        <ProgressBar pct={dns.pct} color={dns.pct >= 100 ? "bg-green-500" : dns.pct >= 60 ? "bg-yellow-400" : "bg-red-400"} height="h-3" />
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-xs text-green-600 font-medium">Received</p>
            <p className="text-lg font-extrabold text-green-700">Rs.{dns.received.toLocaleString("en-IN")}</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-xs text-blue-600 font-medium">Budget Needed</p>
            <p className="text-lg font-extrabold text-blue-700">Rs.{dns.totalBudget.toLocaleString("en-IN")}</p>
          </div>
        </div>
        <div className={"mt-3 rounded-xl px-4 py-3 flex items-center justify-between " + (dns.surplus >= 0 ? "bg-green-50" : "bg-red-50")}>
          <span className={"text-sm font-semibold " + (dns.surplus >= 0 ? "text-green-700" : "text-red-700")}>{dns.surplus >= 0 ? "Surplus" : "Deficit"}</span>
          <span className={"text-lg font-extrabold " + (dns.surplus >= 0 ? "text-green-700" : "text-red-700")}>Rs.{Math.abs(dns.surplus).toLocaleString("en-IN")}</span>
        </div>
      </div>

      {/* Etiquette */}
      {es.total > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800 flex items-center gap-2"><span className="text-xl">🙏</span> Etiquette Briefings</h3>
            <span className="text-2xl font-extrabold text-indigo-500">{es.pct}%</span>
          </div>
          <ProgressBar pct={es.pct} color="bg-indigo-500" height="h-3" />
          <div className="flex gap-2 mt-3">
            <StatBadge label="Briefed" value={es.briefed} color="bg-green-100 text-green-700" />
            <StatBadge label="Pending" value={es.total - es.briefed} color="bg-red-100 text-red-700" />
            <StatBadge label="Total" value={es.total} color="bg-gray-100 text-gray-700" />
          </div>
        </div>
      )}

      {/* Crowd */}
      {cs.zones > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-3"><span className="text-xl">👥</span> Crowd Estimation</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-3xl font-extrabold text-blue-700">
                {cs.totalEstimate >= 1000 ? (cs.totalEstimate / 1000).toFixed(1) + "K" : cs.totalEstimate.toLocaleString("en-IN")}
              </p>
              <p className="text-xs text-blue-500 font-medium mt-1">Total Estimate</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 text-center">
              <p className="text-3xl font-extrabold text-purple-700">{cs.zones}</p>
              <p className="text-xs text-purple-500 font-medium mt-1">Zones / Entries</p>
            </div>
          </div>
        </div>
      )}

      

      {/* Overall Score */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-lg p-5 text-white">
        <h3 className="font-bold text-gray-200 flex items-center gap-2 mb-4"><span className="text-xl">📊</span> Overall Readiness Score</h3>
        <div className="text-center">
          <div className={"text-6xl font-black mb-2 " + scoreColor}>{avgScore}%</div>
          <div className={"text-lg font-semibold " + scoreColor}>{scoreLabel}</div>
          <div className="mt-4 w-full bg-gray-700 rounded-full h-4 overflow-hidden">
            <div className={"h-4 rounded-full transition-all duration-1000 " + scoreBg} style={{ width: avgScore + "%" }} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            {[
              { label: "Tasks", pct: ts.pct },
              { label: "Requirements", pct: rs.pct },
              { label: "Funding", pct: dns.pct },
              ...(es.total > 0 ? [{ label: "Etiquette", pct: es.pct }] : []),
            ].map((item) => (
              <div key={item.label} className="bg-gray-700/50 rounded-xl p-2">
                <div className="text-sm font-bold text-white">{item.pct}%</div>
                <div className="text-xs text-gray-400">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="h-4" />
    </div>
  );
};

export default Dashboard;
