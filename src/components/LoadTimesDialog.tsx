import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import { ESQUEMAS, type TimeEntry } from "@/lib/cartola-types";
import { Button } from "@/components/ui/button";

export function LoadTimesDialog({
  open, onOpenChange, times, onLoad, onDelete,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  times: TimeEntry[];
  onLoad: (t: TimeEntry) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wide">CARREGAR TIMES</DialogTitle>
          <DialogDescription>{times.length} time(s) salvo(s)</DialogDescription>
        </DialogHeader>
        <div className="max-h-[480px] overflow-y-auto space-y-2 -mx-2 px-2">
          {times.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum time salvo</p>}
          {times.map(t => {
            const score = t.pontuacao_final;
            const scoreColor = score === null ? "text-muted-foreground" : score >= 0 ? "text-primary" : "text-destructive";
            return (
              <div key={t.id} className="border border-border rounded-md p-3 bg-background/50">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-display font-semibold text-sm flex-1 truncate">{t.nome}</span>
                  <span className={`font-mono-data text-sm ${scoreColor}`}>
                    {score === null ? "SEM CÁLCULO" : `${score.toFixed(2)} pts`}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
                  <span>{ESQUEMAS[t.esquema_id]?.nome ?? "?"}</span>
                  <span>·</span>
                  <span>{t.jogadores.length} jogadores</span>
                  {t.reserva_luxo_id && <span style={{ color: "var(--rdl)" }}>· + RDL</span>}
                  {t.rodada_calculada && <><span>·</span><span>R{t.rodada_calculada}</span></>}
                  <span>·</span>
                  <span>{new Date(t.criado_em).toLocaleDateString("pt-BR")}</span>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={() => { onLoad(t); onOpenChange(false); }} className="bg-primary text-primary-foreground hover:opacity-90 h-7 text-xs">Carregar</Button>
                  <Button size="sm" variant="ghost" onClick={() => onDelete(t.id)} className="h-7 text-xs text-destructive hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
