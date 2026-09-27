"use client";

import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@jostools/firebase-config";
import { useAppDispatch } from "@/lib/redux/hooks";
import { setUser } from "@/lib/redux/slices/authSlice";
import { resetDropdownData } from "@/lib/redux/slices/dropdownDataSlice";
import { resetVehicles } from "@/lib/redux/slices/vehiclesSlice";
import { saveUser, getUser } from "@/lib/services/userService";

export default function AuthListener({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userData = {
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || "",
          photoURL: user.photoURL,
        };

        await saveUser(userData);
        const fullUser = await getUser(user.uid);

        dispatch(setUser({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          enterpriseId: fullUser?.enterpriseId || null,
          role: fullUser?.role || "member",
          memberships: fullUser?.memberships || [],
        }));
      } else {
        dispatch(setUser(null));
        dispatch(resetDropdownData());
        dispatch(resetVehicles());
      }
    });

    return () => unsubscribe();
  }, [dispatch]);

  return <>{children}</>;
}
