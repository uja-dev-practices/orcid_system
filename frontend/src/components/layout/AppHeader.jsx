import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeftIcon, LayersIcon, LogoutIcon, UserCheckIcon } from "../ui/Icons";
import { useAuth } from "../../contexts/AuthContext";

/**
 * Institutional navy header used across all views.
 *
 * Variants:
 *   - `landing`   → logo + full product name.
 *   - `dashboard` → back button to `/` + auth indicator + logout (if logged in).
 *   - `group`     → back button to `/` + group label + auth indicator.
 */
export function AppHeader({ variant = "landing" }) {
  const { isAuthenticated, userOrcidId, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    toast.success("Sesión cerrada", {
      description: "Has cerrado sesión correctamente.",
    });
    navigate("/");
  }

  if (variant === "dashboard" || variant === "group") {
    return (
      <header className="flex h-14 items-center gap-4 bg-brand-primary px-7 text-white">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1.5 text-[13px] transition-colors hover:bg-white/20"
        >
          <ArrowLeftIcon />
          Inicio
        </Link>
        <div className="flex-1" />
        {isAuthenticated && (
          <div className="flex items-center gap-3">
            {userOrcidId && (
              <Link
                to={`/dashboard/${userOrcidId}`}
                className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1.5 text-[13px] transition-colors hover:bg-white/20"
              >
                <UserCheckIcon size={13} />
                Mi perfil
              </Link>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[12px] text-white/80">
              <UserCheckIcon size={13} />
              Sesión activa
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1.5 text-[13px] transition-colors hover:bg-white/20"
            >
              <LogoutIcon />
              Cerrar sesión
            </button>
          </div>
        )}
        <span className="text-[13px] text-white/60">
          {variant === "group" ? "Búsqueda grupal · ORCID" : "Sistema ORCID · SWORD"}
        </span>
      </header>
    );
  }

  return (
    <header className="flex items-center gap-3 bg-brand-primary px-8 py-3.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/15 text-white">
        <LayersIcon />
      </div>
      <span className="text-sm font-medium tracking-wide text-white">
        Sistema de Integración ORCID · SWORD
      </span>
      {isAuthenticated && (
        <div className="ml-auto flex items-center gap-2">
          {userOrcidId && (
            <Link
              to={`/dashboard/${userOrcidId}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1.5 text-[13px] transition-colors hover:bg-white/20"
            >
              <UserCheckIcon size={13} />
              Mi perfil
            </Link>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[12px] text-white/80">
            <UserCheckIcon size={13} />
            Sesión activa
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1.5 text-[13px] transition-colors hover:bg-white/20"
          >
            <LogoutIcon />
            Cerrar sesión
          </button>
        </div>
      )}
    </header>
  );
}
