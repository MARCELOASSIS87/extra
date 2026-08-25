"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CircleCheck, ShieldAlert } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import type { JobPost } from "@extra/shared/types/job";
import {
  jobPostFormSchema,
  JOB_REACH_RADIUS_OPTIONS,
  type JobPostFormInput,
} from "@extra/shared/schemas/job";
import type { JobReach } from "@extra/shared/types/job";
import { JOB_ROLE_LABELS } from "@extra/shared/constants/job-roles";
import { countReachedWorkers, createJob } from "@/lib/api/jobs";
import { cityName, DEFAULT_CITY_ID } from "@/lib/api/cities";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const fieldClass =
  "border-input bg-background focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:ring-destructive/20 h-11 w-full rounded-md border px-3 text-sm transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none aria-invalid:ring-3";

const textareaClass = cn(fieldClass, "h-auto min-h-24 py-2");

const labelClass = "text-sm font-medium";

const errorClass = "text-destructive text-xs";

// Mensagem do próprio schema (§14.1) já é explicativa, não acusatória — o
// formulário só a exibe com um pouco mais de contexto visual, sem duplicar
// o texto nem inventar um segundo tom para o mesmo bloqueio.
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  const isDiscriminatory = message.includes("art. 373-A");
  return (
    <p role="alert" className={cn(errorClass, "flex items-start gap-1.5")}>
      {isDiscriminatory && (
        <ShieldAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      )}
      <span>{message}</span>
    </p>
  );
}

