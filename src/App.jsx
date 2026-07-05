import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import PendingApproval from "./pages/PendingApproval";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import MobileNav from "./components/MobileNav";
import Departments from "./pages/tabs/Departments";
import Tasks from "./pages/tabs/Tasks";
import Requirements from "./pages/tabs/Requirements";
import Crowd from "./pages/tabs/Crowd";
import Prasadam from "./pages/tabs/Prasadam";
import Etiquette from "./pages/tabs/Etiquette";
import Donations from "./pages/tabs/Donations";
import Users from "./pages/tabs/Users";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "./firebase";

function Dashboard() {
  const [activeTab, setActiveTab] = useState("departments");
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { userData, setCurrentEventId, getRoleForEvent } = useAuth();

  useEffect(() => {
    const q = query(collection(db, "events"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const evts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Filter events - only show events user has access to
      const isSuperAdmin = userData?.globalRole === "superadmin";
      const accessibleEvents = isSuperAdmin ? evts : evts.filter(e => {
        const role = getRoleForEvent(e.id);
        return role && role !== "pending" && role !== "rejected";
      });

      setEvents(accessibleEvents);
      if (!selectedEventId && accessibleEvents.length > 0) {
        setSelectedEventId(accessibleEvents[0].id);
        setSelectedEvent(accessibleEvents[0]);
        setCurrentEventId(accessibleEvents[0].id);
      }
    });
    return () => unsub();
  }, [userData]);

  useEffect(() => {
    if (selectedEventId && events.length > 0) {
      const found = events.find(e => e.id === selectedEventId);
      setSelectedEvent(found || null);
      setCurrentEventId(selectedEventId);
    }
  }, [selectedEventId, events]);

  const renderTab = () => {
    if (!selectedEventId && activeTab !== "users") return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <span className="text-5xl mb-4">🎪</span>
        <p className="text-lg font-semibold">No event access</p>
        <p className="text-sm text-center">You don't have access to any events yet.<br/>Contact admin for access.</p>
      </div>
    );
    switch (activeTab) {
      case "departments": return <Departments eventId={selectedEventId} />;
      case "tasks": return <Tasks eventId={selectedEventId} />;
      case "requirements": return <Requirements eventId={selectedEventId} />;
      case "crowd": return <Crowd eventId={selectedEventId} event={selectedEvent} />;
      case "prasadam": return <Prasadam eventId={selectedEventId} />;
      case "etiquette": return <Etiquette eventId={selectedEventId} />;
      case "donations": return <Donations eventId={selectedEventId} />;
      case "users": return <Users eventId={selectedEventId} />;
      default: return <Departments eventId={selectedEventId} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header
        event={selectedEvent}
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          events={events}
          selectedEventId={selectedEventId}
          setSelectedEventId={setSelectedEventId}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-4">
          <div className="max-w-5xl mx-auto p-4">
            {renderTab()}
          </div>
        </main>
      </div>
      <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

function AuthWrapper() {
  const { user, userStatus } = useAuth();
  if (!user) return <Login />;
  if (userStatus === "pending" || userStatus === "rejected") return <PendingApproval />;
  return <Dashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <AuthWrapper />
    </AuthProvider>
  );
}
