import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Eye, EyeOff, Trash2, Save, FolderOpen, Crown, X, Plus, Star } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ESQUEMAS, POSICOES, POS_COLOR, type Atleta, type Clube, type TimeEntry } from "@/lib/cartola-types";
import { getAtletas, getClubes, getMercadoStatus, analiseTime, getPosicoesStats, getUltimaRodadaComPontuacao } from "@/lib/cartola.functions";
import { useUserSession, useTimesStorage } from "@/lib/userStorage";
import { Loading, SectionHeader, Stat, PositionBadge, Escudo } from "@/components/Pieces";
import { PlayerSearchDialog } from "@/components/PlayerSearchDialog";
import { SaveTimeDialog } from "@/components/SaveTimeDialog";
import { LoadTimesDialog } from "@/components/LoadTimesDialog";
import { AnaliticosPanel } from "@/components/AnaliticosPanel";
import { MeusJogadoresPanel } from "@/components/MeusJogadoresPanel";

type SlotKey = string; // "{posicao_id}-{idx}"
type Selecao = Record<SlotKey, number | undefined>; // atleta_id por slot

function buildSlots(esquemaId: number): { key: SlotKey; posicao_id: number; idx: number }[] {
  const cfg = ESQUEMAS[esquemaId];
  const slots: { key: SlotKey; posicao_id: number; idx: number }[] = [];
  const push = (pos: number, qtd: number) => { for (let i = 0; i < qtd; i++) slots.push({ key: `${pos}-${i}`, posicao_id: pos, idx: i }); };
  push(5, cfg.ata); push(4, cfg.mei); push(3, cfg.zag); push(2, cfg.lat); push(1, cfg.gol); push(6, cfg.tec);
  return slots;
}

function buildDefenseRow(esquemaId: number) {
  const cfg = ESQUEMAS[esquemaId];
  const lats = cfg.lat;
  const zags = cfg.zag;
  const out: { posicao_id: number; idx: number; key: string }[] = [];
  // LAT esquerda (metade), ZAG..., LAT direita (metade)
  const half = Math.floor(lats / 2);
  for (let i = 0; i < half; i++) out.push({ posicao_id: 2, idx: i, key: `2-${i}` });
  for (let i = 0; i < zags; i++) out.push({ posicao_id: 3, idx: i, key: `3-${i}` });
  for (let i = half; i < lats; i++) out.push({ posicao_id: 2, idx: i, key: `2-${i}` });
  return out;
}

