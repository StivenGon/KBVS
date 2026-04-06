import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-3 py-4 sm:px-4 lg:px-6">
      <section className="relative grid w-full gap-6 overflow-hidden rounded-[36px] border border-white/60 bg-white/85 p-5 shadow-[0_24px_80px_rgba(15,34,64,0.18)] backdrop-blur-xl sm:p-7 lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--accent),var(--accent-strong))]" />
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.45em] text-(--accent)">KBVS</p>
            <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Duelo de mecanografía con un lenguaje visual de afiche.
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Dos entradas, una sala compartida, y una identidad inspirada en el cartel del festival: limpia, geométrica y con
              acentos naranja y azul.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.28em] text-slate-500">
            <span className="rounded-full border border-(--accent)/20 bg-(--accent)/10 px-3 py-2 text-(--accent)">
              Maestro
            </span>
            <span className="rounded-full border border-(--accent-strong)/20 bg-(--accent-strong)/10 px-3 py-2 text-(--accent-strong)">
              Jugador
            </span>
            <span className="rounded-full border border-slate-300 bg-white px-3 py-2 text-slate-600">
              Sala compartida
            </span>
          </div>
        </div>

        <div className="grid gap-4 rounded-[28px] border border-slate-200 bg-white/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:p-5">
          <div className="grid gap-3">
            <Link
              href="/master"
              className="rounded-[22px] border border-(--accent-strong)/20 bg-(--accent-strong) px-5 py-4 text-sm font-semibold text-white transition hover:brightness-105"
            >
              Abrir maestro
            </Link>
            <Link
              href="/player"
              className="rounded-[22px] border border-(--accent)/20 bg-(--accent) px-5 py-4 text-sm font-semibold text-white transition hover:brightness-105"
            >
              Entrar como jugador
            </Link>
          </div>

          <div className="grid gap-3 border-t border-slate-200 pt-4 text-sm text-slate-600 sm:grid-cols-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Visual</p>
              <p className="mt-1">Blanco, azul y naranja con bloques geométricos.</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Composición</p>
              <p className="mt-1">Paneles limpios, bordes suaves y jerarquía clara.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
