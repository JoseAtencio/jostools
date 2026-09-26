"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import { setUser, logout } from "@/lib/redux/slices/authSlice";
import { getEnterprisesByOwner, getEnterprise } from "@/lib/services/enterpriseService";
import type { Enterprise } from "@/types/enterprise";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/records", label: "Registros" },
  { href: "/maintenance/new", label: "Nuevo registro" },
  { href: "/help", label: "Ayuda" },
];

export default function Navbar() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { user } = useAppSelector((state) => state.auth);
  const pathname = usePathname();
  const [enterprise, setEnterprise] = useState<Enterprise | null>(null);
  const [myEnterprises, setMyEnterprises] = useState<Enterprise[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.enterpriseId) return;
    getEnterprise(user.enterpriseId).then(setEnterprise);
  }, [user?.enterpriseId]);

  useEffect(() => {
    if (!user?.uid) return;
    getEnterprisesByOwner(user.uid).then(setMyEnterprises);
  }, [user?.uid]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSwitchEnterprise = async (ent: Enterprise) => {
    dispatch(setUser({
      ...user!,
      enterpriseId: ent.id,
      role: "owner",
    }));
    setEnterprise(ent);
    setShowDropdown(false);
    router.refresh();
    window.location.reload();
  };

  return (
    <nav className="border-b" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: "var(--tuscan-sun-500)" }}>
                <span className="font-bold text-sm" style={{ color: "var(--graphite-950)" }}>JT</span>
              </div>
              <span className="text-xl font-bold" style={{ color: "var(--tuscan-sun-400)" }}>JosTools</span>
            </Link>
            <div className="hidden sm:flex items-center gap-1">
              {links.map((link) => {
                const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
                return (
                  <Link key={link.href} href={link.href} className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all" style={{
                    color: active ? "var(--graphite-950)" : "var(--graphite-400)",
                    backgroundColor: active ? "var(--tuscan-sun-500)" : "transparent",
                  }}
                    onMouseEnter={(e) => { if (!active) { e.currentTarget.style.color = "var(--graphite-200)"; e.currentTarget.style.backgroundColor = "var(--graphite-800)"; } }}
                    onMouseLeave={(e) => { if (!active) { e.currentTarget.style.color = "var(--graphite-400)"; e.currentTarget.style.backgroundColor = "transparent"; } }}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Enterprise selector */}
            {enterprise && (
              <div className="relative" ref={dropdownRef}>
                <button onClick={() => setShowDropdown(!showDropdown)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all" style={{
                  backgroundColor: showDropdown ? "var(--graphite-800)" : "transparent",
                  border: "1px solid var(--graphite-700)",
                  color: "var(--graphite-300)",
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--graphite-800)"; }}
                  onMouseLeave={(e) => { if (!showDropdown) e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  <span className="font-medium max-w-[140px] truncate">{enterprise.name}</span>
                  <svg className="w-3 h-3 transition-transform" style={{ transform: showDropdown ? "rotate(180deg)" : "rotate(0deg)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>

                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-64 rounded-xl shadow-xl overflow-hidden z-50" style={{ backgroundColor: "var(--graphite-800)", border: "1px solid var(--graphite-700)" }}>
                    <div className="p-2" style={{ borderBottom: "1px solid var(--graphite-700)" }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider px-2 py-1" style={{ color: "var(--graphite-500)" }}>Mis empresas</p>
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1">
                      {myEnterprises.map((ent) => (
                        <button key={ent.id} onClick={() => handleSwitchEnterprise(ent)} className="w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center gap-2 transition-colors cursor-pointer" style={{
                          backgroundColor: ent.id === user?.enterpriseId ? "rgba(247, 183, 8, 0.1)" : "transparent",
                          color: ent.id === user?.enterpriseId ? "var(--tuscan-sun-400)" : "var(--graphite-300)",
                        }}
                          onMouseEnter={(e) => { if (ent.id !== user?.enterpriseId) e.currentTarget.style.backgroundColor = "var(--graphite-700)"; }}
                          onMouseLeave={(e) => { if (ent.id !== user?.enterpriseId) e.currentTarget.style.backgroundColor = "transparent"; }}
                        >
                          {ent.id === user?.enterpriseId && (
                            <svg className="w-4 h-4 flex-shrink-0" style={{ color: "var(--tuscan-sun-400)" }} fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium truncate">{ent.name}</p>
                            <p className="text-[10px] truncate" style={{ color: "var(--graphite-500)" }}>{ent.address}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-3">
              {user?.photoURL && <img src={user.photoURL} alt="Avatar" className="w-9 h-9 rounded-full" style={{ border: "2px solid var(--graphite-700)" }} />}
              <div className="hidden sm:block">
                <p className="text-sm font-medium" style={{ color: "var(--graphite-100)" }}>{user?.displayName}</p>
                <p className="text-xs" style={{ color: "var(--graphite-500)" }}>{user?.email}</p>
              </div>
            </div>
            <button onClick={() => dispatch(logout())} className="text-sm px-3 py-2 rounded-xl transition-colors cursor-pointer" style={{ color: "var(--graphite-400)" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--raspberry-red-400)"; e.currentTarget.style.backgroundColor = "rgba(224, 31, 95, 0.1)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--graphite-400)"; e.currentTarget.style.backgroundColor = "transparent"; }}
            >Salir</button>
          </div>
        </div>
      </div>
    </nav>
  );
}
