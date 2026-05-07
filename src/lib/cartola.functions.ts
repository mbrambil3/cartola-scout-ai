import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ESQUEMAS, STATUS_MERCADO_NOME } from "./cartola-types";

const BASE = "https://api.cartolafc.globo.com";
type CacheEntry = { data: any; ts: number };
const cache = new Map<string, CacheEntry>();
const TTL = 5 * 60 * 1000;

async function fetchCartola(path: string, retries = 2): Promise<any> {
  const key = path;
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.ts < TTL) return hit.data;
  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(BASE + path, {
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
          "Referer": "https://cartola.globo.com/",
          "Origin": "https://cartola.globo.com",
        },
      });
      if (!res.ok) throw new Error(`Cartola ${res.status}`);
      const data = await res.json();
      cache.set(key, { data, ts: now });
      return data;
    } catch (e) {
      lastErr = e;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
      }
    }
  }
  if (hit) return hit.data;
  throw new Error(`Falha ao consultar Cartola: ${(lastErr as Error).message}`);
}

export const getMercadoStatus = createServerFn({ method: "GET" }).handler(async () => {
  const data = await fetchCartola("/mercado/status");
  return {
    rodada_atual: data.rodada_atual,
    status_mercado: data.status_mercado,
    temporada: data.temporada,
    status_mercado_nome: STATUS_MERCADO_NOME[data.status_mercado] || "desconhecido",
  };
});

export const getAtletas = createServerFn({ method: "GET" }).handler(async () => {
  const data = await fetchCartola("/atletas/mercado");
  // Slim payload: keep only fields the client uses
  const atletas = (data.atletas ?? []).map((a: any) => ({
    atleta_id: a.atleta_id,
    apelido: a.apelido,
    nome: a.nome,
    foto: a.foto ? a.foto.replace("FORMATO", "140x140") : null,
    posicao_id: a.posicao_id,
    clube_id: a.clube_id,
    preco_num: a.preco_num,
    media_num: a.media_num,
    status_id: a.status_id,
  }));
  return { atletas };
});

export const getPartidas = createServerFn({ method: "GET" }).handler(async () => {
  return await fetchCartola("/partidas");
});

export const getClubes = createServerFn({ method: "GET" }).handler(async () => {
  const data = await fetchCartola("/clubes");
  // Slim: only abreviacao + 45x45 escudo
  const out: Record<string, { id: number; abreviacao: string; nome: string; escudos: { "45x45": string } }> = {};
  for (const [id, c] of Object.entries<any>(data || {})) {
    out[id] = {
      id: c.id,
      abreviacao: c.abreviacao,
      nome: c.nome,
      escudos: { "45x45": c.escudos?.["45x45"] ?? "" },
    };
  }
  return out;
});

export const getRodadas = createServerFn({ method: "GET" }).handler(async () => {
  return await fetchCartola("/rodadas");
});

export const getEsquemas = createServerFn({ method: "GET" }).handler(async () => {
  return Object.entries(ESQUEMAS).map(([id, cfg]) => ({ id: Number(id), ...cfg }));
});

export const getPontuacaoRodada = createServerFn({ method: "GET" })
  .inputValidator(z.object({ rodada: z.number().int().min(1) }))
  .handler(async ({ data }) => {
    return await fetchCartola(`/atletas/pontuados/${data.rodada}`);
  });

// ============ ANÁLISE DE TIME (CORE) ============

const AnaliseSchema = z.object({
  rodada: z.number().int().min(1),
  jogadores: z.array(z.object({ atleta_id: z.number().int(), capitao: z.boolean().optional() })).min(1),
  reserva_luxo_id: z.number().int().nullable().optional(),
});

type DetalheJogador = {
  atleta_id: number;
  apelido: string;
  foto: string | null;
  posicao_id: number;
  posicao_abrev: string;
  clube_id: number;
  clube_abreviacao: string;
  escudo: string | null;
  pontuacao: number;
  capitao: boolean;
  multiplicador: number;
  pontos_aplicados: number;
  entrou_em_campo: boolean;
  scout: Record<string, number> | null;
  tem_pontuacao: boolean;
  preco: number | null;
};

function fixFoto(foto: string | undefined | null): string | null {
  if (!foto) return null;
  return foto.replace("FORMATO", "140x140");
}

const POS_ABREV: Record<number, string> = { 1: "GOL", 2: "LAT", 3: "ZAG", 4: "MEI", 5: "ATA", 6: "TEC" };

