"use client";

import { useAppSelector } from "@/lib/redux/hooks";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

const publicPaths = ["/login", "/test-firebase", "/setup"];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAppSelector((state) => state.auth);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    if (!user && !publicPaths.includes(pathname)) {
      router.push("/login");
    } else if (user && pathname === "/login") {
      if (!user.enterpriseId) {
        router.push("/setup");
      } else {
        router.push("/");
      }
    } else if (user && pathname !== "/setup" && !user.enterpriseId) {
      router.push("/setup");
    } else if (user && pathname === "/setup" && user.enterpriseId) {
      router.push("/");
    }
  }, [user, loading, router, pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--graphite-950)" }}>
        <p style={{ color: "var(--graphite-400)" }}>Cargando...</p>
      </div>
    );
  }

  if (!user && !publicPaths.includes(pathname)) {
    return null;
  }

  return <>{children}</>;
}
