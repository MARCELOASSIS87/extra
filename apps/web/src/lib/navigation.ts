import {
  Briefcase,
  CircleUser,
  ClipboardList,
  LayoutDashboard,
  LogIn,
  Plus,
} from "lucide-react";
import type { SessionRole } from "@/lib/api/session";

const jobs = { href: "/", label: "Vagas", icon: Briefcase } as const;
const applications = {
  href: "/candidaturas",
  label: "Minhas candidaturas",
  icon: ClipboardList,
} as const;
const profile = { href: "/perfil", label: "Perfil", icon: CircleUser } as const;
const postJob = {
  href: "/empresa/vagas/nova",
  label: "Publicar vaga",
  icon: Plus,
} as const;
const signIn = { href: "/entrar", label: "Entrar", icon: LogIn } as const;
const panel = { href: "/empresa", label: "Painel", icon: LayoutDashboard } as const;
const myJobs = {
  href: "/empresa/vagas",
  label: "Minhas vagas",
  icon: Briefcase,
} as const;

export type NavItem = {
  href: string;
  label: string;
  icon: typeof Briefcase;
};

/**
 * Mesma lista para o menu do topo (desktop) e a barra inferior (celular) — a
 * área da empresa se alcança pelo papel "Empresa", não por um link solto.
 */
export function navItems(role: SessionRole): readonly NavItem[] {
  switch (role) {
    case "worker":
      return [jobs, applications, profile];
    case "company":
      return [panel, postJob, myJobs];
    case "anonymous":
      return [jobs, postJob, signIn];
  }
}

export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
