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

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const ref = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(ref);

        // Check pre-registered - MATCH BY EMAIL
        const preRegQuery = query(collection(db, "preRegistered"), where("email", "==", firebaseUser.email.toLowerCase()));
        const preRegSnap = await getDocs(preRegQuery);

        if (!snap.exists()) {
          // First-time login
          let role = "pending";
          let status = "pending";
          let assignedName = firebaseUser.displayName;
          let eventRoles = {};
          let departmentId = null;

          if (firebaseUser.email === SUPER_ADMIN_EMAIL) {
            role = "admin";
            status = "approved";
          } else if (!preRegSnap.empty) {
            const preReg = preRegSnap.docs[0].data();
            role = preReg.role || "viewer";
            status = "approved";
            if (preReg.name) assignedName = preReg.name;
            if (preReg.eventId) {
              eventRoles[preReg.eventId] = { role: preReg.role, departmentId: preReg.departmentId || null };
            }
            departmentId = preReg.departmentId || null;
            await deleteDoc(preRegSnap.docs[0].ref);
          }

          const userDoc = {
            name: assignedName,
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL,
            role: role,
            globalRole: role === "admin" ? "superadmin" : role,
            departmentId: departmentId,
            eventRoles: eventRoles,
            status: status,
            createdAt: new Date(),
          };
          await setDoc(ref, userDoc);
          setUserData(userDoc);
          setUserStatus(status);
        } else {
          // Existing user - check if pre-reg exists and MERGE
          const data = snap.data();
          if (!preRegSnap.empty && data.status === "pending") {
            const preReg = preRegSnap.docs[0].data();
            const updates = {
              status: "approved",
              role: preReg.role || "viewer",
              globalRole: preReg.role === "admin" ? "superadmin" : preReg.role,
            };
            if (preReg.name) updates.name = preReg.name;
            if (preReg.departmentId) updates.departmentId = preReg.departmentId;
            if (preReg.eventId) {
              const eventRoles = { ...(data.eventRoles || {}) };
              eventRoles[preReg.eventId] = { role: preReg.role, departmentId: preReg.departmentId || null };
              updates.eventRoles = eventRoles;
            }
            await setDoc(ref, updates, { merge: true });
            await deleteDoc(preRegSnap.docs[0].ref);
            setUserData({ ...data, ...updates });
            setUserStatus("approved");
          } else {
            setUserData(data);
            setUserStatus(data.status || "pending");
          }
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

  const userRole = userData?.globalRole === "superadmin" ? "admin" : (userData?.role || "viewer");
  const userDept = userData?.departmentId || null;

  return (
    <AuthContext.Provider value={{ user, userData, userRole, userDept, userStatus, login, logout, loading, currentEventId: null, setCurrentEventId: () => {}, getRoleForEvent: () => userRole, getDeptForEvent: () => userDept }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
