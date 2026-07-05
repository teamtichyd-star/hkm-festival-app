import { useAuth } from "../context/AuthContext";

export default function PendingApproval() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-600 via-orange-500 to-yellow-400 flex flex-col items-center justify-center p-4">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 w-full max-w-md text-center border border-white/50">
        <div className="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden border-4 border-orange-200">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-orange-400 to-yellow-400 flex items-center justify-center text-white text-3xl font-bold">
              {user?.displayName?.[0] || "?"}
            </div>
          )}
        </div>

        <div className="text-5xl mb-3">⏳</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Awaiting Approval
        </h1>
        <p className="text-sm text-gray-600 mb-1">Hare Krishna, <span className="font-bold">{user?.displayName}</span>!</p>
        <p className="text-xs text-gray-500 mb-6">
          Your login was successful, but you need admin approval before accessing the app.
        </p>

        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 text-left">
          <p className="text-[10px] uppercase text-orange-600 font-bold tracking-wider">Your Details</p>
          <div className="mt-2 space-y-1">
            <p className="text-xs text-gray-600"><span className="font-bold">Email:</span> {user?.email}</p>
            <p className="text-xs text-gray-600"><span className="font-bold">Status:</span> <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-[10px] font-bold">Pending</span></p>
          </div>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          Please contact your admin to approve your access and assign a role.
        </p>

        <button
          onClick={logout}
          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-2xl transition-all"
        >
          ↪ Logout
        </button>
      </div>

      <p className="text-white/50 text-xs mt-8 tracking-wider">
        Hare Krishna Movement · Hyderabad
      </p>
    </div>
  );
}
