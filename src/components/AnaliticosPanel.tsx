import { useMemo } from "react";
import { POSICOES, POS_COLOR, type TimeEntry } from "@/lib/cartola-types";

export function AnaliticosPanel({ times, posStats }: { times: TimeEntry[]; posStats: any | null }) {
  const eligiveis = useMemo(
    () => times.filter(t => !t.oculto && t.pontuacao_final !== null && t.indice_confianca !== null),
    [times]
  );

  // Pearson
  const pearson = useMemo(() => {
    const n = eligiveis.length;
    if (n < 2) return null;
    const xs = eligiveis.map(t => t.indice_confianca!);
    const ys = eligiveis.map(t => t.pontuacao_final!);
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) { const a = xs[i] - mx, b = ys[i] - my; num += a * b; dx += a * a; dy += b * b; }
    return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : 0;
  }, [eligiveis]);

  const buckets = useMemo(() => {
    const make = (filter: (i: number) => boolean) => {
      const arr = eligiveis.filter(t => filter(t.indice_confianca!));
      const n = arr.length;
      const pts = arr.map(t => t.pontuacao_final!);
      return {
        qtd: n,
        media: n ? pts.reduce((a, b) => a + b, 0) / n : 0,
        melhor: n ? Math.max(...pts) : 0,
        pior: n ? Math.min(...pts) : 0,
      };
    };
    return {
      alto: make(i => i >= 80),
      medio: make(i => i >= 50 && i < 80),
      baixo: make(i => i < 50),
    };
  }, [eligiveis]);

  const mediaGeral = useMemo(() => {
    if (!eligiveis.length) return 0;
    return eligiveis.reduce((s, t) => s + (t.pontuacao_final ?? 0), 0) / eligiveis.length;
  }, [eligiveis]);

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

  const correlText = (r: number) => {
    const a = Math.abs(r);
    const sign = r >= 0 ? "positiva" : "negativa";
    if (a > 0.5) return `forte ${sign}`;
    if (a > 0.3) return `moderada ${sign}`;
    return `fraca ${sign}`;
  };

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

      {/* Confiança × Desempenho */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="font-display text-xl tracking-wide mb-3">ÍNDICE DE CONFIANÇA × DESEMPENHO</h3>

        {eligiveis.length < 2 ? (
          <p className="text-sm text-muted-foreground">Salve mais times com índice de confiança para ver insights.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              {([
                ["Alto (≥80%)", buckets.alto, "var(--primary)"],
                ["Médio (50-79%)", buckets.medio, "var(--rdl)"],
                ["Baixo (<50%)", buckets.baixo, "var(--destructive)"],
              ] as const).map(([label, b, color]) => (
                <div key={label} className="rounded-md border border-border p-3 bg-background/50">
                  <div className="text-[10px] font-display tracking-widest" style={{ color }}>{label}</div>
                  <div className="font-mono-data text-2xl mt-1">{b.qtd}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">média <span className="font-mono-data text-foreground">{b.media.toFixed(2)}</span></div>
                  <div className="text-[11px] text-muted-foreground">melhor <span className="font-mono-data text-foreground">{b.melhor.toFixed(1)}</span> · pior <span className="font-mono-data text-foreground">{b.pior.toFixed(1)}</span></div>
                </div>
              ))}
            </div>

            <div className="space-y-2 mt-4">
              {buckets.alto.qtd > 0 && (
                <p className="text-xs">
                  Quando você confia mais (índice ≥ 80%), seu time pontua em média <span className="font-mono-data text-primary">{buckets.alto.media.toFixed(2)}</span> pts,
                  {" "}{buckets.alto.media >= mediaGeral ? "+" : ""}{(buckets.alto.media - mediaGeral).toFixed(2)} {buckets.alto.media >= mediaGeral ? "acima" : "abaixo"} da média geral.
                </p>
              )}
              {buckets.baixo.qtd > 0 && (
                <p className="text-xs">
                  Quando seu índice é baixo (&lt; 50%), o time fez em média <span className="font-mono-data">{buckets.baixo.media.toFixed(2)}</span> pts.
                  {buckets.baixo.media < mediaGeral ? " Seu instinto está calibrado." : " Talvez você esteja sendo pessimista demais."}
                </p>
              )}
              {pearson !== null && (
                <p className="text-xs text-muted-foreground">Correlação Pearson: <span className="font-mono-data text-foreground">{pearson.toFixed(3)}</span> ({correlText(pearson)})</p>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
