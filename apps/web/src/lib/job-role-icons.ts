import {
  BrushCleaning,
  CarFront,
  ChefHat,
  ConciergeBell,
  CookingPot,
  Ellipsis,
  HardHat,
  Martini,
  ShieldCheck,
  SprayCan,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import type { JobRole } from "@extra/shared/types/job";
import { JOB_ROLE_ICON_NAMES } from "@extra/shared/constants/job-role-icons";
import { JOB_ROLE_LABELS } from "@extra/shared/constants/job-roles";
import type { FilterOption } from "@/components/filters/filter-sheet";

const ICON_BY_NAME: Record<string, LucideIcon> = {
  UtensilsCrossed,
  ChefHat,
  CookingPot,
  BrushCleaning,
  SprayCan,
  Martini,
  ShieldCheck,
  ConciergeBell,
  HardHat,
  CarFront,
  Ellipsis,
};

/** Ícone por função, pronto para renderizar — resolvido a partir do nome que vive em packages/shared. */
export const JOB_ROLE_ICONS: Record<JobRole, LucideIcon> = Object.fromEntries(
  Object.entries(JOB_ROLE_ICON_NAMES).map(([role, name]) => [
    role,
    ICON_BY_NAME[name],
  ]),
) as Record<JobRole, LucideIcon>;

/** Lista pronta para os dois filtros de função (home e listagem) — label + ícone. */
export const ROLE_FILTER_OPTIONS: readonly FilterOption<JobRole>[] = (
  Object.keys(JOB_ROLE_LABELS) as JobRole[]
).map((value) => ({
  value,
  label: JOB_ROLE_LABELS[value],
  icon: JOB_ROLE_ICONS[value],
}));
