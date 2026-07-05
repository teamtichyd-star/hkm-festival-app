import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot, query, orderBy, updateDoc, deleteDoc, doc, addDoc } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";

const ROLES = [
  { value: "admin", label: "Admin", color: "bg-red-100 text-red-700" },
  { value: "spoc", label: "SPOC", color: "bg-purple-100 text-purple-700" },
  { value: "hod", label: "HOD", color: "bg-blue-100 text-blue-700" },
  { value: "volunteer", label: "Volunteer", color: "bg-green-100 text-green-700" },
  { value: "viewer", label: "Viewer", color: "bg-gray-100 text-gray-600" },
];

export default function Users({ eventId }) {
  const [users, setUsers] = useState([]);
  const [preRegistered, setPreRegistered] = useState([]);
  const [events, setEvents] = useState([]);
  const [allDepts, setAllDepts] = useState({});
  const [inviteForm, setInviteForm] = useState({ email: "", name: "", role: "volunteer", eventId: "", departmentId: "" });
  const [showInvite, setShowInvite] = useState(false);
  const [expandedUser, setExpandedUser] = useState(null);
  const { user } = useAuth();
  const isAdmin = true;

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "preRegistered"), (snap) => {
      setPreRegistered(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "events"), orderBy("createdAt", "desc")), (snap) => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Load departments for ALL events
  useEffect(() => {
    const unsubs = [];
    events.forEach(evt => {
      const unsub = onSnapshot(collection(db, "events", evt.id, "departments"), (snap) => {
        setAllDepts(prev => ({ ...prev, [evt.id]: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
      });
      unsubs.push(unsub);
    });
    return () => unsubs.forEach(u => u());
  }, [events]);

  const approveUser = async (uid, role = "viewer", customName = null) => {
    const updates = { status: "approved", role, globalRole: role === "admin" ? "superadmin" : role };
    if (customName) updates.name = customName;
    await updateDoc(doc(db, "users", uid), updates);
    alert("Approved! Now assign to events below.");
  };

  const matchAndApprove = async (userId, preRegId) => {
    const preReg = preRegistered.find(p => p.id === preRegId);
    if (!preReg) return;
    const updates = {
      status: "approved",
      role: preReg.role || "viewer",
      globalRole: preReg.role === "admin" ? "superadmin" : preReg.role,
    };
    if (preReg.name) updates.name = preReg.name;
    const currentUser = users.find(u => u.id === userId);
    const eventRoles = { ...(currentUser?.eventRoles || {}) };
    if (preReg.eventId) {
      eventRoles[preReg.eventId] = { role: preReg.role, departmentId: preReg.departmentId || null };
    }
    updates.eventRoles = eventRoles;
    await updateDoc(doc(db, "users", userId), updates);
    await deleteDoc(doc(db, "preRegistered", preRegId));
    alert("Matched and approved!");
  };

  const rejectUser = async (uid) => {
    if (!confirm("Reject this user?")) return;
    await updateDoc(doc(db, "users", uid), { status: "rejected" });
  };

  const updateRole = async (uid, role) => {
    await updateDoc(doc(db, "users", uid), { role, globalRole: role === "admin" ? "superadmin" : role });
  };

  const updateUserName = async (uid, name) => {
    await updateDoc(doc(db, "users", uid), { name });
  };

  const setEventRole = async (uid, evtId, role, departmentId = null) => {
    const currentUser = users.find(u => u.id === uid);
    const eventRoles = { ...(currentUser?.eventRoles || {}) };
    if (role === "none") {
      delete eventRoles[evtId];
    } else {
      eventRoles[evtId] = { role, departmentId: departmentId || null };
    }
    await updateDoc(doc(db, "users", uid), { eventRoles });
  };

  const removeUser = async (uid) => {
    if (uid === user.uid) return alert("Cannot remove yourself!");
    if (!confirm("Remove this user?")) return;
    await deleteDoc(doc(db, "users", uid));
  };

  const preRegisterUser = async () => {
    if (!inviteForm.email) return alert("Email required!");
    if (!inviteForm.eventId) return alert("Please select an event!");
    await addDoc(collection(db, "preRegistered"), {
      email: inviteForm.email.toLowerCase().trim(),
      name: inviteForm.name,
      role: inviteForm.role,
      eventId: inviteForm.eventId,
      departmentId: inviteForm.departmentId || "",
      createdAt: new Date(),
    });
    alert("Pre-registered!");
    setInviteForm({ email: "", name: "", role: "volunteer", eventId: "", departmentId: "" });
    setShowInvite(false);
  };

  const pendingUsers = users.filter(u => u.status === "pending");
  const approvedUsers = users.filter(u => u.status === "approved" || !u.status);
  const rejectedUsers = users.filter(u => u.status === "rejected");

  const findMatch = (email) => preRegistered.find(p => p.email === email?.toLowerCase());

  const inviteDepts = allDepts[inviteForm.eventId] || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-gray-800">👥 User Management</h2>
          <p className="text-xs text-gray-500">Event-wise access · {users.length} users</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowInvite(!showInvite)} className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md">
            + Pre-Register
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-yellow-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-yellow-600">{pendingUsers.length}</p>
          <p className="text-[10px] uppercase text-yellow-700 font-bold">Pending</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{approvedUsers.length}</p>
          <p className="text-[10px] uppercase text-green-700 font-bold">Active</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{preRegistered.length}</p>
          <p className="text-[10px] uppercase text-blue-700 font-bold">Pre-Reg</p>
        </div>
        <div className="bg-red-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-red-600">{rejectedUsers.length}</p>
          <p className="text-[10px] uppercase text-red-700 font-bold">Rejected</p>
        </div>
      </div>

      {/* Pre-Register Form */}
      {showInvite && isAdmin && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
          <h3 className="text-sm font-bold text-orange-700 mb-3">✨ Pre-Register for Specific Event</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input type="email" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Gmail *" value={inviteForm.email} onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})} />
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Devotee Name" value={inviteForm.name} onChange={(e) => setInviteForm({...inviteForm, name: e.target.value})} />
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={inviteForm.eventId} onChange={(e) => setInviteForm({...inviteForm, eventId: e.target.value, departmentId: ""})}>
              <option value="">-- Select Event *--</option>
              {events.map(e => <option key={e.id} value={e.id}>{e.festivalName} ({e.location})</option>)}
            </select>
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={inviteForm.role} onChange={(e) => setInviteForm({...inviteForm, role: e.target.value})}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm md:col-span-2" value={inviteForm.departmentId} onChange={(e) => setInviteForm({...inviteForm, departmentId: e.target.value})}>
              <option value="">-- No specific Department --</option>
              {inviteDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={preRegisterUser} className="bg-orange-500 text-white font-bold text-sm px-5 py-2 rounded-xl">✅ Pre-Register</button>
            <button onClick={() => setShowInvite(false)} className="bg-gray-200 text-gray-700 font-bold text-sm px-5 py-2 rounded-xl">Cancel</button>
          </div>
        </div>
      )}

      {/* Pending Approvals */}
      {pendingUsers.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-yellow-700 mb-2">⏳ Pending Approvals</h3>
          <div className="space-y-2">
            {pendingUsers.map(u => {
              const match = findMatch(u.email);
              return (
                <div key={u.id} className={`bg-white rounded-xl border-l-4 border border-gray-100 p-3 ${match ? "border-l-green-400 bg-green-50/30" : "border-l-yellow-400"}`}>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {u.photoURL ? <img src={u.photoURL} className="w-10 h-10 rounded-full" alt=""/> : <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center font-bold text-yellow-700">{(u.name||"?")[0]}</div>}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{u.name}</p>
                        <p className="text-xs text-gray-400 truncate">{u.email}</p>
                      </div>
                    </div>

                    {match ? (
                      <div className="bg-green-100 border border-green-300 rounded-xl p-2">
                        <p className="text-xs font-bold text-green-700 mb-1">✨ Match Found!</p>
                        <p className="text-xs text-green-600">Pre-registered as: <strong>{match.name || match.email}</strong></p>
                        <p className="text-xs text-green-600">Role: <strong>{match.role}</strong></p>
                        {match.eventId && <p className="text-xs text-green-600">Event: {events.find(e => e.id === match.eventId)?.festivalName || "-"}</p>}
                        <button onClick={() => matchAndApprove(u.id, match.id)} className="mt-2 w-full bg-green-500 text-white font-bold text-xs py-1.5 rounded-lg">
                          ✅ Match & Approve
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2 flex-wrap">
                        <input type="text" placeholder="Devotee Name" defaultValue={u.name} onBlur={(e) => u.customName = e.target.value} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 flex-1 min-w-[120px]" />
                        <select onChange={(e) => u.selectedRole = e.target.value} defaultValue="viewer" className="text-xs border border-gray-200 rounded-lg px-2 py-1.5">
                          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                        <button onClick={() => approveUser(u.id, u.selectedRole || "viewer", u.customName || u.name)} className="text-xs bg-green-500 text-white font-bold px-3 py-1.5 rounded-lg">✅ Approve</button>
                        <button onClick={() => rejectUser(u.id)} className="text-xs bg-red-100 text-red-600 font-bold px-3 py-1.5 rounded-lg">❌</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pre-Registered */}
      {preRegistered.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-blue-700 mb-2">📧 Pre-Registered (Waiting to Sign In)</h3>
          <div className="space-y-2">
            {preRegistered.map(p => {
              const evt = events.find(e => e.id === p.eventId);
              return (
                <div key={p.id} className="bg-white rounded-xl border border-blue-100 p-3 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{p.name || "(no name)"}</p>
                    <p className="text-xs text-gray-500 truncate">{p.email}</p>
                    <p className="text-xs text-gray-500">
                      <span className="font-bold text-blue-600">{p.role}</span>
                      {evt && <span> · {evt.festivalName} ({evt.location})</span>}
                    </p>
                  </div>
                  <button onClick={() => deleteDoc(doc(db, "preRegistered", p.id))} className="text-red-400 ml-2">✕</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Approved Users - with Event Assignment */}
      <div>
        <h3 className="text-sm font-bold text-green-700 mb-2">✅ Active Users - Click to assign events</h3>
        <div className="space-y-2">
          {approvedUsers.map(u => {
            const isCurrentUser = u.id === user?.uid;
            const isSuperAdmin = u.globalRole === "superadmin" || u.role === "admin";
            const eventCount = Object.keys(u.eventRoles || {}).length;
            const expanded = expandedUser === u.id;

            return (
              <div key={u.id} className={`bg-white rounded-xl shadow-sm border border-gray-100 ${isCurrentUser ? "ring-2 ring-orange-300" : ""}`}>
                {/* Header */}
                <div className="p-3 cursor-pointer" onClick={() => setExpandedUser(expanded ? null : u.id)}>
                  <div className="flex items-center gap-2">
                    {u.photoURL ? <img src={u.photoURL} className="w-10 h-10 rounded-full" alt=""/> : <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center font-bold text-orange-700">{(u.name||"?")[0]}</div>}
                    <div className="flex-1 min-w-0">
                      <input
                        className="text-sm font-bold bg-transparent border-none p-0 focus:ring-0 focus:outline-none w-full"
                        value={u.name || ""}
                        onChange={(e) => updateUserName(u.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Devotee Name"
                      />
                      <p className="text-xs text-gray-400 truncate">
                        {u.email} {isCurrentUser && <span className="text-orange-500">(You)</span>}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {isSuperAdmin ? (
                          <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">SUPER ADMIN - All Events</span>
                        ) : eventCount === 0 ? (
                          <span className="text-[10px] bg-red-100 text-red-500 px-2 py-0.5 rounded-full font-bold">⚠️ No event access</span>
                        ) : (
                          Object.entries(u.eventRoles || {}).map(([evtId, roleData]) => {
                            const evt = events.find(e => e.id === evtId);
                            if (!evt) return null;
                            return (
                              <span key={evtId} className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                                {roleData.role}@{evt.location}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <select className="text-xs border border-gray-200 rounded-lg px-2 py-1" value={u.role || "viewer"} onChange={(e) => updateRole(u.id, e.target.value)} disabled={isCurrentUser}>
                          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                        {!isCurrentUser && <button onClick={() => removeUser(u.id)} className="text-red-400">🗑️</button>}
                      </div>
                    )}
                    <span className={`text-gray-400 text-sm transition-transform ${expanded ? "rotate-180" : ""}`}>▼</span>
                  </div>
                </div>

                {/* Event Assignment */}
                {expanded && !isSuperAdmin && (
                  <div className="border-t border-gray-100 p-3 bg-gray-50/50 space-y-2">
                    <p className="text-[10px] uppercase text-gray-400 font-bold tracking-wider mb-2">🎪 Event Access</p>
                    {events.length === 0 ? (
                      <p className="text-xs text-gray-500">No events created yet</p>
                    ) : events.map(evt => {
                      const currentRole = u.eventRoles?.[evt.id]?.role || "none";
                      const currentDept = u.eventRoles?.[evt.id]?.departmentId || "";
                      const evtDepts = allDepts[evt.id] || [];
                      return (
                        <div key={evt.id} className="bg-white rounded-xl border border-gray-200 p-2">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-bold text-gray-700">🎪 {evt.festivalName}</p>
                            <p className="text-[10px] text-gray-500">📍 {evt.location}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            <select
                              className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1"
                              value={currentRole}
                              onChange={(e) => setEventRole(u.id, evt.id, e.target.value, currentDept)}
                              disabled={isCurrentUser}
                            >
                              <option value="none">-- No Access --</option>
                              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                            <select
                              className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 disabled:opacity-50"
                              value={currentDept}
                              onChange={(e) => setEventRole(u.id, evt.id, currentRole, e.target.value)}
                              disabled={currentRole === "none"}
                            >
                              <option value="">-- Any Dept --</option>
                              {evtDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {rejectedUsers.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-red-700 mb-2">❌ Rejected</h3>
          <div className="space-y-2">
            {rejectedUsers.map(u => (
              <div key={u.id} className="bg-white rounded-xl border border-red-100 p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{u.name}</p>
                  <p className="text-xs text-gray-400 truncate">{u.email}</p>
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <button onClick={() => approveUser(u.id, "viewer")} className="text-xs bg-green-500 text-white font-bold px-3 py-1 rounded-lg">Approve</button>
                    <button onClick={() => removeUser(u.id)} className="text-red-400">🗑️</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
