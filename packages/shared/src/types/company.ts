export type SubscriptionStatus =
  "trialing" | "active" | "past_due" | "suspended" | "cancelled";

export interface Company {
  id: string;
  cnpj: string;
  legalName: string;
  tradeName: string;
  responsibleName: string;
  phone: string;
  email: string;
  city: string;
  subscriptionStatus: SubscriptionStatus;
  subscriptionEndsAt: string | null;
  createdAt: string;
  termsAcceptedAt: string;
}
