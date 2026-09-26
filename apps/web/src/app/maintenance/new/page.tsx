"use client";

import AuthGuard from "@/components/AuthGuard";
import Navbar from "@/components/Navbar";
import MaintenanceForm from "@/components/MaintenanceForm";

export default function NewMaintenancePage() {
  return (
    <AuthGuard>
      <main className="min-h-screen" style={{ backgroundColor: "var(--graphite-950)" }}>
        <Navbar />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="mb-8">
            <h1 className="text-3xl font-bold" style={{ color: "var(--graphite-50)" }}>Registrar Mantenimiento</h1>
            <p className="mt-2" style={{ color: "var(--graphite-400)" }}>
              Captura los datos del evento de taller para calcular indicadores MTBF, MTTR y MTTF
            </p>
          </div>

          <MaintenanceForm />
        </div>
      </main>
    </AuthGuard>
  );
}
