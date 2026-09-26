"use client";

import { useEffect, useState } from "react";
import { app } from "@/lib/firebase";

export default function TestFirebase() {
  const [status, setStatus] = useState("Verificando...");

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

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "var(--graphite-950)" }}>
      <div className="rounded-xl p-8 text-center border" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-700)" }}>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--graphite-50)" }}>Test Firebase</h1>
        <p style={{ color: "var(--graphite-400)" }}>{status}</p>
      </div>
    </div>
  );
}
