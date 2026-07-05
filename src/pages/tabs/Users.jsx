import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot, query, updateDoc, deleteDoc, doc, addDoc } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";

const ROLES = [
  { value: "admin", label: "Admin", color: "bg-red-100 text-red-700", desc: "Full access to everything" },
  { value: "spoc", label: "SPOC", color: "bg-purple-100 text-purple-700", desc: "View all, update tasks & requirements" },
  { value: "hod", label: "HOD", color: "bg-blue-100 text-blue-700", desc: "Own department, raise requirements" },
  { value: "volunteer", label: "Volunteer", color: "bg-green-100 text-green-700", desc: "View only, update assigned tasks" },
  { value: "viewer", label: "Viewer", color: "bg-gray-100 text-gray-600", desc: "Read only access" },
];

export default function Users({ eventId }) {
  const [users, setUsers] = useState([]);
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

  const removeUser = async (uid) => {
    if (!canManage) return alert("Admin only");
    if (uid === user.uid) return alert("Cannot remove yourself!");
    if (!confirm("Remove this user's access?")) return;
    await deleteDoc(doc(db, "users", uid));
  };

  const preRegisterUser = async () => {
    if (!canManage) return alert("Admin only");
    if (!inviteEmail) return alert("Email is required!");
    const existing = users.find(u => u.email === inviteEmail.toLowerCase().trim());
    if (existing) return alert("User with this email already exists!");
    await addDoc(collection(db, "preRegistered"), {
      email: inviteEmail.toLowerCase().trim(),
      name: inviteName,
      role: inviteRole,
      departmentId: inviteDept,
      departmentName: depts.find(d => d.id === inviteDept)?.name || "",
      createdAt: new Date(),
      createdBy: user.uid,
    });
    alert("User pre-registered! When " + inviteEmail + " logs in with Google, they will automatically get the role: " + inviteRole);
    setInviteEmail("");
    setInviteName("");
    setInviteRole("volunteer");
    setInviteDept("");
    setShowInvite(false);
  };

  const getRoleInfo = (role) => ROLES.find(r => r.value === role) || ROLES[4];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-gray-800">👥 User Management</h2>
          <p className="text-xs text-gray-500 mt-0.5">Manage team members, assign roles and departments</p>
          <p className="text-xs text-gray-400 mt-1">{users.length} registered users</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowInvite(!showInvite)}
            className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all"
          >
            + Pre-Register User
          </button>
        )}
      </div>

      {/* Role Legend */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-[10px] uppercase text-gray-400 font-bold tracking-wider mb-2">Role Permissions</p>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          {ROLES.map(r => (
            <div key={r.value} className={`${r.color} rounded-xl px-3 py-2 text-center`}>
              <p className="text-xs font-bold">{r.label}</p>
              <p className="text-[10px] opacity-70 mt-0.5">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pre-Register Form */}
      {showInvite && canManage && (
        <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-2xl p-5 shadow-inner">
          <h3 className="text-sm font-bold text-orange-700 mb-1">✨ Pre-Register New User</h3>
          <p className="text-[11px] text-gray-500 mb-3">
            Enter their Gmail. When they sign in with Google, they will automatically get the assigned role and department.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase text-gray-500 font-bold">Gmail Address *</label>
              <input
                type="email"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:outline-none"
                placeholder="user@gmail.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-gray-500 font-bold">Display Name</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:outline-none"
                placeholder="Person's name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-gray-500 font-bold">Role *</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:outline-none"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                {ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase text-gray-500 font-bold">Assign Department (for HOD/Volunteer)</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:outline-none"
                value={inviteDept}
                onChange={(e) => setInviteDept(e.target.value)}
              >
                <option value="">-- No specific dept --</option>
                {depts.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={preRegisterUser}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow transition-all"
            >
              ✅ Pre-Register
            </button>
            <button
              onClick={() => setShowInvite(false)}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-sm px-5 py-2.5 rounded-xl transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Active Users List */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-3">✅ Active Users</h3>
        <div className="space-y-3">
          {users.map(u => {
            const roleInfo = getRoleInfo(u.role);
            const isCurrentUser = u.id === user?.uid;
            return (
              <div key={u.id} className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-all ${isCurrentUser ? "ring-2 ring-orange-300" : ""}`}>
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  {/* User Info */}
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-yellow-400 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {(u.name || u.email || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">
                        {u.name || "Unknown"}
                        {isCurrentUser && <span className="text-[10px] text-orange-500 ml-1">(You)</span>}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{u.email}</p>
                    </div>
                  </div>

                  {/* Role Selector */}
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className={`text-xs font-bold rounded-xl px-3 py-1.5 border-none ${roleInfo.color} focus:outline-none focus:ring-2 focus:ring-orange-300`}
                      value={u.role}
                      onChange={(e) => updateUser(u.id, "role", e.target.value)}
                      disabled={!canManage || isCurrentUser}
                    >
                      {ROLES.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>

                    {/* Department Assignment */}
                    <select
                      className="text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-300 max-w-[180px]"
                      value={u.departmentId || ""}
                      onChange={(e) => updateUser(u.id, "departmentId", e.target.value)}
                      disabled={!canManage}
                    >
                      <option value="">-- No Dept --</option>
                      {depts.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>

                    {/* Remove Button */}
                    {canManage && !isCurrentUser && (
                      <button
                        onClick={() => removeUser(u.id)}
                        className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg transition-all"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
