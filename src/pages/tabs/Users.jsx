import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot, query, orderBy, updateDoc, deleteDoc, doc, addDoc } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import { sendWhatsAppTo } from "../../utils/whatsapp";

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
  const [inviteForm, setInviteForm] = useState({ email: "", name: "", phone: "", role: "volunteer", eventId: "" });
  const [showInvite, setShowInvite] = useState(false);
  const [expandedUser, setExpandedUser] = useState(null);
  const [search, setSearch] = useState("");
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

  // Get user's assigned departments from Department tab data
  const getUserDepartments = (userEmail) => {
    const result = {};
    events.forEach(evt => {
      const depts = allDepts[evt.id] || [];
      const userDepts = depts.filter(d => 
        d.hodEmail === userEmail || 
        d.team?.toLowerCase().includes(userEmail.toLowerCase())
      );
      if (userDepts.length > 0) result[evt.id] = userDepts;
    });
    return result;
  };

  const approveUser = async (uid, role = "viewer", customName = null, phone = null) => {
    const updates = { status: "approved", role, globalRole: role === "admin" ? "superadmin" : role };
    if (customName) updates.name = customName;
    if (phone) updates.phone = phone;
    await updateDoc(doc(db, "users", uid), updates);
    alert("Approved!");
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
    if (preReg.phone) updates.phone = preReg.phone;
    const currentUser = users.find(u => u.id === userId);
    const eventRoles = { ...(currentUser?.eventRoles || {}) };
    if (preReg.eventId) {
      eventRoles[preReg.eventId] = { role: preReg.role };
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

  const updateUserField = async (uid, field, value) => {
    await updateDoc(doc(db, "users", uid), { [field]: value });
  };

  const setEventRole = async (uid, evtId, role) => {
    const currentUser = users.find(u => u.id === uid);
    const eventRoles = { ...(currentUser?.eventRoles || {}) };
    if (role === "none") {
      delete eventRoles[evtId];
    } else {
      eventRoles[evtId] = { role };
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
    await addDoc(collection(db, "preRegistered"), {
      email: inviteForm.email.toLowerCase().trim(),
      name: inviteForm.name,
      phone: inviteForm.phone,
      role: inviteForm.role,
      eventId: inviteForm.eventId,
      createdAt: new Date(),
    });
    alert("Pre-registered!");
    setInviteForm({ email: "", name: "", phone: "", role: "volunteer", eventId: "" });
    setShowInvite(false);
  };

  const pendingUsers = users.filter(u => u.status === "pending");
  const approvedUsers = users.filter(u => u.status === "approved" || !u.status);
  const rejectedUsers = users.filter(u => u.status === "rejected");

  const filteredApproved = approvedUsers.filter(u => {
    if (!search) return true;
    const s = search.toLowerCase();
    return u.name?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s) || u.phone?.includes(s);
  });

  const findMatch = (email) => preRegistered.find(p => p.email === email?.toLowerCase());

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-gray-800">👥 User Management</h2>
          <p className="text-xs text-gray-500">Assign event access · Departments set in Departments tab</p>
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
          <h3 className="text-sm font-bold text-orange-700 mb-3">✨ Pre-Register Devotee</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input type="email" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Gmail *" value={inviteForm.email} onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})} />
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Devotee Name" value={inviteForm.name} onChange={(e) => setInviteForm({...inviteForm, name: e.target.value})} />
            <input type="tel" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="📞 Phone Number" value={inviteForm.phone} onChange={(e) => setInviteForm({...inviteForm, phone: e.target.value})} />
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={inviteForm.role} onChange={(e) => setInviteForm({...inviteForm, role: e.target.value})}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm md:col-span-2" value={inviteForm.eventId} onChange={(e) => setInviteForm({...inviteForm, eventId: e.target.value})}>
              <option value="">-- Select Event --</option>
              {events.map(e => <option key={e.id} value={e.id}>{e.festivalName} ({e.location})</option>)}
            </select>
          </div>
          <p className="text-[10px] text-gray-500 mt-2">💡 After user signs in, assign departments from the <strong>Departments tab</strong></p>
          <div className="flex gap-2 mt-3">
            <button onClick={preRegisterUser} className="bg-orange-500 text-white font-bold text-sm px-5 py-2 rounded-xl">✅ Pre-Register</button>
            <button onClick={() => setShowInvite(false)} className="bg-gray-200 text-gray-700 font-bold text-sm px-5 py-2 rounded-xl">Cancel</button>
          </div>
        </div>
      )}

      {/* Pending */}
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
                        <p className="text-xs text-green-600"><strong>{match.name}</strong> · {match.role}{match.phone && ` · 📞 ${match.phone}`}</p>
                        <button onClick={() => matchAndApprove(u.id, match.id)} className="mt-2 w-full bg-green-500 text-white font-bold text-xs py-1.5 rounded-lg">
                          ✅ Match & Approve
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="grid grid-cols-2 gap-1">
                          <input type="text" placeholder="Name" defaultValue={u.name} onBlur={(e) => u.customName = e.target.value} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5" />
                          <input type="tel" placeholder="📞 Phone" onBlur={(e) => u.customPhone = e.target.value} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5" />
                        </div>
                        <div className="flex gap-1">
                          <select onChange={(e) => u.selectedRole = e.target.value} defaultValue="viewer" className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 flex-1">
                            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                          <button onClick={() => approveUser(u.id, u.selectedRole || "viewer", u.customName || u.name, u.customPhone)} className="text-xs bg-green-500 text-white font-bold px-3 py-1.5 rounded-lg">✅ Approve</button>
                          <button onClick={() => rejectUser(u.id)} className="text-xs bg-red-100 text-red-600 font-bold px-3 py-1.5 rounded-lg">❌</button>
                        </div>
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
          <h3 className="text-sm font-bold text-blue-700 mb-2">📧 Pre-Registered (Waiting)</h3>
          <div className="space-y-2">
            {preRegistered.map(p => {
              const evt = events.find(e => e.id === p.eventId);
              return (
                <div key={p.id} className="bg-white rounded-xl border border-blue-100 p-3 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{p.name || "(no name)"}</p>
                    <p className="text-xs text-gray-500 truncate">{p.email}{p.phone && ` · 📞 ${p.phone}`}</p>
                    <p className="text-xs text-gray-500">
                      <span className="font-bold text-blue-600">{p.role}</span>
                      {evt && <span> · {evt.festivalName}</span>}
                    </p>
                  </div>
                  <button onClick={() => deleteDoc(doc(db, "preRegistered", p.id))} className="text-red-400 ml-2">✕</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search */}
      <input type="text" placeholder="🔍 Search name, email, phone..." value={search} onChange={(e) => setSearch(e.target.value)}
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-300 focus:outline-none bg-white" />

      {/* Approved */}
      <div>
        <h3 className="text-sm font-bold text-green-700 mb-2">✅ Active Users ({filteredApproved.length})</h3>
        <div className="space-y-2">
          {filteredApproved.map(u => {
            const isCurrentUser = u.id === user?.uid;
            const isSuperAdmin = u.globalRole === "superadmin" || u.role === "admin";
            const eventCount = Object.keys(u.eventRoles || {}).length;
            const expanded = expandedUser === u.id;
            const userDepts = getUserDepartments(u.email);

            return (
              <div key={u.id} className={`bg-white rounded-xl shadow-sm border border-gray-100 ${isCurrentUser ? "ring-2 ring-orange-300" : ""}`}>
                <div className="p-3 cursor-pointer" onClick={() => setExpandedUser(expanded ? null : u.id)}>
                  <div className="flex items-center gap-2">
                    {u.photoURL ? <img src={u.photoURL} className="w-10 h-10 rounded-full" alt=""/> : <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center font-bold text-orange-700">{(u.name||"?")[0]}</div>}
                    <div className="flex-1 min-w-0">
                      <input
                        className="text-sm font-bold bg-transparent border-none p-0 focus:ring-0 focus:outline-none w-full"
                        value={u.name || ""}
                        onChange={(e) => updateUserField(u.id, "name", e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Devotee Name"
                      />
                      <p className="text-xs text-gray-400 truncate">
                        {u.email} {isCurrentUser && <span className="text-orange-500">(You)</span>}
                      </p>
                      <div className="flex items-center gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="tel"
                          className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 flex-1"
                          value={u.phone || ""}
                          onChange={(e) => updateUserField(u.id, "phone", e.target.value)}
                          placeholder="📞 Phone"
                        />
                        {u.phone && (
                          <button onClick={() => sendWhatsAppTo(u.phone, `Hare Krishna ${u.name}!`)} className="bg-green-500 text-white p-1 rounded-lg text-xs">💬</button>
                        )}
                      <select
                        className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 mt-1 w-full"
                        value={u.preferredLanguage || "english"}
                        onChange={(e) => updateUserField(u.id, "preferredLanguage", e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        title="WhatsApp message language preference"
                      >
                        <option value="english">🇬🇧 English Messages</option>
                        <option value="telugu">🇮🇳 Telugu Messages</option>
                      </select>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {isSuperAdmin ? (
                          <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">SUPER ADMIN</span>
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

                {expanded && !isSuperAdmin && (
                  <div className="border-t border-gray-100 p-3 bg-gray-50/50 space-y-2">
                    <p className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">🎪 Event Access</p>
                    {events.length === 0 ? (
                      <p className="text-xs text-gray-500">No events yet</p>
                    ) : events.map(evt => {
                      const currentRole = u.eventRoles?.[evt.id]?.role || "none";
                      const hasAccess = currentRole !== "none";
                      const evtUserDepts = userDepts[evt.id] || [];

                      return (
                        <div key={evt.id} className={`rounded-xl border p-2 ${hasAccess ? "bg-white border-blue-200" : "bg-gray-50 border-gray-200"}`}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-gray-700 truncate">🎪 {evt.festivalName}</p>
                              <p className="text-[10px] text-gray-500">📍 {evt.location}</p>
                            </div>
                            <select
                              className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 ml-2 flex-shrink-0"
                              value={currentRole}
                              onChange={(e) => setEventRole(u.id, evt.id, e.target.value)}
                              disabled={isCurrentUser}
                            >
                              <option value="none">No Access</option>
                              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                          </div>

                          {hasAccess && evtUserDepts.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              <span className="text-[10px] text-gray-500">Departments assigned in Depts tab:</span>
                              {evtUserDepts.map(d => (
                                <span key={d.id} className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                                  {d.name}
                                </span>
                              ))}
                            </div>
                          )}
                          {hasAccess && evtUserDepts.length === 0 && (
                            <p className="text-[10px] text-orange-500 mt-1">💡 Not assigned to any department in this event. Go to Departments tab to assign.</p>
                          )}
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
