"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { app } from "@/lib/firebase";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import { setUser } from "@/lib/redux/slices/authSlice";
import { clearUserEnterprise } from "@/lib/services/userService";

export default function TestFirebase() {
  const [status, setStatus] = useState("Verificando...");
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  useEffect(() => {
    try {
      const config = app.options;
      if (config.apiKey && config.projectId) {
        setStatus(`Conectado a Firebase: ${config.projectId}`);
      } else {
        setStatus("Error: Variables de entorno no cargadas");
      }
    } catch (error) {
      setStatus(`Error: ${error}`);
    }
  }, []);

  const handleForgetEnterprise = async () => {
    if (!user) return;
    setResetting(true);
    setResetMsg(null);
    try {
      await clearUserEnterprise(user.uid);
      dispatch(setUser({ ...user, enterpriseId: null, role: "member" }));
      setResetMsg("Listo. Redirigiendo al formulario de empresa...");
      router.push("/setup");
    } catch (error) {
      setResetMsg(`Error: ${error instanceof Error ? error.message : error}`);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "var(--graphite-950)" }}>
      <div className="rounded-xl p-8 text-center border" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-700)" }}>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--graphite-50)" }}>Test Firebase</h1>
        <p style={{ color: "var(--graphite-400)" }}>{status}</p>

        {user && (
          <div className="mt-6 pt-6" style={{ borderTop: "1px solid var(--graphite-700)" }}>
            <p className="text-xs mb-3" style={{ color: "var(--graphite-500)" }}>
              Usuario: {user.email} · Empresa actual: {user.enterpriseId || "ninguna"}
            </p>
            <button
              onClick={handleForgetEnterprise}
              disabled={resetting || !user.enterpriseId}
              className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40 cursor-pointer"
              style={{ backgroundColor: "var(--raspberry-red-500)", color: "var(--graphite-50)" }}
            >
              {resetting ? "Limpiando..." : "Olvidar mi empresa actual"}
            </button>
            <p className="text-[11px] mt-3" style={{ color: "var(--graphite-600)" }}>
              Borra la asignacion de tu usuario y te lleva al formulario de creacion de empresa.
            </p>
            {resetMsg && <p className="text-xs mt-3" style={{ color: "var(--tuscan-sun-400)" }}>{resetMsg}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
