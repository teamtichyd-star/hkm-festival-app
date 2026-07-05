const tabs = [
  { id: "departments", icon: "🏛️", label: "Depts" },
  { id: "tasks", icon: "✅", label: "Tasks" },
  { id: "requirements", icon: "📋", label: "Reqs" },
  { id: "crowd", icon: "👥", label: "Crowd" },
  { id: "prasadam", icon: "🍛", label: "Prasad" },
  { id: "etiquette", icon: "🙏", label: "Rules" },
  { id: "donations", icon: "💰", label: "Donate" },
];

export default function MobileNav({ activeTab, setActiveTab }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-xl md:hidden z-20">
      <div className="flex overflow-x-auto scrollbar-hide">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-[60px] flex flex-col items-center py-2 px-1 transition-all ${
              activeTab === tab.id
                ? "text-orange-500 border-t-2 border-orange-500 bg-orange-50/50"
                : "text-gray-400"
            }`}
          >
            <span className="text-lg">{tab.icon}</span>
            <span className="text-[9px] font-semibold mt-0.5">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
