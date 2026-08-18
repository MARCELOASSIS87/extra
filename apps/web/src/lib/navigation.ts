import {
  Briefcase,
  CircleUser,
  ClipboardList,
  LogIn,
  Plus,
} from "lucide-react";

const jobs = { href: "/", label: "Vagas", icon: Briefcase } as const;
const applications = {
  href: "/candidaturas",
  label: "Candidaturas",
  icon: ClipboardList,
} as const;
const profile = { href: "/perfil", label: "Perfil", icon: CircleUser } as const;
const postJob = {
  href: "/empresa/vagas/nova",
  label: "Publicar vaga",
  icon: Plus,
} as const;
const signIn = { href: "/entrar", label: "Entrar", icon: LogIn } as const;

export type NavItem = {
  href: string;
  label: string;
  icon: typeof Briefcase;
};

/**
 * Candidaturas e Perfil só existem para quem tem sessão: levariam o visitante
 * a uma tela vazia ou a um pedido de login disfarçado de menu.
 */
export function navItems(authenticated: boolean): readonly NavItem[] {
  return authenticated
    ? [jobs, applications, profile]
    : [jobs, postJob, signIn];
}

/** Links do cabeçalho em telas grandes; os atalhos de ação ficam à direita. */
export function headerNavItems(authenticated: boolean): readonly NavItem[] {
  return authenticated ? [jobs, applications, profile] : [jobs];
}

export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
