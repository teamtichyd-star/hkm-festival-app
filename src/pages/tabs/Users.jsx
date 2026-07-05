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
  const [depts, setDepts] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("volunteer");
  const [inviteDept, setInviteDept] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const { userRole, user } = useAuth();
  const canManage = userRole === "admin";

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
    if (!eventId) return;
    const q = query(collection(db, "events", eventId, "departments"));
    const unsub = onSnapshot(q, (snap) => {
      setDepts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [eventId]);

  const updateUser = (uid, field, value) => {
    if (!canManage) return alert("Admin only");
    updateDoc(doc(db, "users", uid), { [field]: value });
  };

  const approveUser = async (uid, role = "viewer") => {
    if (!canManage) return alert("Admin only");
    await updateDoc(doc(db, "users", uid), { status: "approved", role });
    alert("User approved!");
  };

  const rejectUser = async (uid) => {
    if (!canManage) return alert("Admin only");
    if (!confirm("Reject this user? They will not be able to access the app.")) return;
    await updateDoc(doc(db, "users", uid), { status: "rejected" });
  };

  const removeUser = async (uid) => {
    if (!canManage) return alert("Admin only");
    if (uid === user.uid) return alert("Cannot remove yourself!");
    if (!confirm("Permanently remove this user?")) return;
    await deleteDoc(doc(db, "users", uid));
  };

  const removePreReg = async (id) => {
    if (!confirm("Remove this pre-registration?")) return;
    await deleteDoc(doc(db, "preRegistered", id));
  };

  const preRegisterUser = async () => {
    if (!canManage) return alert("Admin only");
    if (!inviteEmail) return alert("Email is required!");
    const existing = users.find(u => u.email === inviteEmail.toLowerCase().trim());
    if (existing) return alert("User with this email already exists!");
    const existingPre = preRegistered.find(p => p.email === inviteEmail.toLowerCase().trim());
    if (existingPre) return alert("Already pre-registered!");
    await addDoc(collection(db, "preRegistered"), {
      email: inviteEmail.toLowerCase().trim(),
      name: inviteName,
      role: inviteRole,
      departmentId: inviteDept,
      departmentName: depts.find(d => d.id === inviteDept)?.name || "",
      createdAt: new Date(),
      createdBy: user.uid,
    });
    alert("Pre-registered! When " + inviteEmail + " signs in with Google, they'll get " + inviteRole + " role automatically.");
    setInviteEmail("");
    setInviteName("");
    setInviteRole("volunteer");
    setInviteDept("");
    setShowInvite(false);
  };

  const getRoleInfo = (role) => ROLES.find(r => r.value === role) || ROLES[4];

  const pendingUsers = users.filter(u => u.status === "pending");
  const approvedUsers = users.filter(u => u.status === "approved" || !u.status);
  const rejectedUsers = users.filter(u => u.status === "rejected");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-gray-800">👥 User Management</h2>
          <p className="text-xs text-gray-500 mt-0.5">Manage users, approve requests, assign roles</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowInvite(!showInvite)}
            className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md"
          >
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
          <p className="text-[10px] uppercase text-green-700 font-bold">Approved</p>
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
      {showInvite && canManage && (
        <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-orange-700 mb-3">✨ Pre-Register New User</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="email"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:outline-none"
              placeholder="Gmail address *"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <input
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:outline-none"
              placeholder="Display Name"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
            />
            <select
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:outline-none"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
            >
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label} - {r.desc}</option>)}
            </select>
            <select
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:outline-none"
              value={inviteDept}
              onChange={(e) => setInviteDept(e.target.value)}
            >
              <option value="">-- No department --</option>
              {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={preRegisterUser} className="bg-orange-500 text-white font-bold text-sm px-5 py-2 rounded-xl">✅ Pre-Register</button>
            <button onClick={() => setShowInvite(false)} className="bg-gray-200 text-gray-700 font-bold text-sm px-5 py-2 rounded-xl">Cancel</button>
          </div>
        </div>
      )}

      {/* Pending Approvals - PRIORITY SECTION */}
      {pendingUsers.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs">⏳ Pending Approvals</span>
            <span className="text-xs text-gray-400">({pendingUsers.length})</span>
          </h3>
          <div className="space-y-3">
            {pendingUsers.map(u => (
              <div key={u.id} className="bg-white rounded-2xl shadow-sm border-l-4 border-l-yellow-400 border border-gray-100 p-4">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                      {(u.name || u.email || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{u.name || "Unknown"}</p>
                      <p className="text-xs text-gray-400 truncate">{u.email}</p>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap gap-2">
                      <select
                        className="text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-300"
                        defaultValue="viewer"
                        onChange={(e) => u.selectedRole = e.target.value}
                      >
                        {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                      <button
                        onClick={() => approveUser(u.id, u.selectedRole || "viewer")}
                        className="text-xs bg-green-500 hover:bg-green-600 text-white font-bold px-4 py-1.5 rounded-xl shadow"
                      >
                        ✅ Approve
                      </button>
                      <button
                        onClick={() => rejectUser(u.id)}
                        className="text-xs bg-red-100 hover:bg-red-200 text-red-600 font-bold px-4 py-1.5 rounded-xl"
                      >
                        ❌ Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pre-Registered Users */}
      {preRegistered.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs">📧 Pre-Registered (Waiting to Sign In)</span>
            <span className="text-xs text-gray-400">({preRegistered.length})</span>
          </h3>
          <div className="space-y-2">
            {preRegistered.map(p => (
              <div key={p.id} className="bg-white rounded-xl border border-blue-100 p-3 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{p.email}</p>
                  <p className="text-xs text-gray-500">
                    {p.name && <span>{p.name} · </span>}
                    Will get role: <span className="font-bold text-blue-600">{p.role}</span>
                    {p.departmentName && <span> · {p.departmentName}</span>}
                  </p>
                </div>
                {canManage && (
                  <button onClick={() => removePreReg(p.id)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approved Users */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs">✅ Active Users</span>
          <span className="text-xs text-gray-400">({approvedUsers.length})</span>
        </h3>
        <div className="space-y-3">
          {approvedUsers.map(u => {
            const roleInfo = getRoleInfo(u.role);
            const isCurrentUser = u.id === user?.uid;
            return (
              <div key={u.id} className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-4 ${isCurrentUser ? "ring-2 ring-orange-300" : ""}`}>
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex items-center gap-3 flex-1">
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
                      </p>
                      <p className="text-xs text-gray-400 truncate">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      className={`text-xs font-bold rounded-xl px-3 py-1.5 border-none ${roleInfo.color} focus:outline-none focus:ring-2 focus:ring-orange-300`}
                      value={u.role || "viewer"}
                      onChange={(e) => updateUser(u.id, "role", e.target.value)}
                      disabled={!canManage || isCurrentUser}
                    >
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <select
                      className="text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-300 max-w-[150px]"
                      value={u.departmentId || ""}
                      onChange={(e) => updateUser(u.id, "departmentId", e.target.value)}
                      disabled={!canManage}
                    >
                      <option value="">-- No Dept --</option>
                      {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    {canManage && !isCurrentUser && (
                      <button onClick={() => removeUser(u.id)} className="text-xs text-red-400 hover:text-red-600 px-2">🗑️</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rejected Users */}
      {rejectedUsers.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs">❌ Rejected</span>
            <span className="text-xs text-gray-400">({rejectedUsers.length})</span>
          </h3>
          <div className="space-y-2">
            {rejectedUsers.map(u => (
              <div key={u.id} className="bg-white rounded-xl border border-red-100 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-red-500 text-xs font-bold">
                    {(u.name || u.email || "?")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{u.name}</p>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                </div>
                {canManage && (
                  <div className="flex gap-2">
                    <button onClick={() => approveUser(u.id, "viewer")} className="text-xs bg-green-500 text-white font-bold px-3 py-1 rounded-lg">Approve</button>
                    <button onClick={() => removeUser(u.id)} className="text-xs text-red-400">🗑️</button>
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
