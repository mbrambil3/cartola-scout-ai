import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { POSICOES, POS_COLOR, type Atleta, type TimeEntry } from "@/lib/cartola-types";
import { getPontuadosBatch } from "@/lib/cartola.functions";

type Pontuados = Record<number, Record<number, { pontuacao: number; entrou: boolean; posicao_id: number }>>;

export function MeusJogadoresPanel({ times, atletasMap }: { times: TimeEntry[]; atletasMap: Record<number, Atleta> }) {
  const fetchBatch = useServerFn(getPontuadosBatch);
  const [pontuados, setPontuados] = useState<Pontuados>({});
  const [loading, setLoading] = useState(false);

  // Times com rodada calculada (visíveis ou não — mas filtramos os ocultos para alinhar com analítico geral)
  const timesElegiveis = useMemo(
    () => times.filter(t => !t.oculto && t.rodada_calculada !== null),
    [times]
  );

  const rodadasNecessarias = useMemo(() => {
    const set = new Set<number>();
    for (const t of timesElegiveis) if (t.rodada_calculada) set.add(t.rodada_calculada);
    return Array.from(set).sort((a, b) => a - b);
  }, [timesElegiveis]);

  useEffect(() => {
    if (!rodadasNecessarias.length) { setPontuados({}); return; }
    const faltando = rodadasNecessarias.filter(r => !(r in pontuados));
    if (!faltando.length) return;
    setLoading(true);
    fetchBatch({ data: { rodadas: faltando } })
      .then(d => setPontuados(prev => ({ ...prev, ...d })))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [rodadasNecessarias.join(",")]);

  // Coleta amostras de pontuação por posição considerando APENAS jogadores titulares salvos
  // (capitão multiplica 1.5 para refletir o impacto real no time do usuário)
  const buckets = useMemo(() => {
    const b: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (const t of timesElegiveis) {
      const rod = t.rodada_calculada!;
      const mapa = pontuados[rod];
      if (!mapa) continue;
      for (const j of t.jogadores) {
        const p = mapa[j.atleta_id];
        if (!p) continue;
        // só considera quem tem pontuação registrada (entrou em campo)
        if (!p.entrou) continue;
        b[j.posicao_id]?.push(p.pontuacao);
      }
    }
    return b;
  }, [timesElegiveis, pontuados]);

  const stats = useMemo(() => {
    const out: { pos: number; media: number; min: number; max: number; desvio: number; qtd: number; pctNeg: number }[] = [];
    for (const [pos, arr] of Object.entries(buckets)) {
      const n = arr.length;
      if (!n) continue;
      const sum = arr.reduce((a, b) => a + b, 0);
      const mean = sum / n;
      const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
      out.push({
        pos: Number(pos),
        media: mean,
        min: Math.min(...arr),
        max: Math.max(...arr),
        desvio: Math.sqrt(variance),
        qtd: n,
        pctNeg: (arr.filter(x => x < 0).length / n) * 100,
      });
    }
    return out.sort((a, b) => b.media - a.media);
  }, [buckets]);

  // Top jogadores e flops, somando rendimento total dos seus jogadores escalados
  const ranking = useMemo(() => {
    const acc: Record<number, { total: number; jogos: number; apelido?: string; posicao_id: number }> = {};
    for (const t of timesElegiveis) {
      const rod = t.rodada_calculada!;
      const mapa = pontuados[rod];
      if (!mapa) continue;
      for (const j of t.jogadores) {
        const p = mapa[j.atleta_id];
        if (!p || !p.entrou) continue;
        const cur = acc[j.atleta_id] ||= { total: 0, jogos: 0, posicao_id: j.posicao_id };
        cur.total += p.pontuacao;
        cur.jogos += 1;
      }
    }
    return Object.entries(acc).map(([id, v]) => ({
      atleta_id: Number(id),
      ...v,
      media: v.total / v.jogos,
    }));
  }, [timesElegiveis, pontuados]);

  const top5 = useMemo(() => [...ranking].sort((a, b) => b.total - a.total).slice(0, 5), [ranking]);
  const flop5 = useMemo(() => [...ranking].sort((a, b) => a.total - b.total).slice(0, 5), [ranking]);

  const maxMedia = stats[0]?.media ?? 1;
  const top = stats[0];
  const pior = stats[stats.length - 1];
  const maiorRisco = useMemo(
    () => stats.length ? [...stats].sort((a, b) => b.desvio - a.desvio)[0] : null,
    [stats]
  );

  if (timesElegiveis.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Salve times com rodada calculada para ver a análise dos seus jogadores.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6 fade-up">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-end justify-between mb-3">
          <div>
            <h3 className="font-display text-xl tracking-wide">PONTUAÇÃO MÉDIA POR POSIÇÃO — SEUS JOGADORES</h3>
            <p className="text-xs text-muted-foreground">
              Baseado em {timesElegiveis.length} time(s) salvo(s) · {rodadasNecessarias.length} rodada(s) {loading && "· carregando..."}
            </p>
          </div>
          {top && pior && (
            <div className="flex gap-2 text-[10px] font-display">
              <span className="px-2 py-1 rounded" style={{ background: `color-mix(in oklab, ${POS_COLOR[top.pos]} 20%, transparent)`, color: POS_COLOR[top.pos] }}>TOP: {POSICOES[top.pos]}</span>
              <span className="px-2 py-1 rounded" style={{ background: `color-mix(in oklab, ${POS_COLOR[pior.pos]} 20%, transparent)`, color: POS_COLOR[pior.pos] }}>PIOR: {POSICOES[pior.pos]}</span>
            </div>
          )}
        </div>

        {stats.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem amostras ainda.</p>
        ) : (
          <div className="space-y-2">
            {stats.map(r => (
              <div key={r.pos}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-sm" style={{ color: POS_COLOR[r.pos] }}>{POSICOES[r.pos]}</span>
                    <span className="text-muted-foreground">{r.qtd} amostra(s) · min {r.min.toFixed(1)} · max {r.max.toFixed(1)} · σ {r.desvio.toFixed(2)} · {r.pctNeg.toFixed(0)}% neg</span>
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
        )}

        {top && maiorRisco && (
          <div className="grid md:grid-cols-2 gap-3 mt-4">
            <div className="rounded-md border border-border p-3" style={{ background: "color-mix(in oklab, var(--primary) 8%, transparent)" }}>
              <div className="text-[10px] font-display tracking-widest text-primary mb-1">SEU PONTO FORTE</div>
              <p className="text-xs">
                Seus <span className="font-display font-bold" style={{ color: POS_COLOR[top.pos] }}>{POSICOES[top.pos]}</span> rendem em média {top.media.toFixed(2)} pts por escalação.
              </p>
            </div>
            <div className="rounded-md border border-border p-3" style={{ background: "color-mix(in oklab, var(--rdl) 8%, transparent)" }}>
              <div className="text-[10px] font-display tracking-widest mb-1" style={{ color: "var(--rdl)" }}>MAIOR OSCILAÇÃO</div>
              <p className="text-xs">
                <span className="font-display font-bold" style={{ color: POS_COLOR[maiorRisco.pos] }}>{POSICOES[maiorRisco.pos]}</span> é a posição mais imprevisível dos seus times (σ {maiorRisco.desvio.toFixed(2)}).
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <h4 className="font-display tracking-wide text-sm mb-2">TOP 5 JOGADORES (mais pontuaram pra você)</h4>
          {top5.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem dados.</p>
          ) : (
            <ul className="space-y-1">
              {top5.map(j => (
                <li key={j.atleta_id} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <span className="font-display font-bold" style={{ color: POS_COLOR[j.posicao_id] }}>{POSICOES[j.posicao_id]}</span>
                    <span className="text-muted-foreground">#{j.atleta_id}</span>
                    <span className="text-[10px] text-muted-foreground">({j.jogos}x)</span>
                  </span>
                  <span className="font-mono-data text-primary">{j.total.toFixed(1)} <span className="text-muted-foreground">({j.media.toFixed(1)} méd)</span></span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <h4 className="font-display tracking-wide text-sm mb-2">FLOP 5 JOGADORES (te queimaram)</h4>
          {flop5.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem dados.</p>
          ) : (
            <ul className="space-y-1">
              {flop5.map(j => (
                <li key={j.atleta_id} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <span className="font-display font-bold" style={{ color: POS_COLOR[j.posicao_id] }}>{POSICOES[j.posicao_id]}</span>
                    <span className="text-muted-foreground">#{j.atleta_id}</span>
                    <span className="text-[10px] text-muted-foreground">({j.jogos}x)</span>
                  </span>
                  <span className="font-mono-data text-destructive">{j.total.toFixed(1)} <span className="text-muted-foreground">({j.media.toFixed(1)} méd)</span></span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