export function JobPostForm() {
  const [published, setPublished] = useState<JobPost | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    control,
    setValue,
    formState: { errors, isSubmitting },
    // Três campos, do jeito que a empresa pensa. Os dois instantes do
    // contrato saem do `.transform()` de `jobPostSchema`, no envio.
  } = useForm<JobPostFormInput>({
    resolver: zodResolver(jobPostFormSchema),
    defaultValues: {
      role: "garcom",
      title: "",
      description: "",
      date: "",
      startTime: "",
      endTime: "",
      payAmount: 0,
      payNote: null,
      address: "",
      neighborhood: "",
      requirements: null,
      vacancies: 1,
      providesTransport: false,
      // Nasce no mais aberto: padrão restritivo mata vaga em silêncio (§7.5).
      reach: "unrestricted",
      reachRadiusKm: null,
    },
  });

  const role = useWatch({ control, name: "role" });
  const reach = useWatch({ control, name: "reach" });
  const reachRadiusKm = useWatch({ control, name: "reachRadiusKm" });

  if (published) return <SuccessState job={published} />;

  const onSubmit = async (input: JobPostFormInput) => {
    const result = await createJob(input);
    if (!result.ok) {
      const field = result.error.field as keyof JobPostFormInput | undefined;
      setError(field ?? "root", { message: result.error.message });
      return;
    }
    setPublished(result.data);
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="mt-6 grid gap-4"
    >
      <div className="grid gap-1.5">
        <label htmlFor="role" className={labelClass}>
          Função
        </label>
        <select
          id="role"
          aria-invalid={!!errors.role || undefined}
          className={fieldClass}
          {...register("role")}
        >
          {Object.entries(JOB_ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <FieldError message={errors.role?.message} />
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="title" className={labelClass}>
          Título da vaga
        </label>
        <input
          id="title"
          placeholder="Ex.: Garçom para formatura no sábado"
          aria-invalid={!!errors.title || undefined}
          className={fieldClass}
          {...register("title")}
        />
        <FieldError message={errors.title?.message} />
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="description" className={labelClass}>
          Descrição
        </label>
        <textarea
          id="description"
          rows={4}
          placeholder="Descreva a função e os requisitos técnicos."
          aria-invalid={!!errors.description || undefined}
          className={textareaClass}
          {...register("description")}
        />
        <FieldError message={errors.description?.message} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <label htmlFor="date" className={labelClass}>
            Data
          </label>
          <input
            id="date"
            type="date"
            aria-invalid={!!errors.date || undefined}
            className={fieldClass}
            {...register("date")}
          />
          <FieldError message={errors.date?.message} />
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="startTime" className={labelClass}>
            Início
          </label>
          <input
            id="startTime"
            type="time"
            aria-invalid={!!errors.startTime || undefined}
            className={fieldClass}
            {...register("startTime")}
          />
          <FieldError message={errors.startTime?.message} />
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="endTime" className={labelClass}>
            Fim
          </label>
          <input
            id="endTime"
            type="time"
            aria-invalid={!!errors.endTime || undefined}
            className={fieldClass}
            {...register("endTime")}
          />
          <FieldError message={errors.endTime?.message} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label htmlFor="payAmount" className={labelClass}>
            Valor do bico (R$)
          </label>
          <input
            id="payAmount"
            type="number"
            inputMode="numeric"
            step="1"
            min="1"
            aria-invalid={!!errors.payAmount || undefined}
            className={fieldClass}
            {...register("payAmount", { valueAsNumber: true })}
          />
          <p className="text-muted-foreground text-xs">
            Reais inteiros, sem centavos. Informativo: o acerto é direto entre
            vocês.
          </p>
          <FieldError message={errors.payAmount?.message} />
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="vacancies" className={labelClass}>
            Vagas
          </label>
          <input
            id="vacancies"
            type="number"
            inputMode="numeric"
            step="1"
            min="1"
            aria-invalid={!!errors.vacancies || undefined}
            className={fieldClass}
            {...register("vacancies", { valueAsNumber: true })}
          />
          <FieldError message={errors.vacancies?.message} />
        </div>
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="payNote" className={labelClass}>
          Observação sobre o pagamento (opcional)
        </label>
        <input
          id="payNote"
          placeholder="Ex.: pagamento no fim do turno"
          aria-invalid={!!errors.payNote || undefined}
          className={fieldClass}
          {...register("payNote", {
            setValueAs: (value: string | null) =>
              value && value.trim() ? value : null,
          })}
        />
        <FieldError message={errors.payNote?.message} />
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="address" className={labelClass}>
          Endereço
        </label>
        <input
          id="address"
          autoComplete="street-address"
          aria-invalid={!!errors.address || undefined}
          className={fieldClass}
          {...register("address")}
        />
        <FieldError message={errors.address?.message} />
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="neighborhood" className={labelClass}>
          Bairro
        </label>
        <input
          id="neighborhood"
          aria-invalid={!!errors.neighborhood || undefined}
          className={fieldClass}
          {...register("neighborhood")}
        />
        <FieldError message={errors.neighborhood?.message} />
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="requirements" className={labelClass}>
          Requisitos (opcional)
        </label>
        <textarea
          id="requirements"
          rows={3}
          placeholder="Ex.: uniforme preto e social, chegar 30 min antes."
          aria-invalid={!!errors.requirements || undefined}
          className={textareaClass}
          {...register("requirements", {
            setValueAs: (value: string | null) =>
              value && value.trim() ? value : null,
          })}
        />
        <FieldError message={errors.requirements?.message} />
      </div>

      <div className="grid gap-1.5">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="border-input mt-0.5 size-4 shrink-0 rounded"
            {...register("providesTransport")}
          />
          <span>A empresa leva e traz a equipe</span>
        </label>
        <p className="text-muted-foreground text-xs">
          É o que faz o bico de outra cidade valer a pena. Aparece no anúncio e
          no aviso.
        </p>
      </div>

      <ReachField
        value={reach}
        radiusKm={reachRadiusKm}
        role={role}
        onChange={(next) => {
          setValue("reach", next.reach);
          setValue("reachRadiusKm", next.radiusKm, { shouldValidate: true });
        }}
        error={errors.reachRadiusKm?.message}
      />

      {errors.root && <FieldError message={errors.root.message} />}

      <button
        type="submit"
        disabled={isSubmitting}
        className={cn(buttonVariants({ size: "lg" }), "h-12 w-full")}
      >
        {isSubmitting ? "Publicando..." : "Publicar vaga"}
      </button>
    </form>
  );
}

function SuccessState({ job }: { job: JobPost }) {
  return (
    <div className="mt-6 rounded-xl border border-dashed p-6 text-center">
      <CircleCheck aria-hidden="true" className="text-primary mx-auto size-8" />
      <p className="mt-3 font-medium">
        Vaga &ldquo;{job.title}&rdquo; publicada.
      </p>
      <p className="text-muted-foreground mt-1 text-sm">
        Os trabalhadores da função e da região já podem ser notificados.
      </p>
      <Link href="/empresa/vagas" className={cn(buttonVariants(), "mt-4")}>
        Ver minhas vagas
      </Link>
    </div>
  );
}

const REACH_LABELS: Record<JobReach, string> = {
  unrestricted: "Qualquer pessoa que aceite receber vagas daqui",
  nearby: "Só quem está a até um raio daqui",
  city_only: `Só quem mora em ${cityName(DEFAULT_CITY_ID)}`,
};

/**
 * Alcance com o custo de estreitar na tela (§16.2). Sem o número ao lado de
 * cada opção a empresa marca "só minha cidade" por precaução, ninguém aparece
 * e ela conclui que o site não funciona sem nunca saber por quê.
 *
 * O alcance só estreita: quem assinou esta cidade na mão recebe de qualquer
 * jeito, e é por isso que o campo não precisa de teto.
 */
function ReachField({
  value,
  radiusKm,
  role,
  onChange,
  error,
}: {
  value: JobReach;
  radiusKm: number | null;
  role: JobPostFormInput["role"];
  onChange: (next: { reach: JobReach; radiusKm: number | null }) => void;
  error?: string;
}) {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    let active = true;
    const options: { key: string; reach: JobReach; radius: number | null }[] = [
      { key: "unrestricted", reach: "unrestricted", radius: null },
      ...JOB_REACH_RADIUS_OPTIONS.map((km) => ({
        key: `nearby:${km}`,
        reach: "nearby" as const,
        radius: km,
      })),
      { key: "city_only", reach: "city_only", radius: null },
    ];

    Promise.all(
      options.map(async (option) => [
        option.key,
        await countReachedWorkers({
          cityId: DEFAULT_CITY_ID,
          role,
          reach: option.reach,
          reachRadiusKm: option.radius,
        }),
      ]),
    ).then((entries) => {
      if (active) setCounts(Object.fromEntries(entries));
    });

    return () => {
      active = false;
    };
  }, [role]);

  const avisados = (key: string) => {
    if (!counts) return null;
    const total = counts[key];
    return (
      <span className="text-muted-foreground block text-xs">
        {total === 1 ? "1 pessoa avisada" : `${total} pessoas avisadas`}
      </span>
    );
  };

  const option = (
    key: string,
    label: string,
    checked: boolean,
    onSelect: () => void,
  ) => (
    <label
      key={key}
      className="has-checked:border-primary has-checked:bg-secondary flex items-start gap-2 rounded-lg border p-3 text-sm"
    >
      <input
        type="radio"
        name="reach"
        checked={checked}
        onChange={onSelect}
        className="mt-0.5 size-4 shrink-0"
      />
      <span>
        {label}
        {avisados(key)}
      </span>
    </label>
  );

  return (
    <fieldset className="grid gap-2">
      <legend className={labelClass}>Quem recebe o aviso desta vaga</legend>
      <p className="text-muted-foreground text-xs">
        Estreitar reduz quem é avisado. Ver a vaga e se candidatar continua
        aberto a qualquer pessoa.
      </p>

      {option(
        "unrestricted",
        REACH_LABELS.unrestricted,
        value === "unrestricted",
        () => onChange({ reach: "unrestricted", radiusKm: null }),
      )}

      {JOB_REACH_RADIUS_OPTIONS.map((km) =>
        option(
          `nearby:${km}`,
          `Até ${km} km de ${cityName(DEFAULT_CITY_ID)}`,
          value === "nearby" && radiusKm === km,
          () => onChange({ reach: "nearby", radiusKm: km }),
        ),
      )}

      {option("city_only", REACH_LABELS.city_only, value === "city_only", () =>
        onChange({ reach: "city_only", radiusKm: null }),
      )}

      <FieldError message={error} />
    </fieldset>
  );
}
