import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LogOut, UserCircle2 } from "lucide-react";
import { getMercadoStatus } from "@/lib/cartola.functions";
import { useUserSession } from "@/lib/userStorage";
import { LoginDialog } from "./LoginDialog";
import logoUrl from "@/assets/logo.png";

export function Layout({ children }: { children: React.ReactNode }) {
  const { userId, logout } = useUserSession();
  const [status, setStatus] = useState<{ status_mercado_nome?: string; rodada_atual?: number } | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const fetchStatus = useServerFn(getMercadoStatus);

  useEffect(() => {
    fetchStatus().then(setStatus).catch(() => {});
  }, []);

  const aberto = status?.status_mercado_nome === "aberto";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-3" data-testid="logo-link">
            <img src={logoUrl} alt="Cartola Lab" width={40} height={40} className="w-10 h-10 object-contain" />
            <div>
              <div className="font-display font-bold text-lg leading-none tracking-wider">CARTOLA LAB</div>
              <div className="text-[10px] text-muted-foreground tracking-[0.2em] font-display">PÓS-RODADA</div>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {status && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground font-mono-data">
                <span
                  className="w-2 h-2 rounded-full pulse-dot"
                  style={{ background: aberto ? "var(--primary)" : "var(--rdl)" }}
                />
                Mercado {status.status_mercado_nome} · R{status.rodada_atual}
              </div>
            )}
            {userId ? (
              <div className="flex items-center gap-2 rounded-full bg-secondary border border-border pl-3 pr-1 py-1">
                <UserCircle2 className="w-4 h-4 text-primary" />
                <span className="font-mono-data text-xs uppercase">{userId}</span>
                <button
                  onClick={logout}
                  data-testid="btn-logout"
                  className="w-7 h-7 rounded-full hover:bg-background flex items-center justify-center text-muted-foreground hover:text-foreground transition"
                  aria-label="Sair"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setLoginOpen(true)}
                data-testid="btn-open-login"
                className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-display font-bold tracking-wider hover:opacity-90 transition"
              >
                ENTRAR
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </div>
  );
}
