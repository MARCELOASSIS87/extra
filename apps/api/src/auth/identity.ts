import type { AuthIdentity } from "@extra/shared/types/account";
import { prisma } from "../db.js";

/** O que a sessão carrega, mais a versão que só o servidor enxerga. */
export interface LoadedIdentity extends AuthIdentity {
  sessionVersion: number;
}

/**
 * Uma consulta só para conta e perfis. É ela que roda em toda requisição
 * autenticada, e é onde a versão de sessão é conferida contra o banco — sem
 * essa ida ao banco, um token vazado vale 30 dias e não há como matá-lo.
 */
export async function loadIdentity(
  accountId: string,
): Promise<LoadedIdentity | null> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      phone: true,
      phoneVerifiedAt: true,
      createdAt: true,
      sessionVersion: true,
      worker: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          status: true,
          profileCompletedAt: true,
        },
      },
      company: {
        select: { id: true, tradeName: true, subscriptionStatus: true },
      },
    },
  });

  if (!account) return null;

  return {
    sessionVersion: account.sessionVersion,
    account: {
      id: account.id,
      phone: account.phone,
      phoneVerifiedAt: account.phoneVerifiedAt?.toISOString() ?? null,
      createdAt: account.createdAt.toISOString(),
    },
    worker: account.worker
      ? {
          id: account.worker.id,
          fullName: `${account.worker.firstName} ${account.worker.lastName}`,
          status: account.worker.status,
          profileCompletedAt:
            account.worker.profileCompletedAt?.toISOString() ?? null,
        }
      : null,
    company: account.company
      ? {
          id: account.company.id,
          tradeName: account.company.tradeName,
          subscriptionStatus: account.company.subscriptionStatus,
        }
      : null,
  };
}