export function AnaliseTime() {
  const { userId } = useUserSession();
  const { times, addTime, updateTime, removeTime, syncing } = useTimesStorage(userId);

  const fetchAtletas = useServerFn(getAtletas);
  const fetchClubes = useServerFn(getClubes);
  const fetchStatus = useServerFn(getMercadoStatus);
  const fetchAnalise = useServerFn(analiseTime);
  const fetchUltimaRodada = useServerFn(getUltimaRodadaComPontuacao);
  const fetchPosStats = useServerFn(getPosicoesStats);

  const [atletas, setAtletas] = useState<Atleta[] | null>(null);
  const [clubes, setClubes] = useState<Record<string, Clube> | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [esquemaId, setEsquemaId] = useState<number>(3);
  const [rodada, setRodada] = useState<number>(1);
  const [selecao, setSelecao] = useState<Selecao>({});
  const [capitaoKey, setCapitaoKey] = useState<SlotKey | null>(null);
  const [reservas, setReservas] = useState<Record<number, number | undefined>>({}); // posicao_id -> atleta_id
  const [rdlPos, setRdlPos] = useState<number | null>(null); // posicao_id marcada como RDL
  const [resultado, setResultado] = useState<any>(null);
  const [calculando, setCalculando] = useState(false);
  const [pickerSlot, setPickerSlot] = useState<{ key: SlotKey; posicao_id: number } | null>(null);
  const [pickerReservaPos, setPickerReservaPos] = useState<number | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [posStats, setPosStats] = useState<any>(null);
  

  // Fetch initial data
  useEffect(() => {
    Promise.all([fetchAtletas(), fetchClubes(), fetchStatus(), fetchUltimaRodada()])
      .then(([atResp, cl, st, ult]) => {
        setAtletas(atResp.atletas ?? []);
        setClubes(cl);
        setStatus(st);
        // Usa a última rodada com pontuação real (funciona mesmo com mercado
        // fechado na segunda-feira, quando rodada_atual já aponta para a próxima).
        setRodada(ult?.rodada ?? Math.max(1, (st.rodada_atual ?? 1) - 1));
      })
      .catch(e => toast.error(`Erro ao carregar dados: ${e.message}`));
    fetchPosStats({ data: { rodadas_back: 0 } }).then(setPosStats).catch(() => {});
  }, []);

  const slots = useMemo(() => buildSlots(esquemaId), [esquemaId]);
  const atletasMap = useMemo(() => {
    const m: Record<number, Atleta> = {};
    if (atletas) for (const a of atletas) m[a.atleta_id] = a;
    return m;
  }, [atletas]);

  const totalSelecionados = useMemo(() => slots.filter(s => selecao[s.key]).length, [slots, selecao]);
  const podeCalcular = totalSelecionados === 12 && capitaoKey !== null;

  // Ao mudar esquema, preserva por posição
  useEffect(() => {
    setSelecao(prev => {
      const next: Selecao = {};
      const grouped: Record<number, number[]> = {};
      for (const k of Object.keys(prev)) {
        const id = prev[k];
        if (!id) continue;
        const pos = Number(k.split("-")[0]);
        (grouped[pos] ||= []).push(id);
      }
      for (const s of slots) {
        const arr = grouped[s.posicao_id];
        if (arr && arr.length) {
          next[s.key] = arr.shift();
        }
      }
      return next;
    });
    setCapitaoKey(null);
    setReservas({});
    setRdlPos(null);
    setResultado(null);
  }, [esquemaId]);

  // Ao mudar rodada, reseta resultado
  useEffect(() => { setResultado(null); }, [rodada]);

  const limpar = () => { setSelecao({}); setCapitaoKey(null); setReservas({}); setRdlPos(null); setResultado(null); };

  const handlePickAtleta = (a: Atleta) => {
    if (pickerReservaPos !== null) {
      if (a.posicao_id !== pickerReservaPos) {
        toast.error("Reserva deve ser da mesma posição do slot");
        return;
      }
      setReservas(prev => ({ ...prev, [pickerReservaPos]: a.atleta_id }));
      setResultado(null);
      return;
    }
    if (!pickerSlot) return;
    setSelecao(prev => ({ ...prev, [pickerSlot.key]: a.atleta_id }));
    setResultado(null);
  };

  const setCapitao = (key: SlotKey) => {
    const slot = slots.find(s => s.key === key);
    if (slot?.posicao_id === 6) { toast.error("Técnico não pode ser capitão"); return; }
    setCapitaoKey(prev => prev === key ? null : key);
    setResultado(null);
  };

  const removerSlot = (key: SlotKey) => {
    setSelecao(prev => { const n = { ...prev }; delete n[key]; return n; });
    if (capitaoKey === key) setCapitaoKey(null);
    setResultado(null);
  };

  const removerReserva = (pos: number) => {
    setReservas(prev => { const n = { ...prev }; delete n[pos]; return n; });
    if (rdlPos === pos) setRdlPos(null);
    setResultado(null);
  };

  const toggleRdl = (pos: number) => {
    if (!reservas[pos]) { toast.error("Selecione um reserva nessa posição primeiro"); return; }
    setRdlPos(prev => prev === pos ? null : pos);
    setResultado(null);
  };

  const calcular = async () => {
    if (totalSelecionados !== 12) return;
    if (!capitaoKey) { toast.error("Escolha um capitão antes de calcular"); return; }
    setCalculando(true);
    try {
      const jogadores = slots.map(s => ({ atleta_id: selecao[s.key]!, capitao: capitaoKey === s.key }));
      const reservasArr = Object.entries(reservas)
        .filter(([, id]) => !!id)
        .map(([pos, id]) => ({ posicao_id: Number(pos), atleta_id: id!, is_rdl: Number(pos) === rdlPos }));
      const r = await fetchAnalise({ data: { rodada, jogadores, reservas: reservasArr } });
      setResultado(r);
      setTimeout(() => document.getElementById("resultado")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e: any) {
      toast.error(e.message || "Erro ao calcular");
    } finally {
      setCalculando(false);
    }
  };

  const salvarTime = (nome: string, indice: number | null) => {
    const reservasArr = Object.entries(reservas).filter(([, id]) => !!id).map(([pos, id]) => ({ posicao_id: Number(pos), atleta_id: id! }));
    const rdlAtletaId = rdlPos !== null ? (reservas[rdlPos] ?? null) : null;
    const entry: TimeEntry = {
      id: Date.now(),
      nome,
      esquema_id: esquemaId,
      jogadores: slots.filter(s => selecao[s.key]).map(s => ({ slotKey: s.key, posicao_id: s.posicao_id, atleta_id: selecao[s.key]! })),
      capitao_id: capitaoKey ? selecao[capitaoKey] ?? null : null,
      reserva_luxo_id: rdlAtletaId,
      reservas: reservasArr,
      rdl_posicao: rdlPos,
      pontuacao_final: resultado?.total_final ?? null,
      pontuacao_original: resultado?.total_original ?? null,
      rodada_calculada: resultado?.rodada ?? null,
      indice_confianca: indice,
      oculto: false,
      criado_em: new Date().toISOString(),
    };
    addTime(entry).then(() => toast.success("Time salvo")).catch(e => toast.error(e.message));
  };

  const carregarTime = (t: TimeEntry) => {
    setEsquemaId(t.esquema_id);
    setTimeout(() => {
      const sel: Selecao = {};
      for (const j of t.jogadores) sel[j.slotKey] = j.atleta_id;
      setSelecao(sel);
      const capSlot = t.capitao_id ? t.jogadores.find(j => j.atleta_id === t.capitao_id)?.slotKey ?? null : null;
      setCapitaoKey(capSlot);
      const r: Record<number, number> = {};
      if (t.reservas && t.reservas.length > 0) {
        for (const x of t.reservas) r[x.posicao_id] = x.atleta_id;
        setReservas(r);
        setRdlPos(t.rdl_posicao ?? null);
      } else if (t.reserva_luxo_id) {
        // compat antigo: descobre posição pelo atleta no mercado
        const a = atletasMap[t.reserva_luxo_id];
        if (a) { r[a.posicao_id] = t.reserva_luxo_id; setReservas(r); setRdlPos(a.posicao_id); }
        else { setReservas({}); setRdlPos(null); }
      } else {
        setReservas({}); setRdlPos(null);
      }
      setResultado(null);
      if (t.rodada_calculada) setRodada(t.rodada_calculada);
    }, 30);
    toast.success(`Carregado: ${t.nome}`);
  };

  if (!atletas || !clubes || !status) {
    return <Loading />;
  }

  const defenseRow = buildDefenseRow(esquemaId);
  const ataSlots = slots.filter(s => s.posicao_id === 5);
  const meiSlots = slots.filter(s => s.posicao_id === 4);
  const golSlots = slots.filter(s => s.posicao_id === 1);
  const tecSlots = slots.filter(s => s.posicao_id === 6);

  const detalhesByAtleta: Record<number, any> = {};
  if (resultado) for (const j of resultado.jogadores) detalhesByAtleta[j.atleta_id] = j;
  const subOut = resultado?.substituicao?.ativou ? resultado.substituicao.sai : null;
  const subIn = resultado?.substituicao?.ativou ? resultado.substituicao.entra : null;

  // visíveis para histórico
  const visiveis = times.filter(t => !t.oculto && t.pontuacao_final !== null);
  const totalAcumulado = visiveis.reduce((s, t) => s + (t.pontuacao_final ?? 0), 0);
  const ocultos = times.filter(t => t.oculto).length;
  const mediaPontos = visiveis.length ? totalAcumulado / visiveis.length : 0;
  const melhor = visiveis.length ? Math.max(...visiveis.map(t => t.pontuacao_final ?? 0)) : 0;
  const pior = visiveis.length ? Math.min(...visiveis.map(t => t.pontuacao_final ?? 0)) : 0;

  return (
    <div className="space-y-8">
      <SectionHeader
        title="ANÁLISE TIME DA IA"
        subtitle="Monte um time, escolha a rodada e confira a pontuação retroativa"
        right={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setLoadOpen(true)} data-testid="btn-load">
              <FolderOpen className="w-4 h-4 mr-1" /> Carregar ({times.length})
            </Button>
            <Button size="sm" onClick={() => setSaveOpen(true)} className="bg-primary text-primary-foreground hover:opacity-90" data-testid="btn-save">
              <Save className="w-4 h-4 mr-1" /> Salvar
            </Button>
          </div>
        }
      />

      {/* Controles */}
      <div className="grid md:grid-cols-3 gap-3">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-display">Esquema Tático</label>
          <Select value={String(esquemaId)} onValueChange={v => setEsquemaId(Number(v))}>
            <SelectTrigger data-testid="select-esquema"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ESQUEMAS).map(([id, cfg]) => (
                <SelectItem key={id} value={id}>
                  {cfg.nome} — {cfg.gol}G {cfg.zag}Z {cfg.lat}L {cfg.mei}M {cfg.ata}A {cfg.tec}T
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-display">Rodada</label>
          <Select value={String(rodada)} onValueChange={v => setRodada(Number(v))}>
            <SelectTrigger data-testid="select-rodada"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 38 }, (_, i) => i + 1).map(r => (
                <SelectItem key={r} value={String(r)}>Rodada {r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col">
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-display">Ação</label>
          <Button
            disabled={!podeCalcular || calculando}
            onClick={calcular}
            className="bg-primary text-primary-foreground hover:opacity-90 font-display tracking-wider h-10 disabled:opacity-40"
            data-testid="btn-calcular"
          >
            {calculando ? "CALCULANDO..." : "CALCULAR PONTUAÇÃO"}
          </Button>
          <button onClick={limpar} className="text-[11px] text-muted-foreground hover:text-foreground mt-1 self-end" data-testid="btn-limpar">Limpar time</button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground flex items-center gap-3">
        <span><span className="font-mono-data text-foreground">{totalSelecionados}/12</span> jogadores</span>
        <span>·</span>
        {capitaoKey ? (
          <span className="text-cap" style={{ color: "var(--cap)" }}>Capitão definido (1.5×)</span>
        ) : (
          <span className="text-muted-foreground">Marque um jogador de linha como capitão</span>
        )}
      </div>

      {/* Pitch */}
      <div className="pitch-bg p-4 md:p-6">
        <div className="space-y-3">
          <PitchRow slots={ataSlots} />
          <PitchRow slots={meiSlots} />
          <PitchRow slots={defenseRow.map(d => slots.find(s => s.key === d.key)!)} />
          <PitchRow slots={golSlots} />
          <PitchRow slots={tecSlots} />
        </div>
      </div>

      {/* Reservas por posição (uma marcada como RDL) */}
      <ReservasBar
        atletasMap={atletasMap}
        clubes={clubes}
        reservas={reservas}
        rdlPos={rdlPos}
        onPick={(pos) => setPickerReservaPos(pos)}
        onRemove={removerReserva}
        onToggleRdl={toggleRdl}
      />

      {/* Resultado */}
      {resultado && (
        <section id="resultado" className="space-y-4 fade-up">
          <SectionHeader title="RESULTADO" />
          <div className="grid md:grid-cols-3 gap-3">
            <Stat label="Rodada" value={`R${resultado.rodada}`} />
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-display">Pontuação Final</div>
              <div className="font-mono-data text-5xl md:text-6xl text-primary leading-none mt-1">{resultado.total_final.toFixed(2)}</div>
              {resultado.substituicao?.ativou && (
                <div className="mt-2 text-xs text-muted-foreground">
                  <span className="line-through font-mono-data">{resultado.total_original.toFixed(2)}</span>
                  <span className="mx-1">→</span>
                  <span className="text-primary font-mono-data">{resultado.total_final.toFixed(2)}</span>
                  <span className="ml-2" style={{ color: "var(--rdl)" }}>
                    ({resultado.diferenca_rdl >= 0 ? "+" : ""}{resultado.diferenca_rdl.toFixed(2)})
                  </span>
                </div>
              )}
            </div>
            <Stat
              label="Destaque"
              value={(() => {
                const top = [...resultado.jogadores].sort((a, b) => b.pontos_aplicados - a.pontos_aplicados)[0];
                return top ? `${top.apelido} (${top.pontos_aplicados.toFixed(1)})` : "—";
              })()}
            />
          </div>

          {resultado.substituicao?.ativou && (
            <div className="rounded-md border p-3 text-sm" style={{ background: "color-mix(in oklab, var(--rdl) 10%, transparent)", borderColor: "color-mix(in oklab, var(--rdl) 40%, transparent)" }}>
              <div className="font-display tracking-wider text-xs mb-1" style={{ color: "var(--rdl)" }}>RESERVA DE LUXO ATIVADO</div>
              <span className="font-mono-data">{subOut.apelido} ({subOut.pontos_aplicados.toFixed(1)})</span>
              <span className="mx-2">→</span>
              <span className="font-mono-data text-primary">{subIn.apelido} ({subIn.pontos_aplicados.toFixed(1)})</span>
              {subOut.era_capitao && <span className="ml-2 text-xs" style={{ color: "var(--cap)" }}>· era capitão</span>}
              {subIn.herdou_capitao && <span className="ml-2 text-xs" style={{ color: "var(--cap)" }}>· herdou capitão (1.5×)</span>}
            </div>
          )}

          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-secondary text-muted-foreground font-display tracking-wider">
                <tr>
                  <th className="text-left p-2">JOGADOR</th>
                  <th className="text-left p-2">POS</th>
                  <th className="text-left p-2">CLUBE</th>
                  <th className="text-center p-2">CAP</th>
                  <th className="text-right p-2">PONTOS</th>
                  <th className="text-right p-2">MULT</th>
                  <th className="text-right p-2">APLICADO</th>
                </tr>
              </thead>
              <tbody>
                {resultado.jogadores.map((j: any) => (
                  <tr key={j.atleta_id} className="border-t border-border">
                    <td className="p-2">{j.apelido}</td>
                    <td className="p-2"><PositionBadge posicao_id={j.posicao_id} /></td>
                    <td className="p-2 text-muted-foreground">{j.clube_abreviacao}</td>
                    <td className="p-2 text-center">{j.capitao && <Star className="w-3.5 h-3.5 inline" style={{ color: "var(--cap)" }} fill="currentColor" />}</td>
                    <td className={`p-2 text-right font-mono-data ${j.pontuacao >= 0 ? "" : "text-destructive"}`}>{j.pontuacao.toFixed(2)}</td>
                    <td className="p-2 text-right font-mono-data text-muted-foreground">{j.multiplicador.toFixed(1)}×</td>
                    <td className="p-2 text-right font-mono-data text-primary">{j.pontos_aplicados.toFixed(2)}</td>
                  </tr>
                ))}
                <tr className="border-t border-border bg-secondary">
                  <td colSpan={6} className="p-2 font-display tracking-wider text-right">TOTAL</td>
                  <td className="p-2 text-right font-mono-data text-primary text-base">{resultado.total_final.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Histórico */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl tracking-wide">HISTÓRICO DO TIME DA IA</h2>
            {ocultos > 0 && <p className="text-[11px] text-muted-foreground">{ocultos} time(s) oculto(s)</p>}
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-display">Total Acumulado</div>
            <div className="font-mono-data text-3xl md:text-4xl text-primary">{totalAcumulado.toFixed(2)}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Stat label="Média Pts" value={mediaPontos.toFixed(2)} />
          <Stat label="Melhor" value={melhor.toFixed(1)} />
          <Stat label="Pior" value={pior.toFixed(1)} />
        </div>

        {syncing && <p className="text-xs text-muted-foreground">Sincronizando...</p>}

        {times.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed border-border rounded-md p-6 text-center">Nenhum time salvo ainda</p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-secondary text-muted-foreground font-display tracking-wider">
                <tr>
                  <th className="text-left p-2">RODADA</th>
                  <th className="text-left p-2">NOME</th>
                  <th className="text-left p-2">ESQ</th>
                  <th className="text-right p-2">PTS</th>
                  <th className="text-center p-2 w-10"></th>
                  <th className="text-center p-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {[...times].sort((a, b) => {
                  const ra = a.rodada_calculada ?? Number.POSITIVE_INFINITY;
                  const rb = b.rodada_calculada ?? Number.POSITIVE_INFINITY;
                  if (ra !== rb) return ra - rb;
                  return new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime();
                }).map(t => {
                  const op = t.oculto ? "opacity-40" : "";
                  const pts = t.pontuacao_final;
                  return (
                    <tr key={t.id} className={`border-t border-border ${op}`}>
                      <td className="p-2 font-mono-data">{t.rodada_calculada ? `R${t.rodada_calculada}` : "—"}</td>
                      <td className="p-2">
                        {t.nome}
                        {t.reserva_luxo_id && <span className="ml-2 text-[10px]" style={{ color: "var(--rdl)" }}>RDL ativo no save</span>}
                      </td>
                      <td className="p-2 text-muted-foreground">{ESQUEMAS[t.esquema_id]?.nome ?? "?"}</td>
                      <td className={`p-2 text-right font-mono-data ${t.oculto ? "line-through" : ""} ${pts === null ? "text-muted-foreground" : pts >= 0 ? "text-primary" : "text-destructive"}`}>
                        {pts === null ? "—" : pts.toFixed(2)}
                      </td>
                      <td className="p-2 text-center">
                        <button onClick={() => updateTime(t.id, { oculto: !t.oculto })} className="text-muted-foreground hover:text-foreground">
                          {t.oculto ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                      <td className="p-2 text-center">
                        <button onClick={() => removeTime(t.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t border-border bg-secondary">
                  <td colSpan={4} className="p-2 font-display tracking-wider text-right">TOTAL ACUMULADO</td>
                  <td className="p-2 text-right font-mono-data text-primary text-base">{totalAcumulado.toFixed(2)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Painel Analítico (Geral + Seus Jogadores) */}
      <SectionHeader title="PAINEL ANALÍTICO" subtitle="Alterne entre o panorama geral do campeonato e os seus jogadores" />
      <Tabs defaultValue="geral" className="w-full">
        <TabsList className="mb-3">
          <TabsTrigger value="geral">Geral do campeonato</TabsTrigger>
          <TabsTrigger value="meus">Meus jogadores</TabsTrigger>
        </TabsList>
        <TabsContent value="geral">
          <AnaliticosPanel times={times} posStats={posStats} />
        </TabsContent>
        <TabsContent value="meus">
          <MeusJogadoresPanel times={times} atletasMap={atletasMap} />
        </TabsContent>
      </Tabs>

      <SaveTimeDialog open={saveOpen} onOpenChange={setSaveOpen} onSave={salvarTime} />
      <LoadTimesDialog open={loadOpen} onOpenChange={setLoadOpen} times={times} onLoad={carregarTime} onDelete={(id) => removeTime(id)} />

      <PlayerSearchDialog
        open={!!pickerSlot || pickerRDL}
        onOpenChange={(v) => { if (!v) { setPickerSlot(null); setPickerRDL(false); } }}
        atletas={atletas}
        clubes={clubes}
        posicao_id={pickerSlot?.posicao_id}
        rdlMode={pickerRDL}
        excludeIds={[
          ...Object.values(selecao).filter(Boolean) as number[],
          ...(reservaLuxo ? [reservaLuxo] : []),
        ]}
        onSelect={handlePickAtleta}
      />

      {/* Slot picker handlers via render-prop pattern: we expose openSlot below by rendering the slot map here */}
      <SlotControls
        slots={slots}
        selecao={selecao}
        atletasMap={atletasMap}
        clubes={clubes}
        capitaoKey={capitaoKey}
        detalhes={detalhesByAtleta}
        subOutId={subOut?.atleta_id}
        subInId={subIn?.atleta_id}
        onPick={(s: any) => setPickerSlot(s)}
        onCap={setCapitao}
        onRemove={removerSlot}
      />
    </div>
  );

  // -------- componentes internos para evitar re-render extra --------

  function PitchRow({ slots }: { slots: { key: string; posicao_id: number }[] }) {
    return (
      <div className="flex justify-center gap-2 md:gap-3 flex-wrap">
        {slots.map(s => (
          <SlotCard key={s.key} slot={s} />
        ))}
      </div>
    );
  }

  function SlotCard({ slot }: { slot: { key: string; posicao_id: number } }) {
    const atletaId = selecao[slot.key];
    const atleta = atletaId ? atletasMap[atletaId] : undefined;
    const club = atleta ? clubes![String(atleta.clube_id)] : undefined;
    const isCap = capitaoKey === slot.key;
    const det = atletaId ? detalhesByAtleta[atletaId] : null;
    const wasReplaced = subOut && atletaId === subOut.atleta_id;
    const isRDL = subIn && atletaId === subIn.atleta_id; // não cabe aqui, RDL não está nos slots
    const color = POS_COLOR[slot.posicao_id];
    const borderColor = wasReplaced ? "var(--rdl)" : color;

    if (!atleta) {
      return (
        <button
          onClick={() => setPickerSlot(slot)}
          data-testid={`slot-empty-${slot.key}`}
          className="w-[112px] h-[150px] md:w-[120px] md:h-[160px] rounded-lg flex flex-col items-center justify-center gap-1 transition hover:bg-white/5"
          style={{ border: `2px dashed color-mix(in oklab, ${color} 60%, transparent)` }}
        >
          <Plus className="w-5 h-5" style={{ color }} />
          <span className="font-display font-bold text-[11px] tracking-wider" style={{ color }}>{POSICOES[slot.posicao_id]}</span>
        </button>
      );
    }

    return (
      <div
        className="group relative w-[112px] h-[150px] md:w-[120px] md:h-[160px] rounded-lg bg-card flex flex-col items-center justify-start pt-3 pb-2 px-1.5"
        style={{ border: `2px solid ${borderColor}` }}
        data-testid={`slot-filled-${slot.key}`}
      >
        {isCap && (
          <span className="absolute top-1 left-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center"
            style={{ background: "var(--cap)", color: "#000" }}>C</span>
        )}
        {wasReplaced && (
          <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-display tracking-widest"
            style={{ background: "var(--rdl)", color: "#000" }}>RDL</span>
        )}
        {det && (
          <span
            className={`absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-[10px] font-mono-data font-bold ${det.pontos_aplicados >= 0 ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground"}`}
          >
            {det.pontos_aplicados >= 0 ? "+" : ""}{det.pontos_aplicados.toFixed(1)}
          </span>
        )}
        <div className="relative">
          <img
            src={atleta.foto || ""}
            alt={atleta.apelido}
            className="w-14 h-14 md:w-16 md:h-16 rounded-full object-cover bg-secondary"
            style={{ border: `2px solid ${color}` }}
          />
          <span className="absolute -bottom-1 -right-1 rounded-full bg-card p-0.5">
            <Escudo src={club?.escudos?.["45x45"]} size={18} />
          </span>
        </div>
        <div className="mt-1 text-center w-full">
          <div className="font-display font-semibold text-[11px] truncate">{atleta.apelido}</div>
          <div className="text-[10px] text-muted-foreground truncate">{club?.abreviacao} · {POSICOES[slot.posicao_id]}</div>
        </div>
        {wasReplaced && subOut && (
          <div className="text-[9px] text-center mt-0.5" style={{ color: "var(--rdl)" }}>Saiu: {subOut.apelido}</div>
        )}
        {/* Overlay hover */}
        <div className="absolute inset-0 bg-black/85 rounded-lg flex flex-col items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition">
          {slot.posicao_id !== 6 && (
            <button
              onClick={() => setCapitao(slot.key)}
              className="text-[10px] px-2 py-1 rounded font-display tracking-wider"
              style={{ background: "var(--cap)", color: "#000" }}
            >
              {isCap ? "REMOVER CAP" : "DEFINIR CAP"}
            </button>
          )}
          <button
            onClick={() => removerSlot(slot.key)}
            className="text-[10px] px-2 py-1 rounded font-display tracking-wider bg-destructive text-destructive-foreground"
          >
            REMOVER
          </button>
        </div>
      </div>
    );
  }

  // SlotControls não renderiza nada extra — apenas usa os componentes acima.
  function SlotControls(_props: any) { return null; }
}

function ReservaLuxoBanner({
  atletasMap, clubes, reservaLuxo, setPickerRDL, clear, resultado,
}: {
  atletasMap: Record<number, Atleta>;
  clubes: Record<string, Clube>;
  reservaLuxo: number | null;
  setPickerRDL: () => void;
  clear: () => void;
  resultado: any;
}) {
  const a = reservaLuxo ? atletasMap[reservaLuxo] : null;
  const club = a ? clubes[String(a.clube_id)] : null;
  const rdlInfo = resultado?.reserva_luxo;

  return (
    <div className="rounded-md p-3 flex items-center gap-3" style={{ background: "color-mix(in oklab, var(--rdl) 8%, transparent)", border: "1px solid color-mix(in oklab, var(--rdl) 35%, transparent)" }}>
      <div className="flex-1">
        <div className="text-[10px] font-display tracking-widest" style={{ color: "var(--rdl)" }}>RESERVA DE LUXO</div>
        <div className="text-xs text-muted-foreground">Substitui titular se pontuar mais (mesma posição) · qualquer preço permitido</div>
      </div>
      {!a ? (
        <button onClick={setPickerRDL} className="px-3 py-2 rounded-md text-xs font-display tracking-wider hover:bg-white/5" style={{ border: "1px dashed var(--rdl)", color: "var(--rdl)" }} data-testid="btn-add-rdl">
          <Crown className="w-3.5 h-3.5 inline mr-1" /> ADICIONAR RDL
        </button>
      ) : (
        <div className="flex items-center gap-3 bg-card border border-border rounded-md p-2">
          <img src={a.foto || ""} className="w-10 h-10 rounded-full object-cover bg-secondary" alt="" />
          <div className="text-xs">
            <div className="font-display font-semibold flex items-center gap-1.5">
              {a.apelido}
              <PositionBadge posicao_id={a.posicao_id} />
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Escudo src={club?.escudos?.["30x30"] ?? club?.escudos?.["45x45"]} size={14} />
              {club?.abreviacao} · C$ {(a.preco_num ?? 0).toFixed(1)}
            </div>
          </div>
          {rdlInfo && (
            <div className="text-right text-xs">
              <div className="font-mono-data text-primary">{rdlInfo.pontuacao.toFixed(1)}</div>
              <div className="text-[10px]" style={{ color: rdlInfo.ativou_substituicao ? "var(--primary)" : "var(--muted-foreground)" }}>
                {rdlInfo.ativou_substituicao ? "Substituiu" : "Não substituiu"}
              </div>
            </div>
          )}
          <button onClick={clear} className="text-muted-foreground hover:text-destructive p-1"><X className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
}
