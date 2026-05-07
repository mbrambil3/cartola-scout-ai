import { useMemo } from "react";
import { POSICOES, POS_COLOR, type TimeEntry } from "@/lib/cartola-types";

export function AnaliticosPanel({ times: _times, posStats }: { times: TimeEntry[]; posStats: any | null }) {
  // Posições
  const ranking = useMemo(() => {
    if (!posStats?.por_posicao) return [];
    return Object.entries(posStats.por_posicao)
      .map(([pos, v]: any) => ({ pos: Number(pos), ...v }))
      .filter(p => p.qtd_amostras > 0)
      .sort((a, b) => b.media - a.media);
  }, [posStats]);

  const maxMedia = ranking[0]?.media ?? 1;
  const top = ranking[0];
  const pior = ranking[ranking.length - 1];
  const maiorRisco = useMemo(
    () => ranking.length ? [...ranking].sort((a, b) => b.desvio_padrao - a.desvio_padrao)[0] : null,
    [ranking]
  );

  return (
    <section className="space-y-6 fade-up">
      {/* Posições */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-end justify-between mb-3">
          <div>
            <h3 className="font-display text-xl tracking-wide">PONTUAÇÃO MÉDIA POR POSIÇÃO</h3>
            {posStats?.intervalo?.inicio && (
              <p className="text-xs text-muted-foreground">
                {posStats.intervalo.fim - posStats.intervalo.inicio + 1} rodada(s) analisadas · R{posStats.intervalo.inicio} a R{posStats.intervalo.fim}
              </p>
            )}
          </div>
          {top && pior && (
            <div className="flex gap-2 text-[10px] font-display">
              <span className="px-2 py-1 rounded" style={{ background: `color-mix(in oklab, ${POS_COLOR[top.pos]} 20%, transparent)`, color: POS_COLOR[top.pos] }}>TOP: {POSICOES[top.pos]}</span>
              <span className="px-2 py-1 rounded" style={{ background: `color-mix(in oklab, ${POS_COLOR[pior.pos]} 20%, transparent)`, color: POS_COLOR[pior.pos] }}>PIOR: {POSICOES[pior.pos]}</span>
            </div>
          )}
        </div>

        {ranking.length === 0 && <p className="text-sm text-muted-foreground">Sem dados ainda.</p>}

        <div className="space-y-2">
          {ranking.map(r => (
            <div key={r.pos}>
              <div className="flex items-center justify-between text-xs mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-sm" style={{ color: POS_COLOR[r.pos] }}>{POSICOES[r.pos]}</span>
                  <span className="text-muted-foreground">min {r.min.toFixed(1)} · max {r.max.toFixed(1)} · σ {r.desvio_padrao.toFixed(2)} · {r.pct_negativas.toFixed(0)}% neg</span>
                </div>
                <span className="font-mono-data text-foreground">{r.media.toFixed(2)}</span>
              </div>
              <div
                className="h-2 rounded"
                style={{
                  background: `color-mix(in oklab, ${POS_COLOR[r.pos]} 33%, transparent)`,
                  width: `${(r.media / maxMedia) * 100}%`,
                  borderRight: `2px solid ${POS_COLOR[r.pos]}`,
                }}
              />
            </div>
          ))}
        </div>

        {top && maiorRisco && (
          <div className="grid md:grid-cols-2 gap-3 mt-4">
            <div className="rounded-md border border-border p-3" style={{ background: "color-mix(in oklab, var(--primary) 8%, transparent)" }}>
              <div className="text-[10px] font-display tracking-widest text-primary mb-1">INSIGHT</div>
              <p className="text-xs">
                <span className="font-display font-bold" style={{ color: POS_COLOR[top.pos] }}>{POSICOES[top.pos]}</span> é a posição mais produtiva no período (média {top.media.toFixed(2)} pts).
              </p>
            </div>
            <div className="rounded-md border border-border p-3" style={{ background: "color-mix(in oklab, var(--rdl) 8%, transparent)" }}>
              <div className="text-[10px] font-display tracking-widest mb-1" style={{ color: "var(--rdl)" }}>RISCO × RECOMPENSA</div>
              <p className="text-xs">
                <span className="font-display font-bold" style={{ color: POS_COLOR[maiorRisco.pos] }}>{POSICOES[maiorRisco.pos]}</span> tem o maior desvio (σ {maiorRisco.desvio_padrao.toFixed(2)}) e pico de {maiorRisco.max.toFixed(1)} pts. Maior risco, maior teto.
              </p>
            </div>
          </div>
        )}
      </div>

    </section>
  );
}