export const analiseTime = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AnaliseSchema.parse(input))
  .handler(async ({ data }) => {
    const { rodada, jogadores, reserva_luxo_id } = data;

    // validações iniciais
    const caps = jogadores.filter(j => j.capitao);
    if (caps.length > 1) throw new Error("Apenas 1 capitão é permitido");

    const [atletasResp, clubesResp, pontuadosResp] = await Promise.all([
      fetchCartola("/atletas/mercado"),
      fetchCartola("/clubes"),
      fetchCartola(`/atletas/pontuados/${rodada}`).catch(() => ({ atletas: {} })),
    ]);

    const atletasMap: Record<string, any> = {};
    for (const a of (atletasResp.atletas ?? [])) atletasMap[String(a.atleta_id)] = a;
    const clubesMap: Record<string, any> = clubesResp || {};
    const pontuados: Record<string, any> = pontuadosResp.atletas || {};

    const capitaoId = caps[0]?.atleta_id ?? null;

    function buildDetalhe(atletaId: number, capitaoIdLocal: number | null): DetalheJogador {
      const a = atletasMap[String(atletaId)];
      const p = pontuados[String(atletaId)];
      const posicao_id = a?.posicao_id ?? p?.posicao_id ?? 0;
      const clube_id = a?.clube_id ?? p?.clube_id ?? 0;
      const clube = clubesMap[String(clube_id)] || {};
      const isCap = capitaoIdLocal === atletaId;
      const mult = isCap ? 1.5 : 1.0;
      const pontuacao = typeof p?.pontuacao === "number" ? p.pontuacao : 0;
      const tem = !!p;
      return {
        atleta_id: atletaId,
        apelido: a?.apelido ?? p?.apelido ?? `#${atletaId}`,
        foto: fixFoto(a?.foto),
        posicao_id,
        posicao_abrev: POS_ABREV[posicao_id] || "?",
        clube_id,
        clube_abreviacao: clube?.abreviacao ?? "",
        escudo: clube?.escudos?.["45x45"] ?? null,
        pontuacao,
        capitao: isCap,
        multiplicador: mult,
        pontos_aplicados: pontuacao * mult,
        entrou_em_campo: !!p?.entrou_em_campo,
        scout: p?.scout ?? null,
        tem_pontuacao: tem,
        preco: a?.preco_num ?? null,
      };
    }

    // validar técnico capitão
    if (capitaoId !== null) {
      const cap = atletasMap[String(capitaoId)];
      if (cap?.posicao_id === 6) throw new Error("Técnico não pode ser capitão");
    }

    const titularesOriginais = jogadores.map(j => buildDetalhe(j.atleta_id, capitaoId));
    const totalOriginal = titularesOriginais.reduce((s, j) => s + j.pontos_aplicados, 0);

    let titularesFinais = [...titularesOriginais];
    let substituicao: any = { ativou: false, sai: null, entra: null };
    let rdlInfo: any = null;
    let capitaoIdFinal = capitaoId;

    if (reserva_luxo_id) {
      const rdlAtleta = atletasMap[String(reserva_luxo_id)];
      if (!rdlAtleta) throw new Error("Reserva de Luxo não encontrado");
      if (rdlAtleta.posicao_id === 6) throw new Error("Reserva de Luxo não pode ser técnico");
      if (jogadores.some(j => j.atleta_id === reserva_luxo_id)) {
        throw new Error("Reserva de Luxo não pode estar nos titulares");
      }
      const samePos = titularesOriginais.filter(t => t.posicao_id === rdlAtleta.posicao_id);
      if (samePos.length === 0) throw new Error("Não há titulares na posição do Reserva de Luxo");

      const rdlDet = buildDetalhe(reserva_luxo_id, capitaoId);
      const minPont = Math.min(...samePos.map(t => t.pontuacao));

      rdlInfo = {
        atleta_id: rdlAtleta.atleta_id,
        apelido: rdlAtleta.apelido,
        foto: fixFoto(rdlAtleta.foto),
        posicao_id: rdlAtleta.posicao_id,
        posicao_abrev: POS_ABREV[rdlAtleta.posicao_id] || "?",
        clube_id: rdlAtleta.clube_id,
        preco: rdlAtleta.preco_num ?? null,
        pontuacao: rdlDet.pontuacao,
        ativou_substituicao: false,
        comparativo_min_titular: rdlDet.pontuacao - minPont,
      };

      if (rdlDet.pontuacao > minPont) {
        const empatados = samePos.filter(t => t.pontuacao === minPont);
        const sai = empatados.find(e => e.capitao) ?? empatados[0];
        const herdou = sai.capitao;
        const novoCapId = herdou ? rdlAtleta.atleta_id : capitaoId;
        capitaoIdFinal = novoCapId;
        const rdlFinal = buildDetalhe(reserva_luxo_id, novoCapId);
        // se herdou, precisa recalcular outros: na verdade só o cap muda; sai cap é removido
        titularesFinais = titularesOriginais.map(t => t.atleta_id === sai.atleta_id ? rdlFinal : t);
        rdlInfo.ativou_substituicao = true;
        substituicao = {
          ativou: true,
          sai: { atleta_id: sai.atleta_id, apelido: sai.apelido, pontuacao: sai.pontuacao, pontos_aplicados: sai.pontos_aplicados, era_capitao: sai.capitao },
          entra: { atleta_id: rdlFinal.atleta_id, apelido: rdlFinal.apelido, pontuacao: rdlFinal.pontuacao, pontos_aplicados: rdlFinal.pontos_aplicados, herdou_capitao: herdou },
        };
      }
    }

    const totalFinal = titularesFinais.reduce((s, j) => s + j.pontos_aplicados, 0);

    return {
      rodada,
      total: totalFinal,
      total_original: totalOriginal,
      total_final: totalFinal,
      diferenca_rdl: totalFinal - totalOriginal,
      qtd_jogadores: titularesFinais.length,
      tem_capitao: capitaoIdFinal !== null,
      capitao_id: capitaoIdFinal,
      capitao_id_original: capitaoId,
      jogadores: titularesFinais,
      jogadores_originais: titularesOriginais,
      reserva_luxo: rdlInfo,
      substituicao,
    };
  });

