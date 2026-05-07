import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserCircle2, ArrowRightCircle, AlertTriangle } from "lucide-react";
import { useUserSession, validateId } from "@/lib/userStorage";
import { toast } from "sonner";

export function LoginDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { login } = useUserSession();
  const [id, setId] = useState("");

  const submit = () => {
    const trimmed = id.trim();
    if (!validateId(trimmed)) {
      toast.error("ID inválido. Use 3 a 32 caracteres: letras, números, _ ou -");
      return;
    }
    login(trimmed);
    toast.success(`Bem-vindo, ${trimmed.toUpperCase()}`);
    onOpenChange(false);
    setId("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display tracking-wide">
            <UserCircle2 className="w-5 h-5 text-primary" /> ENTRAR COM ID
          </DialogTitle>
          <DialogDescription>
            Crie um código de acesso (apelido) para sincronizar seu histórico entre dispositivos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-display">Seu ID</label>
            <Input
              autoFocus
              value={id}
              onChange={e => setId(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
              placeholder="ex: bia2026"
              className="font-mono-data uppercase mt-1"
              data-testid="input-user-id"
            />
            <p className="text-[11px] text-muted-foreground mt-1">3 a 32 caracteres · letras, números, _ ou -</p>
          </div>

          <div className="flex gap-2 items-start rounded-md border border-border bg-background p-2.5 text-[11px] text-muted-foreground">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--rdl)" }} />
            <span>Times salvos neste navegador serão automaticamente importados na 1ª vez que você entrar.</span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} className="bg-primary text-primary-foreground hover:opacity-90" data-testid="btn-confirm-login">
            <ArrowRightCircle className="w-4 h-4 mr-1" /> Entrar / Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
