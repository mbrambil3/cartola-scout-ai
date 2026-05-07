import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, Crown } from "lucide-react";
import type { Atleta, Clube } from "@/lib/cartola-types";
import { POSICOES, STATUS_MAP } from "@/lib/cartola-types";
import { PositionBadge, Escudo } from "./Pieces";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  atletas: Atleta[];
  clubes: Record<string, Clube>;
  posicao_id?: number; // se RDL: undefined; ainda usado para filtrar
  rdlMode?: boolean;
  excludeIds?: number[];
  onSelect: (a: Atleta) => void;
};

export function PlayerSearchDialog({ open, onOpenChange, atletas, clubes, posicao_id, rdlMode, excludeIds = [], onSelect }: Props) {
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    let arr = atletas.filter(a => !excludeIds.includes(a.atleta_id));
    if (rdlMode) {
      arr = arr.filter(a => a.posicao_id !== 6);
    } else if (posicao_id) {
      arr = arr.filter(a => a.posicao_id === posicao_id);
    }
    if (q.trim()) {
      const t = q.toLowerCase();
      arr = arr.filter(a => (a.apelido ?? "").toLowerCase().includes(t) || (a.nome ?? "").toLowerCase().includes(t));
    }
    arr.sort((a, b) => (b.media_num ?? 0) - (a.media_num ?? 0));
    return arr.slice(0, rdlMode ? 80 : 50);
  }, [atletas, q, posicao_id, rdlMode, excludeIds]);

  const title = rdlMode ? "Selecionar Reserva de Luxo" : `Selecionar ${POSICOES[posicao_id ?? 0] ?? "Jogador"}`;
  const desc = rdlMode ? "Qualquer posição (exceto técnico) e qualquer preço." : "Busque por nome…";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display tracking-wide">
            {rdlMode && <Crown className="w-5 h-5" style={{ color: "var(--rdl)" }} />}
            {title}
          </DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input autoFocus value={q} onChange={e => setQ(e.target.value)} className="pl-8" placeholder="Nome ou apelido..." />
        </div>

        <div className="max-h-[420px] overflow-y-auto -mx-2 px-2 space-y-1">
          {list.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum jogador encontrado</p>}
          {list.map(a => {
            const club = clubes[String(a.clube_id)];
            const status = a.status_id ? STATUS_MAP[a.status_id] : null;
            return (
              <button
                key={a.atleta_id}
                onClick={() => { onSelect(a); onOpenChange(false); setQ(""); }}
                className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-secondary transition text-left"
                data-testid={`pick-atleta-${a.atleta_id}`}
              >
                <img src={(a.foto || "").replace("FORMATO", "65x65")} alt="" className="w-10 h-10 rounded-full object-cover bg-secondary" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-semibold text-sm truncate">{a.apelido}</span>
                    {rdlMode && <PositionBadge posicao_id={a.posicao_id} />}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Escudo src={club?.escudos?.["30x30"] ?? club?.escudos?.["45x45"]} size={14} />
                    {club?.abreviacao ?? "?"}
                    {status && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.cor }} />
                          {status.nome}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-mono-data text-primary">{(a.media_num ?? 0).toFixed(1)}</div>
                  <div className="text-[10px] text-muted-foreground font-mono-data">C$ {(a.preco_num ?? 0).toFixed(1)}</div>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