// ============ ESTATÍSTICAS POR POSIÇÃO ============

export const getPosicoesStats = createServerFn({ method: "GET" })
  .inputValidator(z.object({ rodadas_back: z.number().int().min(0).default(0) }))
  .handler(async ({ data }) => {
    const status = await fetchCartola("/mercado/status");
    const rodadaAtual: number = status.rodada_atual ?? 1;
    const temporada: number = status.temporada ?? new Date().getFullYear();
    const mercadoAberto = status.status_mercado === 1;
    const ultima = mercadoAberto ? rodadaAtual - 1 : rodadaAtual;
    if (ultima < 1) return { por_posicao: {}, por_rodada: {}, intervalo: { inicio: null, fim: null }, temporada };
    const inicio = data.rodadas_back > 0 ? Math.max(1, ultima - data.rodadas_back + 1) : 1;

    const rounds = await Promise.all(
      Array.from({ length: ultima - inicio + 1 }, (_, i) => inicio + i).map(r =>
        fetchCartola(`/atletas/pontuados/${r}`).then(d => ({ r, d })).catch(() => ({ r, d: { atletas: {} } }))
      )
    );

    const buckets: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    const porRodada: Record<number, Record<number, number>> = {};

    for (const { r, d } of rounds) {
      const atletas: Record<string, any> = d.atletas || {};
      const rodMap: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
      for (const a of Object.values(atletas)) {
        if (!a.entrou_em_campo) continue;
        const pos = a.posicao_id;
        if (!buckets[pos]) continue;
        buckets[pos].push(a.pontuacao);
        rodMap[pos].push(a.pontuacao);
      }
      const avg: Record<number, number> = {} as any;
      for (const k of Object.keys(rodMap)) {
        const arr = rodMap[Number(k)];
        avg[Number(k)] = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      }
      porRodada[r] = avg;
    }

    const out: Record<number, any> = {};
    for (const [pos, arr] of Object.entries(buckets)) {
      const n = arr.length;
      if (!n) {
        out[Number(pos)] = { media: 0, mediana: 0, max: 0, min: 0, qtd_amostras: 0, desvio_padrao: 0, pct_negativas: 0 };
        continue;
      }
      const sorted = [...arr].sort((a, b) => a - b);
      const sum = arr.reduce((a, b) => a + b, 0);
      const mean = sum / n;
      const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
      const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
      const neg = arr.filter(x => x < 0).length;
      out[Number(pos)] = {
        media: mean,
        mediana: median,
        max: sorted[n - 1],
        min: sorted[0],
        qtd_amostras: n,
        desvio_padrao: Math.sqrt(variance),
        pct_negativas: (neg / n) * 100,
      };
    }

    return { por_posicao: out, por_rodada: porRodada, intervalo: { inicio, fim: ultima }, temporada };
  });

// ============ PONTUADOS EM LOTE (para painel de jogadores dos times salvos) ============

export const getPontuadosBatch = createServerFn({ method: "POST" })
  .inputValidator(z.object({ rodadas: z.array(z.number().int().min(1)).max(50) }))
  .handler(async ({ data }) => {
    const unique = Array.from(new Set(data.rodadas));
    const results = await Promise.all(
      unique.map(r =>
        fetchCartola(`/atletas/pontuados/${r}`)
          .then(d => ({ r, atletas: d.atletas || {} }))
          .catch(() => ({ r, atletas: {} as Record<string, any> }))
      )
    );
    const out: Record<number, Record<number, { pontuacao: number; entrou: boolean; posicao_id: number }>> = {};
    for (const { r, atletas } of results) {
      const m: Record<number, { pontuacao: number; entrou: boolean; posicao_id: number }> = {};
      for (const [aid, a] of Object.entries<any>(atletas)) {
        m[Number(aid)] = {
          pontuacao: typeof a.pontuacao === "number" ? a.pontuacao : 0,
          entrou: !!a.entrou_em_campo,
          posicao_id: a.posicao_id ?? 0,
        };
      }
      out[r] = m;
    }
    return out;
  });
