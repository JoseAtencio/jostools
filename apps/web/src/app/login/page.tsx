"use client";

import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import { signInWithGoogle } from "@/lib/redux/slices/authSlice";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const kpis = [
  {
    label: "MTBF",
    value: "Confiabilidad",
    description: "Tiempo promedio entre fallas del vehiculo. Mide que tan confiable es la unidad antes de presentar una averia.",
    color: "var(--tuscan-sun-400)",
  },
  {
    label: "MTTR",
    value: "Eficiencia",
    description: "Tiempo promedio para reparar una falla. Indica que tan rapido resuelve el taller los problemas.",
    color: "var(--tuscan-sun-400)",
  },
  {
    label: "MTTF",
    value: "Vida Util",
    description: "Tiempo promedio de vida de componentes no reparables. Evalua la durabilidad de piezas consumibles.",
    color: "var(--tuscan-sun-400)",
  },
  {
    label: "98%",
    value: "Disponibilidad",
    description: "Porcentaje del tiempo que el vehiculo esta operativo y listo para prestar servicio en ruta.",
    color: "var(--ash-grey-400)",
  },
];

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const { loading, error, user } = useAppSelector((state) => state.auth);
  const router = useRouter();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

  const handleLogin = () => {
    console.log("[Login] Click en boton Google");
    dispatch(signInWithGoogle());
  };

  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--graphite-950)" }}>
        <p style={{ color: "var(--graphite-400)" }}>Cargando...</p>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "var(--graphite-950)" }}>
      <div className="w-full max-w-2xl text-center">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg" style={{ backgroundColor: "var(--tuscan-sun-500)", boxShadow: "0 10px 25px -5px rgba(247, 183, 8, 0.3)" }}>
            <span className="font-bold text-2xl" style={{ color: "var(--graphite-950)" }}>JT</span>
          </div>
        </div>

        {/* Titulo */}
        <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--graphite-50)" }}>JosTools</h1>
        <p className="text-lg mb-10" style={{ color: "var(--graphite-400)" }}>
          Gestion inteligente de mantenimiento de flotas vehiculares
        </p>

        {/* KPIs - fila horizontal */}
        <div className="flex gap-4 justify-center mb-10">
          {kpis.map((kpi, index) => (
            <div
              key={kpi.label}
              className="relative rounded-xl p-5 border flex-1 min-w-0 cursor-default"
              style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-700)" }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div className="text-xl font-bold" style={{ color: kpi.color }}>{kpi.label}</div>
              <div className="text-xs mt-1" style={{ color: "var(--graphite-400)" }}>{kpi.value}</div>

              {/* Tooltip */}
              {hoveredIndex === index && (
                <div
                  className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 w-64 p-3 rounded-xl text-left text-sm z-50 shadow-xl pointer-events-none"
                  style={{
                    backgroundColor: "var(--graphite-800)",
                    border: "1px solid var(--graphite-600)",
                    color: "var(--graphite-200)",
                  }}
                >
                  <div className="font-semibold mb-1" style={{ color: "var(--tuscan-sun-400)" }}>{kpi.label}</div>
                  <div>{kpi.description}</div>
                  {/* Flecha */}
                  <div
                    className="absolute left-1/2 -translate-x-1/2 top-full w-3 h-3 rotate-45"
                    style={{ backgroundColor: "var(--graphite-800)", borderRight: "1px solid var(--graphite-600)", borderBottom: "1px solid var(--graphite-600)" }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Boton Google */}
        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-4 rounded-2xl px-6 py-4 font-medium transition-all duration-300 cursor-pointer"
          style={{
            backgroundColor: "var(--graphite-800)",
            border: "1px solid var(--graphite-600)",
            color: "var(--graphite-100)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--graphite-700)";
            e.currentTarget.style.borderColor = "var(--tuscan-sun-500)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--graphite-800)";
            e.currentTarget.style.borderColor = "var(--graphite-600)";
          }}
        >
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          <span>Continuar con Google</span>
        </button>

        {error && (
          <div className="mt-5 flex items-center justify-center gap-2 text-sm p-4 rounded-xl" style={{ color: "var(--raspberry-red-400)", backgroundColor: "rgba(224, 31, 95, 0.1)", border: "1px solid rgba(224, 31, 95, 0.2)" }}>
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        <p className="mt-8 text-xs" style={{ color: "var(--graphite-500)" }}>
          Monitoreo en tiempo real &middot; Reportes automatizados &middot; Decisiones basadas en datos
        </p>
      </div>
    </div>
  );
}
