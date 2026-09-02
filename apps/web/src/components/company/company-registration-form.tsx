"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import type { Company } from "@extra/shared/types/company";
import {
  companyRegistrationSchema,
  type CompanyRegistrationInput,
} from "@extra/shared/schemas/company";
import { createCompany } from "@/lib/api/companies";
import { DEFAULT_CITY_ID, listCities } from "@/lib/api/cities";
import { FilterSheet } from "@/components/filters/filter-sheet";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const fieldClass =
  "border-input bg-background focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:ring-destructive/20 h-11 w-full rounded-md border px-3 text-sm transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none aria-invalid:ring-3";

const labelClass = "text-sm font-medium";

const errorClass = "text-destructive text-xs";

export function CompanyRegistrationForm() {
  const [registered, setRegistered] = useState<Company | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CompanyRegistrationInput>({
    resolver: zodResolver(companyRegistrationSchema),
    defaultValues: {
      cnpj: "",
      legalName: "",
      tradeName: "",
      responsibleName: "",
      phone: "",
      email: "",
      // Onde a empresa está registrada. NÃO é a cidade da vaga — aquela é
      // escolhida a cada anúncio, porque é onde o trabalho acontece.
      cityId: DEFAULT_CITY_ID,
      termsAccepted: false,
    },
  });

  const cityId = useWatch({ control, name: "cityId" });

  if (registered) return <SuccessState company={registered} />;

  const onSubmit = async (input: CompanyRegistrationInput) => {
    const result = await createCompany(input);
    if (!result.ok) {
      const field = result.error.field as
        keyof CompanyRegistrationInput | undefined;
      setError(field ?? "root", { message: result.error.message });
      return;
    }
    setRegistered(result.data);
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="mt-6 grid gap-4"
    >
      <div className="grid gap-1.5">
        <label htmlFor="cnpj" className={labelClass}>
          CNPJ
        </label>
        <input
          id="cnpj"
          inputMode="numeric"
          autoComplete="off"
          placeholder="00.000.000/0000-00"
          aria-invalid={!!errors.cnpj || undefined}
          className={fieldClass}
          {...register("cnpj")}
        />
        {errors.cnpj && (
          <p role="alert" className={errorClass}>
            {errors.cnpj.message}
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="legalName" className={labelClass}>
          Razão social
        </label>
        <input
          id="legalName"
          autoComplete="organization"
          aria-invalid={!!errors.legalName || undefined}
          className={fieldClass}
          {...register("legalName")}
        />
        {errors.legalName && (
          <p role="alert" className={errorClass}>
            {errors.legalName.message}
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="tradeName" className={labelClass}>
          Nome fantasia
        </label>
        <input
          id="tradeName"
          autoComplete="off"
          aria-invalid={!!errors.tradeName || undefined}
          className={fieldClass}
          {...register("tradeName")}
        />
        {errors.tradeName && (
          <p role="alert" className={errorClass}>
            {errors.tradeName.message}
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="responsibleName" className={labelClass}>
          Nome do responsável
        </label>
        <input
          id="responsibleName"
          autoComplete="name"
          aria-invalid={!!errors.responsibleName || undefined}
          className={fieldClass}
          {...register("responsibleName")}
        />
        {errors.responsibleName && (
          <p role="alert" className={errorClass}>
            {errors.responsibleName.message}
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
        <label htmlFor="email" className={labelClass}>
          E-mail
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email || undefined}
          className={fieldClass}
          {...register("email")}
        />
        {errors.email && (
          <p role="alert" className={errorClass}>
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <span className={labelClass}>Cidade da empresa</span>
        <FilterSheet
          label="Cidade da empresa"
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
          Onde a empresa fica. Cada vaga escolhe a cidade do trabalho.
        </p>
        {errors.cityId && (
          <p role="alert" className={errorClass}>
            {errors.cityId.message}
          </p>
        )}
      </div>

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

function SuccessState({ company }: { company: Company }) {
  return (
    <div className="mt-6 rounded-xl border border-dashed p-6 text-center">
      <CircleCheck aria-hidden="true" className="text-primary mx-auto size-8" />
      <p className="mt-3 font-medium">
        Cadastro de {company.tradeName} recebido.
      </p>
      <p className="text-muted-foreground mt-1 text-sm">
        Já dá para publicar sua primeira vaga.
      </p>
      <Link href="/empresa/vagas/nova" className={cn(buttonVariants(), "mt-4")}>
        Publicar vaga
      </Link>
    </div>
  );
}
