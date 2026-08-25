"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import type { JobPost } from "@extra/shared/types/job";
import type { Worker } from "@extra/shared/types/worker";
import {
  workerQuickRegistrationSchema,
  type WorkerQuickRegistrationInput,
} from "@extra/shared/schemas/worker";
import { JOB_ROLE_LABELS } from "@extra/shared/constants/job-roles";
import { CURRENT_TERMS_VERSION } from "@extra/shared/constants/terms";
import { DEFAULT_CITY_ID } from "@/lib/api/cities";
import { NotificationCitiesField } from "@/components/worker/notification-cities-field";
import { createWorkerQuick } from "@/lib/api/workers";
import { applyToJob } from "@/lib/api/applications";
import { DEMO_ROLE_COOKIE, DEMO_WORKER_COOKIE } from "@/lib/api/mock";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const fieldClass =
  "border-input bg-background focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:ring-destructive/20 h-11 w-full rounded-md border px-3 text-sm transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none aria-invalid:ring-3";

const labelClass = "text-sm font-medium";

const errorClass = "text-destructive text-xs";

// Escreve os cookies "entrar como" direto no navegador — mesmo padrão da
// barra de demonstração (demo-bar.tsx): sem HttpOnly de propósito, porque
// quem escreve é este componente de cliente, não uma resposta de servidor.
function becomeCurrentWorker(workerId: string) {
  const maxAgeSeconds = 60 * 60 * 24 * 30;
  for (const [name, value] of [
    [DEMO_WORKER_COOKIE, workerId],
    [DEMO_ROLE_COOKIE, "worker"],
  ]) {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
  }
}

/**
 * Cadastro reduzido — destino do muro do "Quero essa vaga" (§16.5). Nome,
 * telefone, funções e bairro; as 6 etapas completas do §16.1 ficam para a
 * tarefa 11. Quando vem de uma vaga, ao concluir já candidata e volta pra lá
 * sem precisar tocar de novo — sem vaga de origem, mostra tela de sucesso.
 */
export function WorkerRegistrationForm({ job }: { job: JobPost | null }) {
  const router = useRouter();
  const [registered, setRegistered] = useState<Worker | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<WorkerQuickRegistrationInput>({
    resolver: zodResolver(workerQuickRegistrationSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      birthDate: "",
      roles: [],
      neighborhood: "",
      // A cidade dele já vem marcada: ele acabou de informá-la, e abrir esta
      // tela em branco é fricção no lugar errado (§16.1).
      notificationCityIds: [DEFAULT_CITY_ID],
      // Raio desligado por padrão — o ajuste mais aberto é o das cidades, não
      // o de gastar permissão de notificação que ninguém pediu.
      nearbyRadiusKm: null,
      termsVersion: CURRENT_TERMS_VERSION,
      termsAccepted: false,
    },
  });

  const notificationCityIds = useWatch({
    control,
    name: "notificationCityIds",
  });
  const nearbyRadiusKm = useWatch({ control, name: "nearbyRadiusKm" });

  if (registered) return <SuccessState worker={registered} />;

  const onSubmit = async (input: WorkerQuickRegistrationInput) => {
    const result = await createWorkerQuick(input);
    if (!result.ok) {
      const field = result.error.field as
        keyof WorkerQuickRegistrationInput | undefined;
      setError(field ?? "root", { message: result.error.message });
      return;
    }

    if (!job) {
      setRegistered(result.data);
      return;
    }

    becomeCurrentWorker(result.data.id);
    await applyToJob(job.id); // melhor esforço: falhar aqui não desfaz o cadastro
    router.push(`/vagas/${job.slug}`);
    router.refresh();
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="mt-6 grid gap-4"
    >
      <div className="grid gap-1.5">
        <label htmlFor="fullName" className={labelClass}>
          Nome completo
        </label>
        <input
          id="fullName"
          autoComplete="name"
          aria-invalid={!!errors.fullName || undefined}
          className={fieldClass}
          {...register("fullName")}
        />
        {errors.fullName && (
          <p role="alert" className={errorClass}>
            {errors.fullName.message}
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="phone" className={labelClass}>
          Telefone
        </label>
        <input
          id="phone"
          type="tel"
          autoComplete="tel"
          placeholder="+5535912345678"
          aria-invalid={!!errors.phone || undefined}
          className={fieldClass}
          {...register("phone")}
        />
        <p className="text-muted-foreground text-xs">
          Formato internacional, com DDD.
        </p>
        {errors.phone && (
          <p role="alert" className={errorClass}>
            {errors.phone.message}
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="birthDate" className={labelClass}>
          Data de nascimento
        </label>
        <input
          id="birthDate"
          type="date"
          autoComplete="bday"
          aria-invalid={!!errors.birthDate || undefined}
          className={fieldClass}
          {...register("birthDate")}
        />
        <p className="text-muted-foreground text-xs">
          Cadastro permitido só para maiores de 18 anos.
        </p>
        {errors.birthDate && (
          <p role="alert" className={errorClass}>
            {errors.birthDate.message}
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <span className={labelClass}>Funções que você faz</span>
        <p className="text-muted-foreground text-xs">Escolha até 5.</p>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(JOB_ROLE_LABELS).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                value={value}
                className="border-input size-4 shrink-0 rounded"
                {...register("roles")}
              />
              {label}
            </label>
          ))}
        </div>
        {errors.roles && (
          <p role="alert" className={errorClass}>
            {errors.roles.message}
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="neighborhood" className={labelClass}>
          Bairro
        </label>
        <input
          id="neighborhood"
          autoComplete="off"
          aria-invalid={!!errors.neighborhood || undefined}
          className={fieldClass}
          {...register("neighborhood")}
        />
        {errors.neighborhood && (
          <p role="alert" className={errorClass}>
            {errors.neighborhood.message}
          </p>
        )}
      </div>

      <NotificationCitiesField
        cityIds={notificationCityIds}
        nearbyRadiusKm={nearbyRadiusKm}
        homeCityId={DEFAULT_CITY_ID}
        error={errors.notificationCityIds?.message}
        onChange={(next) => {
          setValue("notificationCityIds", next.cityIds, {
            shouldValidate: true,
          });
          setValue("nearbyRadiusKm", next.nearbyRadiusKm);
        }}
      />

      <div className="grid gap-1.5">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="border-input mt-0.5 size-4 shrink-0 rounded"
            aria-invalid={!!errors.termsAccepted || undefined}
            {...register("termsAccepted")}
          />
          <span>Li e aceito os termos de uso da Extraqui.</span>
        </label>
        {errors.termsAccepted && (
          <p role="alert" className={errorClass}>
            {errors.termsAccepted.message}
          </p>
        )}
      </div>

      {errors.root && (
        <p role="alert" className={errorClass}>
          {errors.root.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className={cn(buttonVariants({ size: "lg" }), "h-12 w-full")}
      >
        {isSubmitting ? "Enviando..." : "Criar cadastro"}
      </button>
    </form>
  );
}

function SuccessState({ worker }: { worker: Worker }) {
  return (
    <div className="mt-6 rounded-xl border border-dashed p-6 text-center">
      <CircleCheck aria-hidden="true" className="text-primary mx-auto size-8" />
      <p className="mt-3 font-medium">
        Cadastro de {worker.fullName} recebido.
      </p>
      <p className="text-muted-foreground mt-1 text-sm">
        Você já pode se candidatar às vagas da sua função e região.
      </p>
      <Link href="/vagas" className={cn(buttonVariants(), "mt-4")}>
        Ver vagas
      </Link>
    </div>
  );
}
