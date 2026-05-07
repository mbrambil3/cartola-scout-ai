import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SaveTimeDialog({
  open, onOpenChange, onSave,
}: { open: boolean; onOpenChange: (v: boolean) => void; onSave: (nome: string, indice: number | null) => void }) {
  const [nome, setNome] = useState("");

  useEffect(() => { if (open) { setNome(""); } }, [open]);

  const submit = () => {
    if (!nome.trim()) return;
    onSave(nome.trim(), null);
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
            <Input autoFocus value={nome} onChange={e => setNome(e.target.value)} placeholder="ex: Time Sortudo R12" data-testid="input-time-nome" onKeyDown={e => e.key === "Enter" && submit()} />
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
