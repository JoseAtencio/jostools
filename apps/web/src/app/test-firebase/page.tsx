"use client";

import { useEffect, useState } from "react";
import { app, db } from "@/lib/firebase";

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
    <main>
      <h1>Test Firebase</h1>
      <p>{status}</p>
    </main>
  );
}
