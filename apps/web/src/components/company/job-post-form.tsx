"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CircleCheck, ShieldAlert } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import type { PublicJobPost } from "@extra/shared/types/job";
import {
  jobPostFormSchema,
  JOB_REACH_RADIUS_OPTIONS,
  type JobPostFormInput,
} from "@extra/shared/schemas/job";
import type { JobReach } from "@extra/shared/types/job";
import { JOB_ROLE_LABELS } from "@extra/shared/constants/job-roles";
import { saoPauloToUtc } from "@extra/shared/lib/datetime";
import { countReachedWorkers, createJob } from "@/lib/api/jobs";
import { cityName, listCities } from "@/lib/api/cities";
import { getMyCompany } from "@/lib/api/companies";
import { FilterSheet } from "@/components/filters/filter-sheet";
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
  const [published, setPublished] = useState<PublicJobPost | null>(null);

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
      // Pré-selecionada com a cidade da empresa assim que ela carrega, mas
      // é campo de verdade: o trabalho acontece onde a empresa disser.
      cityId: "",
      requirements: null,
      vacancies: 1,
      providesTransport: false,
      // Nasce no mais aberto: padrão restritivo mata vaga em silêncio (§7.5).
      reach: "unrestricted",
      reachRadiusKm: null,
    },
  });

  const cityId = useWatch({ control, name: "cityId" });

  // A cidade da empresa é só o PADRÃO: quem publica troca quando o bico é em
  // outro município, que é o caso normal de buffet e de empresa de eventos.
  useEffect(() => {
    let active = true;
    getMyCompany().then((result) => {
      if (!active || !result.ok || !result.data) return;
      setValue("cityId", result.data.cityId, { shouldValidate: false });
    });
    return () => {
      active = false;
    };
  }, [setValue]);

  const role = useWatch({ control, name: "role" });
  const reach = useWatch({ control, name: "reach" });
  const reachRadiusKm = useWatch({ control, name: "reachRadiusKm" });
  const date = useWatch({ control, name: "date" });
  const startTime = useWatch({ control, name: "startTime" });

  /**
   * O instante de início, montado igual ao que `jobPostSchema` monta no envio
   * — a contagem tem que perguntar pela MESMA vaga que vai ser publicada.
   *
   * `undefined` enquanto os dois campos não estiverem preenchidos: aí o
   * servidor conta sem o recorte de dia e período, e o número volta como TETO.
   */
  const startsAt =
    date && startTime ? saoPauloToUtc(date, startTime) : undefined;

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

      {/* Cidade antes do endereço: é ela que decide quem recebe o aviso e
          qual página o Google indexa, e o endereço só faz sentido dentro
          dela. Mesmo seletor da busca (§7.1) — id da tabela `cities`, nunca
          texto digitado. */}
      <div className="grid gap-1.5">
        <span className={labelClass}>Cidade do trabalho</span>
        <FilterSheet
          label="Cidade do trabalho"
          value={cityId || null}
          options={listCities().map((city) => ({
            value: city.id,
            label: `${city.name} — ${city.uf}`,
          }))}
          onChange={(next) =>
            setValue("cityId", next ?? "", { shouldValidate: true })
          }
          allOptionLabel="Escolha a cidade"
          emptyLabel="Escolha a cidade"
        />
        <p className="text-muted-foreground text-xs">
          Onde o trabalho acontece. É ela que decide quem recebe o aviso.
        </p>
        <FieldError message={errors.cityId?.message} />
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
        cityId={cityId}
        startsAt={startsAt}
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

function SuccessState({ job }: { job: PublicJobPost }) {
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
  city_only: "Só quem mora na cidade da vaga",
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
  cityId,
  startsAt,
  onChange,
  error,
}: {
  value: JobReach;
  radiusKm: number | null;
  role: JobPostFormInput["role"];
  /** A cidade DA VAGA: o alcance e a contagem giram em torno dela, não da
   *  cidade em que a empresa está registrada. */
  cityId: string;
  /**
   * Início da vaga, quando já preenchido. Ausente, a contagem ignora a
   * disponibilidade e o número é um TETO — e a copy tem que dizer isso.
   */
  startsAt?: string;
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

    // Sem cidade escolhida não há em torno de que contar. Só sai do efeito:
    // zerar aqui seria setState síncrono, que dispara render em cascata.
    if (!cityId) return;

    Promise.all(
      options.map(async (option) => [
        option.key,
        await countReachedWorkers({
          cityId,
          role,
          reach: option.reach,
          reachRadiusKm: option.radius,
          startsAt,
        }),
      ]),
    ).then((entries) => {
      if (active) setCounts(Object.fromEntries(entries));
    });

    return () => {
      active = false;
    };
  }, [role, cityId, startsAt]);

  const avisados = (key: string) => {
    // O número é a razão de o campo existir: enquanto não chega, dizer que
    // está contando é melhor do que a linha aparecer do nada e empurrar tudo.
    if (!counts) {
      return (
        <span className="text-muted-foreground block text-xs">
          contando quem seria avisado…
        </span>
      );
    }
    const total = counts[key];
    // Sem data, o número ignora a disponibilidade de dia e período: é um TETO,
    // e prometer alcance cravado a quem paga é o pior lugar para errar. Com a
    // data preenchida o recorte é o mesmo do push, e aí o número é exato.
    return (
      <span className="text-muted-foreground block text-xs">
        {startsAt
          ? total === 1
            ? "1 pessoa será avisada"
            : `${total} pessoas serão avisadas`
          : total === 1
            ? "até 1 pessoa será avisada"
            : `até ${total} pessoas serão avisadas`}
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
          `Até ${km} km de ${cityName(cityId) || "a cidade da vaga"}`,
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
