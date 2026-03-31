import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-4 py-10 sm:px-6 lg:px-8">
      <section className="space-y-6 rounded-4xl border border-white/10 bg-(--surface) p-6 shadow-[0_30px_100px_rgba(1,8,18,0.45)] backdrop-blur-xl sm:p-8">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">KBVS</p>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">Maestro o jugador.</h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-300">Dos entradas, una sala compartida.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/master"
            className="rounded-full border border-emerald-300/30 bg-emerald-300/15 px-5 py-3 text-sm font-medium text-emerald-100 transition hover:bg-emerald-300/25"
          >
            Abrir maestro
          </Link>
          <Link
            href="/player"
            className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Entrar como jugador
          </Link>
        </div>
      </section>
    </main>
  );
}
