import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot, query, updateDoc, deleteDoc, doc, addDoc } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";

const ROLES = [
  { value: "admin", label: "Admin", color: "bg-red-100 text-red-700", desc: "Full access" },
  { value: "spoc", label: "SPOC", color: "bg-purple-100 text-purple-700", desc: "Coordinator" },
  { value: "hod", label: "HOD", color: "bg-blue-100 text-blue-700", desc: "Dept head" },
  { value: "volunteer", label: "Volunteer", color: "bg-green-100 text-green-700", desc: "Team member" },
  { value: "viewer", label: "Viewer", color: "bg-gray-100 text-gray-600", desc: "Read only" },
];

export default function Users({ eventId }) {
  const [users, setUsers] = useState([]);
  const [preRegistered, setPreRegistered] = useState([]);
  const [events, setEvents] = useState([]);
  const [depts, setDepts] = useState([]);
  const [inviteForm, setInviteForm] = useState({ email: "", name: "", role: "volunteer", eventId: eventId || "", departmentId: "" });
  const [showInvite, setShowInvite] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const { userData, user } = useAuth();
  const isAdmin = userData?.globalRole === "superadmin" || 
                  (userData?.eventRoles?.[eventId]?.role === "admin");

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

  useEffect(() => {
    if (!eventId) return;
    const q = query(collection(db, "events", eventId, "departments"));
    const unsub = onSnapshot(q, (snap) => {
      setDepts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [eventId]);

  const approveUser = async (uid) => {
    if (!isAdmin) return alert("Admin only");
    await updateDoc(doc(db, "users", uid), { status: "approved" });
    alert("User approved! Now assign event roles.");
  };

  const rejectUser = async (uid) => {
    if (!isAdmin) return alert("Admin only");
    if (!confirm("Reject this user?")) return;
    await updateDoc(doc(db, "users", uid), { status: "rejected" });
  };

  const updateEventRole = async (uid, evtId, role, departmentId = null) => {
    if (!isAdmin) return alert("Admin only");
    const userDoc = users.find(u => u.id === uid);
    const eventRoles = { ...(userDoc.eventRoles || {}) };
    if (role === "none") {
      delete eventRoles[evtId];
    } else {
      eventRoles[evtId] = { role, departmentId: departmentId || null };
    }
    await updateDoc(doc(db, "users", uid), { eventRoles });
  };

  const removeUser = async (uid) => {
    if (!isAdmin) return alert("Admin only");
    if (uid === user.uid) return alert("Cannot remove yourself!");
    if (!confirm("Permanently remove this user?")) return;
    await deleteDoc(doc(db, "users", uid));
  };

  const preRegisterUser = async () => {
    if (!isAdmin) return alert("Admin only");
    if (!inviteForm.email) return alert("Email is required!");
    const existing = users.find(u => u.email === inviteForm.email.toLowerCase().trim());
    if (existing) return alert("User already exists!");
    await addDoc(collection(db, "preRegistered"), {
      email: inviteForm.email.toLowerCase().trim(),
      name: inviteForm.name,
      role: inviteForm.role,
      eventId: inviteForm.eventId,
      departmentId: inviteForm.departmentId,
      createdAt: new Date(),
      createdBy: user.uid,
    });
    alert("Pre-registered! When " + inviteForm.email + " signs in, they will get " + inviteForm.role + " role for the selected event.");
    setInviteForm({ email: "", name: "", role: "volunteer", eventId: eventId || "", departmentId: "" });
    setShowInvite(false);
  };

  const getRoleInfo = (role) => ROLES.find(r => r.value === role) || ROLES[4];

  const pendingUsers = users.filter(u => u.status === "pending");
  const approvedUsers = users.filter(u => u.status === "approved" || !u.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-gray-800">👥 User Management</h2>
          <p className="text-xs text-gray-500 mt-0.5">Event-wise permissions · Each user gets specific role per event</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowInvite(!showInvite)}
            className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md">
            + Pre-Register
          </button>
        )}
      </div>

      {/* Pre-Register Form */}
      {showInvite && isAdmin && (
        <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-orange-700 mb-3">✨ Pre-Register User for Specific Event</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input type="email" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:outline-none"
              placeholder="Gmail address *" value={inviteForm.email}
              onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})} />
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:outline-none"
              placeholder="Display Name" value={inviteForm.name}
              onChange={(e) => setInviteForm({...inviteForm, name: e.target.value})} />
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:outline-none"
              value={inviteForm.eventId} onChange={(e) => setInviteForm({...inviteForm, eventId: e.target.value})}>
              <option value="">-- Select Event --</option>
              {events.map(e => <option key={e.id} value={e.id}>{e.festivalName} - {e.location}</option>)}
            </select>
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:outline-none"
              value={inviteForm.role} onChange={(e) => setInviteForm({...inviteForm, role: e.target.value})}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label} - {r.desc}</option>)}
            </select>
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:outline-none md:col-span-2"
              value={inviteForm.departmentId} onChange={(e) => setInviteForm({...inviteForm, departmentId: e.target.value})}>
              <option value="">-- No specific department --</option>
              {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
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
          <h3 className="text-sm font-bold text-gray-700 mb-3">
            <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs">⏳ Pending Approvals ({pendingUsers.length})</span>
          </h3>
          <div className="space-y-2">
            {pendingUsers.map(u => (
              <div key={u.id} className="bg-white rounded-xl border-l-4 border-l-yellow-400 border border-gray-100 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {u.photoURL ? <img src={u.photoURL} className="w-10 h-10 rounded-full" alt=""/> : 
                      <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center font-bold text-yellow-700">{(u.name||"?")[0]}</div>}
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{u.name}</p>
                      <p className="text-xs text-gray-400 truncate">{u.email}</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button onClick={() => approveUser(u.id)} className="text-xs bg-green-500 text-white font-bold px-3 py-1.5 rounded-lg">✅ Approve</button>
                      <button onClick={() => rejectUser(u.id)} className="text-xs bg-red-100 text-red-600 font-bold px-3 py-1.5 rounded-lg">❌</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pre-Registered */}
      {preRegistered.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-700 mb-3">
            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs">📧 Pre-Registered ({preRegistered.length})</span>
          </h3>
          <div className="space-y-2">
            {preRegistered.map(p => {
              const evt = events.find(e => e.id === p.eventId);
              return (
                <div key={p.id} className="bg-white rounded-xl border border-blue-100 p-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{p.email}</p>
                    <p className="text-xs text-gray-500">
                      <span className="font-bold text-blue-600">{p.role}</span>
                      {evt && <span> for {evt.festivalName}</span>}
                    </p>
                  </div>
                  {isAdmin && (
                    <button onClick={() => deleteDoc(doc(db, "preRegistered", p.id))} className="text-red-400 text-sm">✕</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Approved Users - Event Wise */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-3">
          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs">✅ Active Users ({approvedUsers.length})</span>
        </h3>
        <p className="text-xs text-gray-500 mb-3">Click a user to manage their event-wise permissions</p>
        <div className="space-y-3">
          {approvedUsers.map(u => {
            const isCurrentUser = u.id === user?.uid;
            const isSuperAdmin = u.globalRole === "superadmin";
            const eventRolesCount = Object.keys(u.eventRoles || {}).length;
            const isEditing = editingUser === u.id;

            return (
              <div key={u.id} className={`bg-white rounded-2xl shadow-sm border border-gray-100 ${isCurrentUser ? "ring-2 ring-orange-300" : ""}`}>
                {/* User Header */}
                <div className="p-4 cursor-pointer" onClick={() => setEditingUser(isEditing ? null : u.id)}>
                  <div className="flex items-center gap-3">
                    {u.photoURL ? (
                      <img src={u.photoURL} alt="" className="w-10 h-10 rounded-full border-2 border-gray-100" />
                    ) : (
                      <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-yellow-400 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                        {(u.name || u.email || "?")[0].toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">
                        {u.name || "Unknown"}
                        {isCurrentUser && <span className="text-[10px] text-orange-500 ml-1">(You)</span>}
                        {isSuperAdmin && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full ml-1">SUPER ADMIN</span>}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{u.email}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {isSuperAdmin ? (
                          <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">Full Access to Everything</span>
                        ) : eventRolesCount === 0 ? (
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">No event access</span>
                        ) : (
                          Object.entries(u.eventRoles || {}).map(([evtId, roleData]) => {
                            const evt = events.find(e => e.id === evtId);
                            const roleInfo = getRoleInfo(roleData.role);
                            return (
                              <span key={evtId} className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${roleInfo.color}`}>
                                {roleInfo.label}@{evt?.location || "?"}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>
                    <span className={`text-gray-400 text-sm transition-transform ${isEditing ? "rotate-180" : ""}`}>▼</span>
                  </div>
                </div>

                {/* Event Roles Editor */}
                {isEditing && isAdmin && !isSuperAdmin && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50/50 space-y-3">
                    <p className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Event-Wise Permissions</p>
                    {events.length === 0 && <p className="text-xs text-gray-500">No events yet. Create an event first.</p>}
                    {events.map(evt => {
                      const currentRole = u.eventRoles?.[evt.id]?.role || "none";
                      const currentDept = u.eventRoles?.[evt.id]?.departmentId || "";
                      return (
                        <div key={evt.id} className="bg-white rounded-xl border border-gray-200 p-3">
                          <p className="text-xs font-bold text-gray-700 mb-2">🎪 {evt.festivalName}</p>
                          <p className="text-[10px] text-gray-500 mb-2">📍 {evt.location} · 📅 {evt.date}</p>
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-300"
                              value={currentRole}
                              onChange={(e) => updateEventRole(u.id, evt.id, e.target.value, currentDept)}
                              disabled={isCurrentUser}
                            >
                              <option value="none">-- No Access --</option>
                              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                            <EventDeptSelector
                              eventId={evt.id}
                              value={currentDept}
                              onChange={(deptId) => updateEventRole(u.id, evt.id, currentRole, deptId)}
                              disabled={currentRole === "none"}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {!isCurrentUser && (
                      <button onClick={() => removeUser(u.id)} className="w-full text-xs text-red-500 bg-red-50 hover:bg-red-100 font-bold py-2 rounded-xl">
                        🗑️ Remove User Completely
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Sub-component to load event's departments
function EventDeptSelector({ eventId, value, onChange, disabled }) {
  const [depts, setDepts] = useState([]);

  useEffect(() => {
    if (!eventId) return;
    const unsub = onSnapshot(collection(db, "events", eventId, "departments"), (snap) => {
      setDepts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [eventId]);

  return (
    <select
      className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-300 disabled:opacity-50"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      <option value="">-- Any Dept --</option>
      {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
    </select>
  );
}
