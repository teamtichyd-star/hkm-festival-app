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
  const [depts, setDepts] = useState([]);
  const [inviteForm, setInviteForm] = useState({ email: "", name: "", role: "volunteer", eventId: "", departmentId: "" });
  const [showInvite, setShowInvite] = useState(false);
  const { user, userRole } = useAuth();
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
    if (!eventId) return;
    const unsub = onSnapshot(collection(db, "events", eventId, "departments"), (snap) => {
      setDepts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [eventId]);

  const approveUser = async (uid, role = "viewer", customName = null, deptId = null) => {
    const updates = { status: "approved", role, globalRole: role === "admin" ? "superadmin" : role };
    if (customName) updates.name = customName;
    if (deptId) updates.departmentId = deptId;
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
    if (preReg.departmentId) updates.departmentId = preReg.departmentId;
    if (preReg.eventId) {
      const user = users.find(u => u.id === userId);
      const eventRoles = { ...(user?.eventRoles || {}) };
      eventRoles[preReg.eventId] = { role: preReg.role, departmentId: preReg.departmentId || null };
      updates.eventRoles = eventRoles;
    }
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
      role: inviteForm.role,
      eventId: inviteForm.eventId || "",
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

  // Find matching pre-registered for a pending user
  const findMatch = (email) => preRegistered.find(p => p.email === email?.toLowerCase());

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-gray-800">👥 User Management</h2>
          <p className="text-xs text-gray-500">{users.length} users · {pendingUsers.length} pending</p>
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
          <h3 className="text-sm font-bold text-orange-700 mb-3">✨ Pre-Register (name + email + role)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input type="email" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Gmail *" value={inviteForm.email} onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})} />
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Devotee Name" value={inviteForm.name} onChange={(e) => setInviteForm({...inviteForm, name: e.target.value})} />
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={inviteForm.role} onChange={(e) => setInviteForm({...inviteForm, role: e.target.value})}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={inviteForm.eventId} onChange={(e) => setInviteForm({...inviteForm, eventId: e.target.value})}>
              <option value="">-- All Events --</option>
              {events.map(e => <option key={e.id} value={e.id}>{e.festivalName}</option>)}
            </select>
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm md:col-span-2" value={inviteForm.departmentId} onChange={(e) => setInviteForm({...inviteForm, departmentId: e.target.value})}>
              <option value="">-- No Department --</option>
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
                        <p className="text-xs font-bold text-green-700 mb-1">✨ Auto-Match Found!</p>
                        <p className="text-xs text-green-600">Pre-registered as: <strong>{match.name || match.email}</strong></p>
                        <p className="text-xs text-green-600">Role: <strong>{match.role}</strong></p>
                        <button onClick={() => matchAndApprove(u.id, match.id)} className="mt-2 w-full bg-green-500 text-white font-bold text-xs py-1.5 rounded-lg">
                          ✅ Match & Approve as {match.name || u.name}
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2 flex-wrap">
                        <input
                          type="text"
                          placeholder="Devotee Name"
                          defaultValue={u.name}
                          onBlur={(e) => u.customName = e.target.value}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 flex-1 min-w-[120px]"
                        />
                        <select
                          onChange={(e) => u.selectedRole = e.target.value}
                          defaultValue="viewer"
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5"
                        >
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

      {/* Pre-Registered - not yet joined */}
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
                      Will be: <span className="font-bold text-blue-600">{p.role}</span>
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

      {/* Approved Users */}
      <div>
        <h3 className="text-sm font-bold text-green-700 mb-2">✅ Active Users</h3>
        <div className="space-y-2">
          {approvedUsers.map(u => (
            <div key={u.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
              <div className="flex items-center gap-2">
                {u.photoURL ? <img src={u.photoURL} className="w-10 h-10 rounded-full" alt=""/> : <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center font-bold text-orange-700">{(u.name||"?")[0]}</div>}
                <div className="flex-1 min-w-0">
                  <input
                    className="text-sm font-bold bg-transparent border-none p-0 focus:ring-0 focus:outline-none w-full"
                    value={u.name || ""}
                    onChange={(e) => updateUserName(u.id, e.target.value)}
                    placeholder="Devotee Name"
                  />
                  <p className="text-xs text-gray-400 truncate">
                    {u.email} {u.id === user?.uid && <span className="text-orange-500">(You)</span>}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex gap-1 flex-shrink-0">
                    <select className="text-xs border border-gray-200 rounded-lg px-2 py-1" value={u.role || "viewer"} onChange={(e) => updateRole(u.id, e.target.value)} disabled={u.id === user?.uid}>
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    {u.id !== user?.uid && <button onClick={() => removeUser(u.id)} className="text-red-400">🗑️</button>}
                  </div>
                )}
              </div>
            </div>
          ))}
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
