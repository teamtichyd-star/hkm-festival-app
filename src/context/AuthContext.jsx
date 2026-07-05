import { createContext, useContext, useEffect, useState } from "react";
import { auth, provider, db } from "../firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, collection, query, where, getDocs, deleteDoc } from "firebase/firestore";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userDept, setUserDept] = useState(null);
  const [loading, setLoading] = useState(true);

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

          let role = "viewer";
          let departmentId = null;

          if (!preRegSnap.empty) {
            const preReg = preRegSnap.docs[0].data();
            role = preReg.role || "viewer";
            departmentId = preReg.departmentId || null;
            // Delete pre-registration after use
            await deleteDoc(preRegSnap.docs[0].ref);
          }

          await setDoc(ref, {
            name: firebaseUser.displayName,
            email: firebaseUser.email,
            role: role,
            departmentId: departmentId,
            createdAt: new Date(),
          });
          setUserRole(role);
          setUserDept(departmentId);
        } else {
          setUserRole(snap.data().role);
          setUserDept(snap.data().departmentId);
        }
        setUser(firebaseUser);
      } else {
        setUser(null);
        setUserRole(null);
        setUserDept(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const login = () => signInWithPopup(auth, provider);
  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, userRole, userDept, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
