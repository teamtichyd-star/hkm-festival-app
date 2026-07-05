import { createContext, useContext, useEffect, useState } from "react";
import { auth, provider, db } from "../firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, collection, query, where, getDocs, deleteDoc } from "firebase/firestore";

const AuthContext = createContext();

const SUPER_ADMIN_EMAIL = "teamtic.hyd@gmail.com";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [userStatus, setUserStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentEventId, setCurrentEventId] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const ref = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          // Check pre-registration
          const preRegQuery = query(
            collection(db, "preRegistered"),
            where("email", "==", firebaseUser.email.toLowerCase())
          );
          const preRegSnap = await getDocs(preRegQuery);

          let eventRoles = {};
          let status = "pending";
          let globalRole = "pending";

          if (firebaseUser.email === SUPER_ADMIN_EMAIL) {
            globalRole = "superadmin";
            status = "approved";
          } else if (!preRegSnap.empty) {
            const preReg = preRegSnap.docs[0].data();
            status = "approved";
            if (preReg.eventId) {
              eventRoles[preReg.eventId] = {
                role: preReg.role || "viewer",
                departmentId: preReg.departmentId || null,
              };
            } else {
              globalRole = preReg.role || "viewer";
            }
            await deleteDoc(preRegSnap.docs[0].ref);
          }

          const userDoc = {
            name: firebaseUser.displayName,
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL,
            globalRole: globalRole,
            eventRoles: eventRoles,
            status: status,
            createdAt: new Date(),
          };
          await setDoc(ref, userDoc);
          setUserData(userDoc);
          setUserStatus(status);
        } else {
          const data = snap.data();
          setUserData(data);
          setUserStatus(data.status || "approved");
        }
        setUser(firebaseUser);
      } else {
        setUser(null);
        setUserData(null);
        setUserStatus(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const login = () => signInWithPopup(auth, provider);
  const logout = () => signOut(auth);

  // Get role for current event
  const getRoleForEvent = (eventId) => {
    if (!userData) return null;
    if (userData.globalRole === "superadmin") return "admin";
    if (!eventId) return userData.globalRole;
    if (userData.eventRoles && userData.eventRoles[eventId]) {
      return userData.eventRoles[eventId].role;
    }
    return userData.globalRole || "viewer";
  };

  const getDeptForEvent = (eventId) => {
    if (!userData || !eventId) return null;
    if (userData.eventRoles && userData.eventRoles[eventId]) {
      return userData.eventRoles[eventId].departmentId;
    }
    return null;
  };

  // Current event's role & dept
  const userRole = currentEventId ? getRoleForEvent(currentEventId) : (userData?.globalRole || "viewer");
  const userDept = currentEventId ? getDeptForEvent(currentEventId) : null;

  return (
    <AuthContext.Provider value={{
      user, userData, userRole, userDept, userStatus,
      login, logout, loading,
      currentEventId, setCurrentEventId,
      getRoleForEvent, getDeptForEvent,
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
