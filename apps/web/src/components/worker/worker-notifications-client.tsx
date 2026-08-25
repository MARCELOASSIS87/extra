"use client";

import { useEffect, useState } from "react";
import { CircleCheck } from "lucide-react";
import type { WorkerNotificationPreferences } from "@extra/shared/schemas/city";
import type { Worker } from "@extra/shared/types/worker";
import { getMyWorkerProfile, updateMyWorkerProfile } from "@/lib/api/workers";
import { NotificationCitiesField } from "@/components/worker/notification-cities-field";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A mesma tela do cadastro, editável (§16.2, item 4). Salvar é explícito: em
 * 4G ruim, gravar a cada toque numa lista de checkbox vira fila de requisição
 * e a pessoa não sabe mais o que está valendo.
 */
export function WorkerNotificationsClient() {
  const [worker, setWorker] = useState<Worker | null | "loading" | "error">(
    "loading",
  );
  const [draft, setDraft] = useState<WorkerNotificationPreferences | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    getMyWorkerProfile().then((result) => {
      if (!active) return;
      if (!result.ok) return setWorker("error");
      setWorker(result.data);
      if (result.data) {
        setDraft({
          notificationCityIds: result.data.notificationCityIds,
          nearbyRadiusKm: result.data.nearbyRadiusKm,
        });
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (worker === "loading") return <Skeleton />;

  if (worker === "error") {
    return (
      <Notice>
        Não foi possível carregar seu perfil. Verifique a conexão e tente de
        novo.
      </Notice>
    );
  }

  if (!worker || !draft) {
    return (
      <Notice>
        Você ainda não tem cadastro de trabalhador.{" "}
        <a href="/cadastro/trabalhador" className="underline">
          Criar cadastro
        </a>
        .
      </Notice>
    );
  }

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    const result = await updateMyWorkerProfile(draft);
    setSaving(false);
    if (!result.ok) return setSaveError(result.error.message);
    setWorker(result.data);
    setSaved(true);
  };

  return (
    <div className="mt-6 grid gap-4">
      <NotificationCitiesField
        value={draft}
        homeCityId={worker.cityId}
        onChange={(next) => {
          setSaved(false);
          setDraft(next);
        }}
      />

      {saveError && (
        <p role="alert" className="text-destructive text-xs">
          {saveError}
        </p>
      )}

      {saved && (
        <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
          <CircleCheck aria-hidden="true" className="text-primary size-4" />
          Preferências salvas.
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={saving || draft.notificationCityIds.length === 0}
        className={cn(buttonVariants({ size: "lg" }), "h-12 w-full")}
      >
        {saving ? "Salvando..." : "Salvar"}
      </button>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mt-6 grid gap-2" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="bg-muted h-6 animate-pulse rounded" />
      ))}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground mt-6 rounded-xl border border-dashed p-6 text-center text-sm">
      {children}
    </p>
  );
}
