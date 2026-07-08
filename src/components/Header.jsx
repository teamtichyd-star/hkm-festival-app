import { useAuth } from "../context/AuthContext";
import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function Header({ event, onMenuClick, eventColor }) {
  const { user, userRole, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [saving, setSaving] = useState(false);

  const isSuperAdmin = userRole === "admin" || userRole === "superadmin";

  const startEdit = () => {
    setEditName(event?.festivalName || "");
    setEditLocation(event?.location || "");
    setEditing(true);
    setMenuOpen(false);
  };

  const saveEdit = async () => {
    if (!event?.id || !editName.trim()) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "events", event.id), {
        festivalName: editName.trim(),
        location: editLocation.trim(),
      });
      setEditing(false);
    } catch (e) {
      alert("Save failed: " + e.message);
    }
    setSaving(false);
  };

  return (
    <div className={(eventColor?.bg || "bg-orange-500") + " text-white shadow-lg relative z-30"}>
      <div className="max-w-full mx-auto px-3 py-2.5">
        <div className="flex justify-between items-center gap-2">

          {/* Left - Logo & Title */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button onClick={onMenuClick} className="md:hidden text-white text-xl flex-shrink-0">☰</button>
            <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white/40 bg-white flex-shrink-0">
              <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm md:text-base font-bold tracking-wide leading-tight truncate">HKM Festivals</h1>
              {event && !editing && (
                <div className="flex items-center gap-1">
                  <p className="text-[10px] text-white/80 leading-tight truncate">
                    {event.festivalName} · 📍 {event.location}
                  </p>
                  {isSuperAdmin && (
                    <button
                      onClick={startEdit}
                      className="text-white/60 hover:text-white text-[10px] flex-shrink-0 ml-1"
                      title="Edit event name"
                    >
                      ✏️
                    </button>
                  )}
                </div>
              )}
              {editing && (
                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Festival name"
                    className="text-[11px] text-gray-800 rounded px-1.5 py-0.5 w-36 sm:w-48 border-0 outline-none"
                    autoFocus
                  />
                  <input
                    value={editLocation}
                    onChange={e => setEditLocation(e.target.value)}
                    placeholder="Location"
                    className="text-[11px] text-gray-800 rounded px-1.5 py-0.5 w-24 sm:w-32 border-0 outline-none"
                  />
                  <button
                    onClick={saveEdit}
                    disabled={saving}
                    className="bg-white text-orange-600 text-[10px] font-bold px-2 py-0.5 rounded hover:bg-orange-50 disabled:opacity-50"
                  >
                    {saving ? "..." : "Save"}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="text-white/70 hover:text-white text-[10px] px-1"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right - Profile Dropdown */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 rounded-full pl-1 pr-2 py-1 transition-all"
            >
              {user?.photoURL ? (
                <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full border border-white/50" />
              ) : (
                <div className="w-7 h-7 bg-white/30 rounded-full flex items-center justify-center text-xs font-bold">
                  {user?.displayName?.[0] || "?"}
                </div>
              )}
              <span className="text-[10px] font-bold capitalize hidden md:block">{userRole}</span>
              <span className="text-xs">▼</span>
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-40">
                  <div className="p-4 bg-gradient-to-r from-orange-50 to-yellow-50 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      {user?.photoURL ? (
                        <img src={user.photoURL} alt="" className="w-12 h-12 rounded-full border-2 border-white shadow" />
                      ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-yellow-400 rounded-full flex items-center justify-center text-white font-bold text-lg">
                          {user?.displayName?.[0] || "?"}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate">{user?.displayName}</p>
                        <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
                        <span className={`inline-block text-[9px] font-bold uppercase mt-1 px-2 py-0.5 rounded-full ${
                          userRole === "admin" ? "bg-red-100 text-red-700" :
                          userRole === "spoc" ? "bg-purple-100 text-purple-700" :
                          userRole === "hod" ? "bg-blue-100 text-blue-700" :
                          userRole === "volunteer" ? "bg-green-100 text-green-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {userRole}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Edit event option in dropdown for admin */}
                  {isSuperAdmin && event && (
                    <button
                      onClick={startEdit}
                      className="w-full text-left text-sm text-orange-600 font-semibold hover:bg-orange-50 px-4 py-3 flex items-center gap-2 border-b border-gray-100"
                    >
                      <span>✏️</span> Edit Festival Name
                    </button>
                  )}

                  <button
                    onClick={() => { setMenuOpen(false); logout(); }}
                    className="w-full text-left text-sm text-red-500 font-semibold hover:bg-red-50 px-4 py-3 flex items-center gap-2"
                  >
                    <span>↪</span> Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Event date line - mobile */}
        {event && (
          <p className="text-[10px] text-white/70 mt-1 md:hidden truncate">
            📅 {event.date} · {event.details}
          </p>
        )}
      </div>
    </div>
  );
}
