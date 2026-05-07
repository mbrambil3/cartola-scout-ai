import { POS_COLOR, POSICOES, STATUS_MAP } from "@/lib/cartola-types";

export function PositionBadge({ posicao_id, className = "" }: { posicao_id: number; className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-display font-bold tracking-wider ${className}`}
      style={{ background: `color-mix(in oklab, ${POS_COLOR[posicao_id]} 22%, transparent)`, color: POS_COLOR[posicao_id], border: `1px solid color-mix(in oklab, ${POS_COLOR[posicao_id]} 50%, transparent)` }}
    >
      {POSICOES[posicao_id] ?? "?"}
    </span>
  );
}

export function StatusBadge({ status_id }: { status_id?: number }) {
  const s = status_id ? STATUS_MAP[status_id] : null;
  if (!s) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.cor }} />
      {s.nome}
    </span>
  );
}

export function Escudo({ src, alt, size = 18 }: { src?: string | null; alt?: string; size?: number }) {
  if (!src) return null;
  return <img src={src} alt={alt ?? ""} style={{ width: size, height: size }} className="inline-block object-contain" />;
}

export function SectionHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4 fade-up">
      <div>
        <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground tracking-wide">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Stat({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-display">{label}</div>
      <div className={`mt-1 font-mono-data text-2xl md:text-3xl ${accent ? "text-primary" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

export function Loading({ label = "CARREGANDO DADOS..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-muted-foreground">
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <span key={i} className="w-2.5 h-2.5 rounded-full bg-primary bounce-dot" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
      <span className="font-display text-xs tracking-widest">{label}</span>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center">
      <p className="font-display text-lg text-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
    </div>
  );
}
