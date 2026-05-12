import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { LogoutIcon, UserCheckIcon } from "../ui/Icons";
import { useAuth } from "../../contexts/AuthContext";

/**
 * Institutional navy header used across all views.
 *
 * Brand: ORCID2SWORD — "2" in orcid-green, rest in white.
 * Authenticated users see their name (or "Mi Perfil") + logout button.
 */
export function AppHeader({ variant = "landing" }) {
  const { isAuthenticated, userOrcidId, userName, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    toast.success("Sesión cerrada", {
      description: "Has cerrado sesión correctamente.",
    });
    navigate("/");
  }

  const profileLabel = userName ?? "Mi Perfil";
  const profileHref = userOrcidId ? `/dashboard/${userOrcidId}` : "/";

  return (
    <header className="bg-brand-primary">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4">
        {/* Brand — always navigates home */}
        <Link
          to="/"
          className="text-[16px] font-bold tracking-tight text-white transition-opacity hover:opacity-90"
        >
          ORCID<span className="text-orcid-green">2</span>SWORD
        </Link>

        <div className="flex-1" />

        {isAuthenticated && (
          <div className="flex items-center gap-2">
            <Link
              to={profileHref}
              className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-[13px] text-white transition-colors hover:bg-white/20"
            >
              <UserCheckIcon size={13} />
              {profileLabel}
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-[13px] text-white transition-colors hover:bg-white/20"
            >
              <LogoutIcon />
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
