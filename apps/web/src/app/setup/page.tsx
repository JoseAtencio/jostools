"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector, useAppDispatch } from "@/lib/redux/hooks";
import { setUser } from "@/lib/redux/slices/authSlice";
import { createEnterprise } from "@/lib/services/enterpriseService";
import { updateUserEnterprise } from "@/lib/services/userService";

const inputStyle = {
  backgroundColor: "var(--graphite-800)",
  border: "1px solid var(--graphite-600)",
  color: "var(--graphite-100)",
};

export default function SetupPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    email: user?.email || "",
    industry: "",
    fleetSize: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name || !formData.address || !formData.phone) {
      setError("Nombre, direccion y telefono son requeridos");
      return;
    }

    setLoading(true);
    try {
      const enterpriseId = await createEnterprise({
        name: formData.name,
        address: formData.address,
        phone: formData.phone,
        email: formData.email,
        industry: formData.industry,
        fleetSize: formData.fleetSize,
        ownerId: user?.uid || "",
      });

      await updateUserEnterprise(user?.uid || "", enterpriseId, "owner");
      dispatch(setUser({ ...user!, enterpriseId, role: "owner" }));
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear empresa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--graphite-950)" }}>
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "var(--tuscan-sun-500)" }}>
            <span className="font-bold text-2xl" style={{ color: "var(--graphite-950)" }}>JT</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--graphite-50)" }}>Bienvenido a JosTools</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--graphite-400)" }}>
            Crea la empresa donde trabajas para empezar a registrar mantenimientos.
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--graphite-600)" }}>
            Las invitaciones de miembros estaran disponibles proximamente.
          </p>
        </div>

        <form onSubmit={handleCreate} className="rounded-2xl border p-8" style={{ backgroundColor: "var(--graphite-900)", borderColor: "var(--graphite-800)" }}>
          <h2 className="text-lg font-semibold mb-6" style={{ color: "var(--graphite-100)" }}>Datos de la Empresa</h2>

          {error && (
            <div className="mb-6 p-4 rounded-xl text-sm" style={{ color: "var(--raspberry-red-400)", backgroundColor: "rgba(224, 31, 95, 0.1)", border: "1px solid rgba(224, 31, 95, 0.2)" }}>
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--graphite-300)" }}>Nombre de la Empresa *</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Ej: Transportes ABC" required className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--graphite-300)" }}>Direccion *</label>
              <input type="text" name="address" value={formData.address} onChange={handleChange} placeholder="Direccion completa" required className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={inputStyle} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--graphite-300)" }}>Telefono *</label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="Telefono" required className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={inputStyle} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--graphite-300)" }}>Correo</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Correo de la empresa" className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={inputStyle} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--graphite-300)" }}>Industria</label>
                <select name="industry" value={formData.industry} onChange={handleChange} className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={inputStyle}>
                  <option value="">Seleccionar...</option>
                  <option value="transport">Transporte de carga</option>
                  <option value="passenger_transport">Transporte de pasajeros</option>
                  <option value="logistics">Logistica y distribucion</option>
                  <option value="construction">Construccion</option>
                  <option value="mining">Mineria</option>
                  <option value="agriculture">Agricultura y ganaderia</option>
                  <option value="forestry">Silvicultura</option>
                  <option value="oil_gas">Petroleo y gas</option>
                  <option value="utilities">Servicios publicos</option>
                  <option value="waste_management">Recoleccion de residuos</option>
                  <option value="emergency">Emergencias y seguridad</option>
                  <option value="military">Defensa y militar</option>
                  <option value="rental">Alquiler de maquinaria</option>
                  <option value="food_delivery">Distribucion de alimentos</option>
                  <option value="pharmaceutical">Farmaceutica</option>
                  <option value="manufacturing">Manufactura</option>
                  <option value="automotive">Automotriz</option>
                  <option value="maritime">Transporte maritimo</option>
                  <option value="aviation">Aviacion</option>
                  <option value="railway">Transporte ferroviario</option>
                  <option value="telecom">Telecomunicaciones</option>
                  <option value="government">Gobierno / Sector publico</option>
                  <option value="education">Educacion</option>
                  <option value="hospitality">Hoteleria y turismo</option>
                  <option value="retail">Comercio minorista</option>
                  <option value="other">Otra</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--graphite-300)" }}>Tamano de Flota</label>
                <select name="fleetSize" value={formData.fleetSize} onChange={handleChange} className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={inputStyle}>
                  <option value="">Seleccionar...</option>
                  <option value="1-5">1-5 vehiculos</option>
                  <option value="6-20">6-20 vehiculos</option>
                  <option value="21-50">21-50 vehiculos</option>
                  <option value="51-100">51-100 vehiculos</option>
                  <option value="100+">Mas de 100</option>
                </select>
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full mt-6 py-3 px-6 rounded-xl font-medium transition-all disabled:opacity-50 cursor-pointer" style={{ backgroundColor: "var(--tuscan-sun-500)", color: "var(--graphite-950)" }}>
            {loading ? "Creando..." : "Crear Empresa y Continuar"}
          </button>
        </form>
      </div>
    </div>
  );
}
