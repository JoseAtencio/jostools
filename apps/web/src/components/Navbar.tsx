"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import { setUser, logout } from "@/lib/redux/slices/authSlice";
import { setMembers, setInvites } from "@/lib/redux/slices/dropdownDataSlice";
import { getEnterprisesByOwner, getEnterprise } from "@/lib/services/enterpriseService";
import { updateUserEnterprise, getUsersByEnterprise, type AppUser } from "@/lib/services/userService";
import { createInvite, getMyActiveInvites } from "@/lib/services/inviteService";
import MemberModal from "@/components/MemberModal";
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
  const [ownedLoaded, setOwnedLoaded] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [memberEnterprises, setMemberEnterprises] = useState<Enterprise[]>([]);
  const [inviteModal, setInviteModal] = useState<{ open: boolean; phase: "loading" | "done" | "error"; code?: string; error?: string }>({ open: false, phase: "loading" });
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [membersLoading, setMembersLoading] = useState(true);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<AppUser | null>(null);
  const generateSeqRef = useRef(0);
  const generateInFlightRef = useRef(false);
  const membersInFlightRef = useRef(false);
  const invitesInFlightRef = useRef(false);
  const isOwner = !!enterprise && enterprise.ownerId === user?.uid;
  const dropdownData = useAppSelector((s) => s.dropdownData);
  const cachedMembers = enterprise ? dropdownData.members[enterprise.id] : undefined;
  const cachedInvites = enterprise ? dropdownData.invites[enterprise.id] : undefined;
  const membershipsKey = (user?.memberships || []).join(",");

  useEffect(() => {
    if (!user?.enterpriseId) return;
    getEnterprise(user.enterpriseId).then(setEnterprise);
  }, [user?.enterpriseId]);

  useEffect(() => {
    if (!ownedLoaded) return;
    const ids = membershipsKey
      .split(",")
      .filter((id) => id && !myEnterprises.some((o) => o.id === id));
    if (ids.length === 0) {
      setMemberEnterprises([]);
      return;
    }
    let cancelled = false;
    Promise.all(ids.map((id) => getEnterprise(id)))
      .then((ents) => {
        if (!cancelled) setMemberEnterprises(ents.filter((ent): ent is Enterprise => ent !== null));
      })
      .catch((err) => {
        if (!cancelled) console.error("No se pudieron cargar las empresas de membresia", err);
      });
    return () => { cancelled = true; };
  }, [membershipsKey, myEnterprises, user?.enterpriseId, ownedLoaded]);

  const loadMembers = async (force = false) => {
    if (!enterprise) return;
    if (membersInFlightRef.current && !force) return;
    const cached = dropdownData.members[enterprise.id];
    if (!force && cached && Date.now() - cached.fetchedAt < 60_000) return;
    membersInFlightRef.current = true;
    setMembersLoading(true);
    try {
      const members = await getUsersByEnterprise(enterprise.id);
      let items: AppUser[];
      if (isOwner) {
        items = [...members].sort((a, b) => {
          const aOwner = a.uid === enterprise.ownerId ? 0 : 1;
          const bOwner = b.uid === enterprise.ownerId ? 0 : 1;
          if (aOwner !== bOwner) return aOwner - bOwner;
          return a.displayName.localeCompare(b.displayName, "es");
        });
      } else {
        items = members.filter((m) => m.uid === enterprise.ownerId);
      }
      dispatch(setMembers({ enterpriseId: enterprise.id, items, fetchedAt: Date.now() }));
    } catch (err) {
      console.error("No se pudieron cargar los miembros", err);
    } finally {
      membersInFlightRef.current = false;
      setMembersLoading(false);
    }
  };

  const loadInvites = async (force = false) => {
    if (!isOwner || !enterprise) return;
    if (invitesInFlightRef.current && !force) return;
    const cached = dropdownData.invites[enterprise.id];
    if (!force && cached && Date.now() - cached.fetchedAt < 60_000) return;
    invitesInFlightRef.current = true;
    setInvitesLoading(true);
    try {
      const invites = await getMyActiveInvites(enterprise.id, user?.uid || "");
      dispatch(setInvites({ enterpriseId: enterprise.id, items: invites, fetchedAt: Date.now() }));
    } catch (err) {
      console.error("No se pudieron cargar los codigos de invitacion", err);
    } finally {
      invitesInFlightRef.current = false;
      setInvitesLoading(false);
    }
  };

  useEffect(() => {
    if (!showDropdown) return;
    if (!isOwner || !enterprise) return;
    loadInvites(false);
  }, [showDropdown, isOwner, enterprise?.id, user?.uid, cachedInvites?.fetchedAt ?? 0]);

  useEffect(() => {
    if (!showDropdown || !enterprise) return;
    loadMembers(false);
  }, [showDropdown, enterprise?.id, isOwner, cachedMembers?.fetchedAt ?? 0]);

  useEffect(() => {
    if (!user?.uid) return;
    getEnterprisesByOwner(user.uid)
      .then((ents) => {
        setMyEnterprises(ents);
        setOwnedLoaded(true);
      })
      .catch((err) => console.error("No se pudieron cargar tus empresas", err));
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
    if (!user) return;
    const role = ent.ownerId === user.uid ? "owner" : "member";
    try {
      await updateUserEnterprise(user.uid, ent.id, role);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo cambiar de empresa");
      return;
    }
    dispatch(setUser({
      ...user,
      enterpriseId: ent.id,
      role,
    }));
    setEnterprise(ent);
    setShowDropdown(false);
    router.refresh();
    window.location.reload();
  };

  const handleOpenGenerate = async () => {
    if (!enterprise || !user || generateInFlightRef.current) return;
    generateInFlightRef.current = true;
    const seq = ++generateSeqRef.current;
    setInviteModal({ open: true, phase: "loading" });
    try {
      const code = await createInvite(enterprise.id, user.uid);
      if (generateSeqRef.current !== seq) return;
      setInviteModal({ open: true, phase: "done", code });
    } catch (err) {
      if (generateSeqRef.current !== seq) return;
      setInviteModal({
        open: true,
        phase: "error",
        error: err instanceof Error ? err.message : "No se pudo generar el codigo",
      });
    } finally {
      generateInFlightRef.current = false;
    }
  };

  const handleCloseInviteModal = () => {
    generateSeqRef.current++;
    setInviteModal({ open: false, phase: "loading" });
    loadInvites(true);
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode((current) => (current === code ? null : current)), 2000);
    } catch {
      alert("No se pudo copiar. Codigo: " + code);
    }
  };

  return (
    <>
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
                    {memberEnterprises.length > 0 && (
                      <>
                        <div className="p-2" style={{ borderTop: "1px solid var(--graphite-700)" }}>
                          <p className="text-[10px] font-bold uppercase tracking-wider px-2 py-1" style={{ color: "var(--graphite-500)" }}>Donde participo</p>
                        </div>
                        <div className="max-h-40 overflow-y-auto p-1">
                          {memberEnterprises.map((ent) => (
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
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate">{ent.name}</p>
                                <p className="text-[10px] truncate" style={{ color: "var(--graphite-500)" }}>{ent.address}</p>
                              </div>
                              <span className="text-[10px] flex-shrink-0" style={{ color: "var(--graphite-500)" }}>Miembro</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    {((membersLoading && !cachedMembers) || (cachedMembers && cachedMembers.items.length > 0)) && (
                      <div className="p-2" style={{ borderTop: "1px solid var(--graphite-700)" }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider px-2 py-1" style={{ color: "var(--graphite-500)" }}>Miembros</p>
                        <div className="max-h-40 overflow-y-auto px-1 pb-1 space-y-0.5">
                          {membersLoading && !cachedMembers ? (
                            <div className="flex items-center gap-2 px-2 py-1.5">
                              <svg className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: "var(--tuscan-sun-400)" }} fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                              </svg>
                              <p className="text-[10px]" style={{ color: "var(--graphite-500)" }}>Cargando...</p>
                            </div>
                          ) : (
                            cachedMembers?.items.map((m) => (
                              <button key={m.uid} type="button" onClick={() => setSelectedMember(m)} className="w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-2 cursor-pointer transition-colors" style={{ backgroundColor: "transparent" }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--graphite-700)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                              >
                                {m.photoURL ? (
                                  <img src={m.photoURL} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                                ) : (
                                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: "var(--graphite-700)", color: "var(--tuscan-sun-400)" }}>
                                    {(m.displayName || m.email || "?").charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <p className="text-sm flex-1 truncate" style={{ color: "var(--graphite-200)" }}>{m.displayName}</p>
                                {m.uid === enterprise.ownerId && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: "var(--graphite-700)", color: "var(--graphite-300)" }}>Dueño</span>
                                )}
                                {m.uid === user?.uid && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: "rgba(247, 183, 8, 0.15)", color: "var(--tuscan-sun-400)" }}>Tu</span>
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                    <div className="p-2" style={{ borderTop: "1px solid var(--graphite-700)" }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider px-2 py-1" style={{ color: "var(--graphite-500)" }}>Acciones</p>
                      <div className="space-y-1 px-1 pb-1">
                        <button onClick={() => { setShowDropdown(false); router.push("/setup?tab=create"); }} className="w-full py-2 rounded-lg text-xs font-medium cursor-pointer" style={{ backgroundColor: "var(--graphite-700)", color: "var(--graphite-200)" }}>
                          + Crear otra empresa
                        </button>
                        <button onClick={() => { setShowDropdown(false); router.push("/setup?tab=join"); }} className="w-full py-2 rounded-lg text-xs font-medium cursor-pointer" style={{ backgroundColor: "var(--graphite-700)", color: "var(--graphite-200)" }}>
                          Unirme con codigo
                        </button>
                      </div>
                    </div>
                    {isOwner && (
                      <div className="p-2" style={{ borderTop: "1px solid var(--graphite-700)" }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider px-2 py-1" style={{ color: "var(--graphite-500)" }}>Invitar miembros</p>
                        <button onClick={handleOpenGenerate} className="w-full py-2 rounded-lg text-xs font-medium cursor-pointer mb-2" style={{ backgroundColor: "var(--graphite-700)", color: "var(--graphite-200)" }}>
                          Generar codigo
                        </button>
                        <div className="px-1 space-y-1">
                          {invitesLoading && !cachedInvites ? (
                            <div className="flex items-center justify-center gap-2 px-2 py-1.5">
                              <svg className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: "var(--tuscan-sun-400)" }} fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                              </svg>
                              <p className="text-[10px]" style={{ color: "var(--graphite-500)" }}>Cargando...</p>
                            </div>
                          ) : !cachedInvites || cachedInvites.items.length === 0 ? (
                            <p className="text-[10px] text-center py-1" style={{ color: "var(--graphite-500)" }}>No hay codigos activos</p>
                          ) : (
                            cachedInvites.items.map((inv) => (
                              <div key={inv.code} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ backgroundColor: "var(--graphite-900)", border: "1px solid var(--graphite-700)" }}>
                                <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: copiedCode === inv.code ? "var(--tuscan-sun-400)" : "var(--ash-grey-400)" }} fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                <span className="font-mono text-sm flex-1 truncate" style={{ color: "var(--graphite-200)" }}>{inv.code}</span>
                                <button onClick={() => handleCopyCode(inv.code)} className="text-[10px] px-2 py-1 rounded cursor-pointer flex-shrink-0" style={{
                                  backgroundColor: copiedCode === inv.code ? "rgba(247,183,8,0.15)" : "var(--graphite-700)",
                                  color: copiedCode === inv.code ? "var(--tuscan-sun-400)" : "var(--graphite-200)",
                                }}>
                                  {copiedCode === inv.code ? "Copiado!" : "Copiar"}
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                        <p className="text-[10px] px-2 py-1" style={{ color: "var(--graphite-600)" }}>Codigo de un solo uso</p>
                      </div>
                    )}
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

    {inviteModal.open && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={handleCloseInviteModal}>
        <div className="rounded-2xl border w-full max-w-sm p-6" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-700)" }} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold" style={{ color: "var(--graphite-100)" }}>Generar codigo</h2>
            <button onClick={handleCloseInviteModal} className="p-1 rounded-lg cursor-pointer" style={{ color: "var(--graphite-500)" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--graphite-200)"; e.currentTarget.style.backgroundColor = "var(--graphite-800)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--graphite-500)"; e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {inviteModal.phase === "loading" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <svg className="w-8 h-8 animate-spin" style={{ color: "var(--tuscan-sun-400)" }} fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <p className="text-sm" style={{ color: "var(--graphite-300)" }}>Generando codigo...</p>
            </div>
          )}

          {inviteModal.phase === "done" && inviteModal.code && (
            <div className="space-y-4">
              <div className="py-4 px-2 rounded-xl" style={{ backgroundColor: "var(--graphite-950)", border: "1px solid var(--graphite-700)" }}>
                <p className="font-mono text-2xl tracking-[0.3em] text-center" style={{ color: "var(--tuscan-sun-400)" }}>{inviteModal.code}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => handleCopyCode(inviteModal.code as string)} className="flex-1 py-2.5 px-4 rounded-xl font-medium text-sm cursor-pointer" style={{
                  backgroundColor: copiedCode === inviteModal.code ? "rgba(247,183,8,0.15)" : "var(--graphite-700)",
                  color: copiedCode === inviteModal.code ? "var(--tuscan-sun-400)" : "var(--graphite-200)",
                }}>
                  {copiedCode === inviteModal.code ? "Copiado!" : "Copiar"}
                </button>
                <button onClick={handleCloseInviteModal} className="flex-1 py-2.5 px-4 rounded-xl font-medium text-sm cursor-pointer" style={{ backgroundColor: "var(--ash-grey-400)", color: "var(--graphite-950)" }}>
                  Listo
                </button>
              </div>
            </div>
          )}

          {inviteModal.phase === "error" && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl text-sm" style={{ color: "var(--raspberry-red-400)", backgroundColor: "rgba(224, 31, 95, 0.1)", border: "1px solid rgba(224, 31, 95, 0.2)" }}>
                {inviteModal.error || "No se pudo generar el codigo"}
              </div>
              <div className="flex gap-3">
                <button onClick={handleOpenGenerate} className="flex-1 py-2.5 px-4 rounded-xl font-medium text-sm cursor-pointer" style={{ backgroundColor: "var(--graphite-700)", color: "var(--graphite-200)" }}>
                  Reintentar
                </button>
                <button onClick={handleCloseInviteModal} className="px-4 py-2.5 rounded-xl font-medium text-sm cursor-pointer" style={{ backgroundColor: "var(--graphite-800)", border: "1px solid var(--graphite-600)", color: "var(--graphite-300)" }}>
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )}

    {selectedMember && enterprise && (
      <MemberModal
        member={selectedMember}
        enterpriseId={enterprise.id}
        memberIsOwner={selectedMember.uid === enterprise.ownerId}
        canRemove={isOwner && selectedMember.uid !== enterprise.ownerId}
        onRemoved={() => { setSelectedMember(null); loadMembers(true); }}
        onClose={() => setSelectedMember(null)}
      />
    )}
    </>
  );
}
