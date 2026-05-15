import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search, Plus, Trash2, BarChart3, Crown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { searchTimesCartola, getTimeHistorico, getTimeRodada } from "@/lib/cartola.functions";
import { ESQUEMAS, POSICOES, type TimeEntry } from "@/lib/cartola-types";

const STORAGE_KEY = "cartola_lab_rivais_v1";

type Rival = {
  time_id: number;
  nome: string;
  nome_cartola: string;
  escudo?: string;
};

type RodadaHist = {
  rodada: number;
  ok: boolean;
  pontos?: number;
  esquema_id?: number | null;
  capitao_id?: number | null;
  reserva_luxo_id?: number | null;
  atletas?: { atleta_id: number; apelido: string; posicao_id: number; clube_id: number; pontos: number; entrou: boolean }[];
};

function loadRivais(): Rival[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveRivais(r: Rival[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(r)); } catch {}
}

export function RivaisPanel({ times, ultimaRodada, currentResultado }: {
  times: TimeEntry[];
  ultimaRodada: number;
  currentResultado: any | null;
}) {
  const fetchSearch = useServerFn(searchTimesCartola);
  const fetchHist = useServerFn(getTimeHistorico);
  const fetchOne = useServerFn(getTimeRodada);

  const [rivais, setRivais] = useState<Rival[]>([]);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Rival[] | null>(null);
  const [directId, setDirectId] = useState("");

  // histórico por rival
  const [hist, setHist] = useState<Record<number, RodadaHist[]>>({});
  const [loadingHist, setLoadingHist] = useState<Record<number, boolean>>({});

  // comparação
  const [rivalCompare, setRivalCompare] = useState<number | null>(null);
  const [meuTimeKey, setMeuTimeKey] = useState<string>(""); // "saved:<id>" ou "ia"
  const [rIni, setRIni] = useState(1);
  const [rFim, setRFim] = useState(ultimaRodada);

  useEffect(() => { setRivais(loadRivais()); }, []);
  useEffect(() => { setRFim(ultimaRodada); }, [ultimaRodada]);

  function persist(next: Rival[]) { setRivais(next); saveRivais(next); }

  async function doSearch() {
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      const r = await fetchSearch({ data: { q: query.trim() } });
      setResults(r.times);
      if (r.times.length === 0) toast.info("Nenhum cartoleiro encontrado");
    } catch (e: any) { toast.error(e.message); }
    finally { setSearching(false); }
  }

  function addRival(r: Rival) {
    if (rivais.some(x => x.time_id === r.time_id)) { toast.info("Já adicionado"); return; }
    persist([...rivais, r]);
    toast.success(`${r.nome} adicionado`);
  }

  async function addById() {
    const id = Number(directId);
    if (!id || id < 1) { toast.error("ID inválido"); return; }
    if (rivais.some(x => x.time_id === id)) { toast.info("Já adicionado"); return; }
    try {
      const d = await fetchOne({ data: { time_id: id, rodada: ultimaRodada } });
      if (!d) { toast.error("Time não encontrado"); return; }
      const r: Rival = { time_id: d.time_id, nome: d.nome, nome_cartola: d.nome_cartola, escudo: d.escudo };
      persist([...rivais, r]);
      setDirectId("");
      toast.success(`${r.nome} adicionado`);
    } catch (e: any) { toast.error(e.message); }
  }

  async function loadHist(time_id: number) {
    if (loadingHist[time_id] || hist[time_id]) return;
    setLoadingHist(s => ({ ...s, [time_id]: true }));
    try {
      const d = await fetchHist({ data: { time_id, rodada_inicio: 1, rodada_fim: ultimaRodada } });
      setHist(s => ({ ...s, [time_id]: d.rodadas as RodadaHist[] }));
    } catch (e: any) { toast.error(e.message); }
    finally { setLoadingHist(s => ({ ...s, [time_id]: false })); }
  }

  function removeRival(id: number) {
    persist(rivais.filter(r => r.time_id !== id));
    setHist(({ [id]: _, ...rest }) => rest);
    if (rivalCompare === id) setRivalCompare(null);
  }

  // ===================== COMPARAÇÃO =====================
  const meuTimeOptions = useMemo(() => {
    const opts: { key: string; label: string; rodada: number | null; pontos: number | null; jogadores: number[]; capitao_id: number | null; rdl_id: number | null }[] = [];
    if (currentResultado) {
      const titulares = currentResultado.jogadores.map((j: any) => j.atleta_id);
      const rdl = currentResultado.reserva_luxo?.atleta_id ?? null;
      opts.push({
        key: "ia",
        label: `🧪 Time da IA (R${currentResultado.rodada} · ${currentResultado.total.toFixed(2)} pts)`,
        rodada: currentResultado.rodada,
        pontos: currentResultado.total,
        jogadores: rdl ? [...titulares, rdl] : titulares,
        capitao_id: currentResultado.capitao_id,
        rdl_id: rdl,
      });
    }
    for (const t of times) {
      if (t.pontuacao_final == null) continue;
      const titulares = t.jogadores.map(j => j.atleta_id);
      const rdl = t.rdl_posicao && t.reservas ? (t.reservas.find(x => x.posicao_id === t.rdl_posicao)?.atleta_id ?? null) : t.reserva_luxo_id;
      opts.push({
        key: `saved:${t.id}`,
        label: `💾 ${t.nome} (R${t.rodada_calculada} · ${t.pontuacao_final.toFixed(2)} pts)`,
        rodada: t.rodada_calculada,
        pontos: t.pontuacao_final,
        jogadores: rdl ? [...titulares, rdl] : titulares,
        capitao_id: t.capitao_id,
        rdl_id: rdl ?? null,
      });
    }
    return opts;
  }, [times, currentResultado]);

  const compareData = useMemo(() => {
    if (!rivalCompare) return null;
    const rivalHist = hist[rivalCompare];
    if (!rivalHist) return null;
    const meu = meuTimeOptions.find(o => o.key === meuTimeKey);
    const ini = Math.min(rIni, rFim);
    const fim = Math.max(rIni, rFim);
    const rows: any[] = [];

    for (let r = ini; r <= fim; r++) {
      const rh = rivalHist.find(x => x.rodada === r);
      const rivalPts = rh?.ok ? (rh.pontos ?? 0) : null;
      // Lista do rival (titulares + RDL)
      const rivalIds: number[] = rh?.ok && rh.atletas
        ? [...rh.atletas.map(a => a.atleta_id)]
        : [];
      // capitão acertou (positivo)?
      const capRival = rh?.ok && rh.atletas && rh.capitao_id
        ? rh.atletas.find(a => a.atleta_id === rh.capitao_id)
        : null;
      const capRivalOk = capRival ? capRival.pontos > 0 : null;

      rows.push({
        rodada: r,
        rival_pts: rivalPts,
        rival_cap_ok: capRivalOk,
        rival_ids: rivalIds,
        rival_esquema: rh?.esquema_id,
      });
    }

    // Métricas agregadas do rival
    const validas = rows.filter(r => r.rival_pts !== null);
    const rivalTotal = validas.reduce((s, r) => s + r.rival_pts, 0);
    const rivalMedia = validas.length ? rivalTotal / validas.length : 0;
    const rivalMelhor = validas.length ? Math.max(...validas.map(r => r.rival_pts)) : 0;
    const rivalPior = validas.length ? Math.min(...validas.map(r => r.rival_pts)) : 0;
    const rivalCapHits = validas.filter(r => r.rival_cap_ok === true).length;

    // Diferença média de jogadores entre rodadas consecutivas (titulares + RDL)
    let diffSum = 0, diffCount = 0;
    for (let i = 1; i < validas.length; i++) {
      const a = new Set(validas[i - 1].rival_ids);
      const b = new Set(validas[i].rival_ids);
      let diff = 0;
      for (const id of b) if (!a.has(id)) diff++;
      diffSum += diff; diffCount++;
    }
    const rivalRotatividade = diffCount ? diffSum / diffCount : 0;

    // Comparação cruzada com "meu time" (rodada única)
    let cross: any = null;
    if (meu && meu.rodada) {
      const rh = rivalHist.find(x => x.rodada === meu.rodada);
      if (rh?.ok && rh.atletas) {
        const meuSet = new Set(meu.jogadores);
        const rivalSet = new Set(rh.atletas.map(a => a.atleta_id));
        const comuns: number[] = [];
        for (const id of meuSet) if (rivalSet.has(id)) comuns.push(id);
        const meuPts = meu.pontos ?? 0;
        const rivalPts = rh.pontos ?? 0;
        const capCoincide = !!meu.capitao_id && meu.capitao_id === rh.capitao_id;
        const rdlCoincide = !!meu.rdl_id && meu.rdl_id === rh.reserva_luxo_id;
        cross = {
          rodada: meu.rodada,
          meu_pts: meuPts,
          rival_pts: rivalPts,
          diff: meuPts - rivalPts,
          comuns: comuns.length,
          total_meu: meuSet.size,
          total_rival: rivalSet.size,
          capCoincide,
          rdlCoincide,
        };
      }
    }

    return {
      rows,
      total: rivalTotal,
      media: rivalMedia,
      melhor: rivalMelhor,
      pior: rivalPior,
      capPct: validas.length ? (rivalCapHits / validas.length) * 100 : 0,
      rotatividade: rivalRotatividade,
      cross,
      validas: validas.length,
    };
  }, [rivalCompare, hist, meuTimeOptions, meuTimeKey, rIni, rFim]);

  const rivalSel = rivais.find(r => r.time_id === rivalCompare);

  return (
    <div className="space-y-4">
      {/* Busca */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="text-[11px] font-display tracking-widest text-muted-foreground">ADICIONAR RIVAL</div>
        <div className="grid sm:grid-cols-[1fr_auto] gap-2">
          <div className="flex gap-2">
            <Input placeholder="Buscar por nome do cartoleiro..." value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") doSearch(); }} />
            <Button onClick={doSearch} disabled={searching} size="sm">
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
          <div className="flex gap-2">
            <Input placeholder="ou ID do time" value={directId} onChange={e => setDirectId(e.target.value.replace(/\D/g, ""))}
              className="w-32 font-mono-data"
              onKeyDown={e => { if (e.key === "Enter") addById(); }} />
            <Button onClick={addById} size="sm" variant="outline"><Plus className="w-4 h-4" /></Button>
          </div>
        </div>

        {results && results.length > 0 && (
          <div className="border border-border rounded-md divide-y divide-border max-h-64 overflow-y-auto">
            {results.map(r => (
              <button key={r.time_id} onClick={() => addRival(r)}
                className="w-full px-3 py-2 flex items-center gap-2 hover:bg-secondary text-left transition">
                {r.escudo && <img src={r.escudo} alt="" className="w-7 h-7 rounded-full bg-secondary object-cover" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{r.nome}</div>
                  <div className="text-[10px] text-muted-foreground truncate">por {r.nome_cartola} · ID {r.time_id}</div>
                </div>
                <Plus className="w-4 h-4 text-primary" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lista de rivais */}
      {rivais.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-8 border border-dashed border-border rounded-lg">
          Nenhum rival adicionado. Busque acima por nome ou cole o ID do time.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {rivais.map(r => {
            const h = hist[r.time_id];
            const validas = h?.filter(x => x.ok) ?? [];
            const total = validas.reduce((s, x) => s + (x.pontos ?? 0), 0);
            const media = validas.length ? total / validas.length : 0;
            return (
              <div key={r.time_id} className="rounded-lg border border-border bg-card p-3 space-y-2">
                <div className="flex items-center gap-2">
                  {r.escudo && <img src={r.escudo} alt="" className="w-9 h-9 rounded-full bg-secondary object-cover" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-sm truncate">{r.nome}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{r.nome_cartola} · ID {r.time_id}</div>
                  </div>
                  <button onClick={() => removeRival(r.time_id)} className="text-muted-foreground hover:text-destructive p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {!h ? (
                  <Button size="sm" variant="outline" onClick={() => loadHist(r.time_id)} disabled={loadingHist[r.time_id]} className="w-full">
                    {loadingHist[r.time_id] ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Carregando R1–R{ultimaRodada}...</> : `Carregar histórico (R1–R${ultimaRodada})`}
                  </Button>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded bg-secondary p-2">
                        <div className="text-[9px] text-muted-foreground tracking-widest">TOTAL</div>
                        <div className="font-mono-data text-sm">{total.toFixed(1)}</div>
                      </div>
                      <div className="rounded bg-secondary p-2">
                        <div className="text-[9px] text-muted-foreground tracking-widest">MÉDIA</div>
                        <div className="font-mono-data text-sm">{media.toFixed(2)}</div>
                      </div>
                      <div className="rounded bg-secondary p-2">
                        <div className="text-[9px] text-muted-foreground tracking-widest">RODADAS</div>
                        <div className="font-mono-data text-sm">{validas.length}/{ultimaRodada}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {h.map(x => (
                        <span key={x.rodada}
                          title={x.ok ? `R${x.rodada}: ${x.pontos?.toFixed(1)} pts` : `R${x.rodada}: sem dados`}
                          className="text-[10px] px-1.5 py-0.5 rounded font-mono-data"
                          style={{
                            background: !x.ok ? "transparent" : (x.pontos ?? 0) >= media ? "color-mix(in oklab, var(--primary) 25%, transparent)" : "color-mix(in oklab, var(--rdl) 20%, transparent)",
                            border: "1px solid var(--border)",
                            opacity: x.ok ? 1 : 0.4,
                          }}>
                          R{x.rodada}{x.ok ? `:${x.pontos?.toFixed(0)}` : ""}
                        </span>
                      ))}
                    </div>
                    <Button size="sm" variant={rivalCompare === r.time_id ? "default" : "outline"}
                      onClick={() => setRivalCompare(rivalCompare === r.time_id ? null : r.time_id)} className="w-full">
                      <BarChart3 className="w-3.5 h-3.5 mr-1" />
                      {rivalCompare === r.time_id ? "Fechar comparação" : "Comparar com meu time"}
                    </Button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Painel de comparação */}
      {rivalSel && compareData && (
        <div className="rounded-lg border-2 border-primary/40 bg-card p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-[10px] font-display tracking-widest text-primary">COMPARATIVO</div>
              <div className="font-display text-base">{rivalSel.nome}</div>
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <div className="text-[9px] text-muted-foreground tracking-widest">MEU TIME</div>
                <Select value={meuTimeKey} onValueChange={setMeuTimeKey}>
                  <SelectTrigger className="h-8 w-[220px] text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {meuTimeOptions.length === 0 && <SelectItem value="__none" disabled>Nenhum disponível</SelectItem>}
                    {meuTimeOptions.map(o => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="text-[9px] text-muted-foreground tracking-widest">DE</div>
                <Select value={String(rIni)} onValueChange={v => setRIni(Number(v))}>
                  <SelectTrigger className="h-8 w-[80px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{Array.from({ length: ultimaRodada }, (_, i) => i + 1).map(r => <SelectItem key={r} value={String(r)}>R{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <div className="text-[9px] text-muted-foreground tracking-widest">ATÉ</div>
                <Select value={String(rFim)} onValueChange={v => setRFim(Number(v))}>
                  <SelectTrigger className="h-8 w-[80px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{Array.from({ length: ultimaRodada }, (_, i) => i + 1).map(r => <SelectItem key={r} value={String(r)}>R{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Métricas agregadas do rival */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Metric label="TOTAL" value={compareData.total.toFixed(1)} />
            <Metric label="MÉDIA" value={compareData.media.toFixed(2)} />
            <Metric label="MELHOR" value={compareData.melhor.toFixed(1)} positive />
            <Metric label="PIOR" value={compareData.pior.toFixed(1)} negative />
            <Metric label="CAP +" value={`${compareData.capPct.toFixed(0)}%`} hint={`${compareData.validas} rodadas`} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Metric label="ROTATIVIDADE" value={compareData.rotatividade.toFixed(1)}
              hint="Jogadores diferentes em média entre rodadas (titulares + RDL)" />
          </div>

          {/* Cross com meu time (rodada única) */}
          {compareData.cross ? (
            <div className="rounded-md border border-border p-3 space-y-2" style={{ background: "color-mix(in oklab, var(--primary) 5%, transparent)" }}>
              <div className="text-[10px] font-display tracking-widest text-primary">CONFRONTO DIRETO · R{compareData.cross.rodada}</div>
              <div className="grid sm:grid-cols-3 gap-3 items-center">
                <div className="text-center">
                  <div className="text-[10px] text-muted-foreground">MEU TIME</div>
                  <div className="font-mono-data text-2xl">{compareData.cross.meu_pts.toFixed(2)}</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-muted-foreground">DIFERENÇA</div>
                  <div className={`font-mono-data text-xl ${compareData.cross.diff >= 0 ? "text-primary" : "text-destructive"}`}>
                    {compareData.cross.diff >= 0 ? "+" : ""}{compareData.cross.diff.toFixed(2)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-muted-foreground">RIVAL</div>
                  <div className="font-mono-data text-2xl">{compareData.cross.rival_pts.toFixed(2)}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <div className="text-muted-foreground text-[10px]">JOGADORES EM COMUM</div>
                  <div className="font-mono-data">{compareData.cross.comuns} / {Math.min(compareData.cross.total_meu, compareData.cross.total_rival)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[10px]">MESMO CAPITÃO</div>
                  <div className={compareData.cross.capCoincide ? "text-primary" : "text-muted-foreground"}>
                    <Crown className="w-3 h-3 inline mr-1" />{compareData.cross.capCoincide ? "Sim" : "Não"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[10px]">MESMO RDL</div>
                  <div className={compareData.cross.rdlCoincide ? "text-primary" : "text-muted-foreground"}>
                    {compareData.cross.rdlCoincide ? "Sim" : "Não"}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground italic">
              Selecione um "meu time" calculado para ver o confronto direto da rodada.
            </div>
          )}

          {/* Tabela rodada a rodada */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left p-2">RODADA</th>
                  <th className="text-right p-2">PTS RIVAL</th>
                  <th className="text-left p-2">ESQUEMA</th>
                  <th className="text-center p-2">CAP +</th>
                </tr>
              </thead>
              <tbody>
                {compareData.rows.map(r => (
                  <tr key={r.rodada} className="border-b border-border/50">
                    <td className="p-2 font-mono-data">R{r.rodada}</td>
                    <td className={`p-2 text-right font-mono-data ${r.rival_pts === null ? "text-muted-foreground" : r.rival_pts >= compareData.media ? "text-primary" : ""}`}>
                      {r.rival_pts === null ? "—" : r.rival_pts.toFixed(2)}
                    </td>
                    <td className="p-2 text-muted-foreground">{r.rival_esquema ? ESQUEMAS[r.rival_esquema]?.nome ?? "?" : "—"}</td>
                    <td className="p-2 text-center">
                      {r.rival_cap_ok === null ? "—" : r.rival_cap_ok ? "✓" : "✗"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-[10px] text-muted-foreground">
            * "Rotatividade" = média de jogadores diferentes (titulares + RDL) entre rodadas consecutivas.
            * "CAP +" = capitão escalado pelo rival pontuou positivo.
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, hint, positive, negative }: { label: string; value: string; hint?: string; positive?: boolean; negative?: boolean }) {
  return (
    <div className="rounded-md bg-secondary p-2 text-center">
      <div className="text-[9px] text-muted-foreground tracking-widest">{label}</div>
      <div className={`font-mono-data text-sm ${positive ? "text-primary" : negative ? "text-destructive" : ""}`}>{value}</div>
      {hint && <div className="text-[9px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
// Suppress unused POSICOES warning (kept for future expansion)
void POSICOES;
