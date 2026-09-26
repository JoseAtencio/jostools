"use client";

import { useState } from "react";
import { removeMemberFromEnterprise, type AppUser } from "@/lib/services/userService";

interface MemberModalProps {
  member: AppUser;
  enterpriseId: string;
  memberIsOwner: boolean;
  canRemove: boolean;
  onRemoved: () => void;
  onClose: () => void;
}

export default function MemberModal({ member, enterpriseId, memberIsOwner, canRemove, onRemoved, onClose }: MemberModalProps) {
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRemove = async () => {
    setError(null);
    setLoading(true);
    try {
      await removeMemberFromEnterprise(member.uid, enterpriseId);
      onRemoved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar al miembro");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="rounded-2xl border w-full max-w-sm p-6" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-700)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ color: "var(--graphite-100)" }}>Miembro</h2>
          <button onClick={onClose} className="p-1 rounded-lg cursor-pointer" style={{ color: "var(--graphite-500)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--graphite-200)"; e.currentTarget.style.backgroundColor = "var(--graphite-800)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--graphite-500)"; e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          {member.photoURL ? (
            <img src={member.photoURL} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0" style={{ backgroundColor: "var(--graphite-700)", color: "var(--tuscan-sun-400)" }}>
              {(member.displayName || member.email || "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold truncate" style={{ color: "var(--graphite-100)" }}>{member.displayName}</p>
            <p className="text-sm truncate" style={{ color: "var(--graphite-400)" }}>{member.email}</p>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0" style={memberIsOwner
            ? { backgroundColor: "rgba(247, 183, 8, 0.15)", color: "var(--tuscan-sun-400)" }
            : { backgroundColor: "var(--graphite-700)", color: "var(--graphite-300)" }}
          >
            {memberIsOwner ? "Dueño" : "Miembro"}
          </span>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl text-sm" style={{ color: "var(--raspberry-red-400)", backgroundColor: "rgba(224, 31, 95, 0.1)", border: "1px solid rgba(224, 31, 95, 0.2)" }}>
            {error}
          </div>
        )}

        {!canRemove ? (
          <button onClick={onClose} className="w-full py-2.5 px-4 rounded-xl font-medium text-sm cursor-pointer" style={{ backgroundColor: "var(--graphite-700)", color: "var(--graphite-200)" }}>
            Cerrar
          </button>
        ) : confirm ? (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: "var(--graphite-300)" }}>
              Esto quita a {member.displayName} de la empresa y de su historial. Podra unirse de nuevo con un codigo nuevo.
            </p>
            <div className="flex gap-3">
              <button onClick={handleRemove} disabled={loading} className="flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition-all disabled:opacity-50 cursor-pointer" style={{ backgroundColor: "var(--raspberry-red-400)", color: "var(--graphite-950)" }}>
                {loading ? "Eliminando..." : "Si, eliminar"}
              </button>
              <button onClick={() => setConfirm(false)} disabled={loading} className="px-4 py-2.5 rounded-xl font-medium text-sm cursor-pointer" style={{ backgroundColor: "var(--graphite-800)", border: "1px solid var(--graphite-600)", color: "var(--graphite-300)" }}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirm(true)} className="w-full py-2.5 px-4 rounded-xl font-medium text-sm cursor-pointer" style={{ backgroundColor: "rgba(224, 31, 95, 0.15)", border: "1px solid rgba(224, 31, 95, 0.4)", color: "var(--raspberry-red-400)" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(224, 31, 95, 0.25)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(224, 31, 95, 0.15)"; }}
          >
            Eliminar de la empresa
          </button>
        )}
      </div>
    </div>
  );
}
