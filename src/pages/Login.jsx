import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-600 via-orange-500 to-yellow-400 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8 animate-fade-in">
        <div className="mb-4 flex justify-center">
          <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-2xl bg-white">
            <img src="/logo.jpg" alt="Sri Sri Radha Krishna" className="w-full h-full object-cover" />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-white drop-shadow-lg tracking-wide">
          HKM - GIFTS
        </h1>
        <p className="text-white/80 text-lg font-medium mt-1">Festivals</p>
        <p className="text-white/60 text-xs mt-2 tracking-widest uppercase">
          Hare Krishna Movement
        </p>
      </div>

      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 w-full max-w-sm text-center border border-white/50">
        <div className="text-4xl mb-3">🙏</div>
        <h2 className="text-xl font-bold text-gray-800 mb-1">Hare Krishna!</h2>
        <p className="text-gray-500 text-sm mb-6">
          Sign in to manage festivals
        </p>
        <button
          onClick={login}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 hover:border-orange-400 hover:shadow-xl text-gray-700 font-semibold py-3.5 px-6 rounded-2xl transition-all duration-300 group"
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            className="w-5 h-5 group-hover:scale-110 transition-transform"
          />
          Sign in with Google
        </button>
        <p className="text-[11px] text-gray-400 mt-4 leading-relaxed">
          Access is role-based.<br />Contact admin for access.
        </p>
      </div>

      <p className="text-white/50 text-xs mt-8 tracking-wider">
        Hare Krishna Movement · Hyderabad
      </p>
    </div>
  );
}
