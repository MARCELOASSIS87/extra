import { Briefcase, ClipboardList, CircleUser } from "lucide-react";

/**
 * Navegação principal do trabalhador — é o público que abre o app todo dia.
 * Vive num só lugar porque o cabeçalho (desktop) e a barra inferior (mobile)
 * mostram os mesmos destinos de formas diferentes.
 */
export const mainNav = [
  { href: "/", label: "Vagas", icon: Briefcase },
  { href: "/candidaturas", label: "Candidaturas", icon: ClipboardList },
  { href: "/perfil", label: "Perfil", icon: CircleUser },
] as const;

export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
