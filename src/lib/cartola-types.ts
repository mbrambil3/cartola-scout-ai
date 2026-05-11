export const POSICOES: Record<number, string> = {
  1: "GOL", 2: "LAT", 3: "ZAG", 4: "MEI", 5: "ATA", 6: "TEC",
};

export const STATUS_PROVAVEL = 7;

export const STATUS_MAP: Record<number, { nome: string; cor: string }> = {
  2: { nome: "Dúvida", cor: "#F59E0B" },
  3: { nome: "Suspenso", cor: "#EF4444" },
  5: { nome: "Contundido", cor: "#DC2626" },
  6: { nome: "Nulo", cor: "#6B7280" },
  7: { nome: "Provável", cor: "#10B981" },
};

export const POS_COLOR: Record<number, string> = {
  1: "var(--pos-gol)", 2: "var(--pos-lat)", 3: "var(--pos-zag)",
  4: "var(--pos-mei)", 5: "var(--pos-ata)", 6: "var(--pos-tec)",
};

export type EsquemaCfg = { nome: string; gol: number; zag: number; lat: number; mei: number; ata: number; tec: number };
export const ESQUEMAS: Record<number, EsquemaCfg> = {
  1: { nome: "3-4-3", gol: 1, zag: 3, lat: 0, mei: 4, ata: 3, tec: 1 },
  2: { nome: "3-5-2", gol: 1, zag: 3, lat: 0, mei: 5, ata: 2, tec: 1 },
  3: { nome: "4-3-3", gol: 1, zag: 2, lat: 2, mei: 3, ata: 3, tec: 1 },
  4: { nome: "4-4-2", gol: 1, zag: 2, lat: 2, mei: 4, ata: 2, tec: 1 },
  5: { nome: "4-5-1", gol: 1, zag: 2, lat: 2, mei: 5, ata: 1, tec: 1 },
  6: { nome: "5-3-2", gol: 1, zag: 3, lat: 2, mei: 3, ata: 2, tec: 1 },
  7: { nome: "5-4-1", gol: 1, zag: 3, lat: 2, mei: 4, ata: 1, tec: 1 },
};

export const STATUS_MERCADO_NOME: Record<number, string> = {
  1: "aberto", 2: "fechado", 3: "atualizacao", 4: "manutencao",
};

export type Atleta = {
  atleta_id: number;
  apelido: string;
  apelido_abreviado?: string;
  nome?: string;
  foto?: string;
  posicao_id: number;
  clube_id: number;
  status_id?: number;
  preco_num?: number;
  media_num?: number;
};

export type Clube = {
  id: number;
  nome: string;
  abreviacao: string;
  escudos?: { "60x60"?: string; "45x45"?: string; "30x30"?: string };
};

export type TimeEntry = {
  id: number;
  nome: string;
  esquema_id: number;
  jogadores: { slotKey: string; posicao_id: number; atleta_id: number }[];
  capitao_id: number | null;
  reserva_luxo_id: number | null;
  reservas?: { posicao_id: number; atleta_id: number }[];
  rdl_posicao?: number | null;
  pontuacao_final: number | null;
  pontuacao_original: number | null;
  rodada_calculada: number | null;
  indice_confianca: number | null;
  oculto: boolean;
  criado_em: string;
};
