import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SaveTimeDialog({
  open, onOpenChange, onSave,
}: { open: boolean; onOpenChange: (v: boolean) => void; onSave: (nome: string, indice: number | null) => void }) {
  const [nome, setNome] = useState("");
  const [indice, setIndice] = useState<string>("");

  useEffect(() => { if (open) { setNome(""); setIndice(""); } }, [open]);

  const submit = () => {
    if (!nome.trim()) return;
    const i = indice === "" ? null : Math.max(0, Math.min(100, Number(indice)));
    onSave(nome.trim(), i);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wide">SALVAR TIME</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-display">Nome</label>
            <Input autoFocus value={nome} onChange={e => setNome(e.target.value)} placeholder="ex: Time Sortudo R12" data-testid="input-time-nome" />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-display">Índice de Confiança (%)</label>
            <Input type="number" min={0} max={100} step={0.1} value={indice} onChange={e => setIndice(e.target.value)} placeholder="opcional" data-testid="input-time-indice" />
            <p className="text-[11px] text-muted-foreground mt-1">Quanto você confiava nesse time antes da rodada</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} className="bg-primary text-primary-foreground hover:opacity-90" data-testid="btn-confirm-save">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
