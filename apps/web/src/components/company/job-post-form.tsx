"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleCheck, ShieldAlert } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { JobPost } from "@extra/shared/types/job";
import { jobPostSchema, type JobPostInput } from "@extra/shared/schemas/job";
import { JOB_ROLE_LABELS } from "@extra/shared/constants/job-roles";
import { createJob } from "@/lib/api/jobs";
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
    formState: { errors, isSubmitting },
  } = useForm<JobPostInput>({
    resolver: zodResolver(jobPostSchema),
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
    },
  });

  if (published) return <SuccessState job={published} />;

  const onSubmit = async (input: JobPostInput) => {
    const result = await createJob(input);
    if (!result.ok) {
      const field = result.error.field as keyof JobPostInput | undefined;
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
            setValueAs: (value: string | null) => (value && value.trim() ? value : null),
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
            setValueAs: (value: string | null) => (value && value.trim() ? value : null),
          })}
        />
        <FieldError message={errors.requirements?.message} />
      </div>

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
      <p className="mt-3 font-medium">Vaga &ldquo;{job.title}&rdquo; publicada.</p>
      <p className="text-muted-foreground mt-1 text-sm">
        Os trabalhadores da função e da região já podem ser notificados.
      </p>
      <Link href="/empresa/vagas" className={cn(buttonVariants(), "mt-4")}>
        Ver minhas vagas
      </Link>
    </div>
  );
}
