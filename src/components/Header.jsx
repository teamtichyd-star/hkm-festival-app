import { useAuth } from "../context/AuthContext";

export default function Header({ event, onMenuClick }) {
  const { user, userRole, logout } = useAuth();

  return (
    <div className="bg-gradient-to-r from-orange-600 via-orange-500 to-yellow-500 text-white shadow-xl">
      <div className="max-w-full mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          {/* Left */}
          <div className="flex items-center gap-3">
            <button onClick={onMenuClick} className="md:hidden text-white text-2xl">
              ☰
            </button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/50 bg-white flex-shrink-0">
                <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
              </div>
              <div>
                <h1 className="text-base md:text-lg font-bold tracking-wide leading-tight">HKM - GIFTS Festivals</h1>
                {event && (
                  <p className="text-[10px] md:text-xs text-white/80 leading-tight">
                    {event.festivalName} · 📍 {event.location} · 📅 {event.date} · {event.details}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {user?.photoURL && (
              <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full border-2 border-white/50 hidden md:block" />
            )}
            <div className="text-right">
              <p className="text-[10px] md:text-xs font-medium hidden md:block">{user?.displayName}</p>
              <span className="text-[9px] md:text-[10px] bg-white/25 rounded-full px-2 py-0.5 capitalize font-semibold">
                {userRole}
              </span>
            </div>
            <button
              onClick={logout}
              className="text-[10px] bg-white/20 hover:bg-white/30 rounded-full px-2 py-1 transition-all hidden md:block"
            >
              ↪ Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
