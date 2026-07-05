import { createContext, useContext, useEffect, useState } from "react";
import { auth, provider, db } from "../firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, collection, query, where, getDocs, deleteDoc } from "firebase/firestore";

const AuthContext = createContext();

const SUPER_ADMIN_EMAIL = "teamtic.hyd@gmail.com";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userDept, setUserDept] = useState(null);
  const [userStatus, setUserStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const ref = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          // First time login - check pre-registration
          const preRegQuery = query(
            collection(db, "preRegistered"),
            where("email", "==", firebaseUser.email.toLowerCase())
          );
          const preRegSnap = await getDocs(preRegQuery);

          let role = "pending";
          let departmentId = null;
          let status = "pending";

          // Super admin always gets admin role
          if (firebaseUser.email === SUPER_ADMIN_EMAIL) {
            role = "admin";
            status = "approved";
          } else if (!preRegSnap.empty) {
            // Pre-registered user - auto approve
            const preReg = preRegSnap.docs[0].data();
            role = preReg.role || "viewer";
            departmentId = preReg.departmentId || null;
            status = "approved";
            await deleteDoc(preRegSnap.docs[0].ref);
          }

          await setDoc(ref, {
            name: firebaseUser.displayName,
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL,
            role: role,
            departmentId: departmentId,
            status: status,
            createdAt: new Date(),
          });
          setUserRole(role);
          setUserDept(departmentId);
          setUserStatus(status);
        } else {
          const data = snap.data();
          setUserRole(data.role);
          setUserDept(data.departmentId);
          setUserStatus(data.status || "approved");
        }
        setUser(firebaseUser);
      } else {
        setUser(null);
        setUserRole(null);
        setUserDept(null);
        setUserStatus(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const login = () => signInWithPopup(auth, provider);
  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, userRole, userDept, userStatus, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
