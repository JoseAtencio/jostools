export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "var(--graphite-950)" }}>
      <div className="text-center">
        <h1 className="text-6xl font-bold" style={{ color: "var(--tuscan-sun-400)" }}>404</h1>
        <p className="mt-4 text-lg" style={{ color: "var(--graphite-400)" }}>Pagina no encontrada</p>
        <a
          href="/"
          className="mt-6 inline-block transition-colors hover:opacity-80"
          style={{ color: "var(--tuscan-sun-400)" }}
        >
          Volver al inicio
        </a>
      </div>
    </div>
  );
}
