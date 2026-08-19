import type { Metadata } from "next";
import { JobPostForm } from "@/components/company/job-post-form";

export const metadata: Metadata = {
  title: "Publicar vaga",
};

export default function NovaVagaPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
        Publicar vaga
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Descreva a função e os requisitos técnicos. A vaga chega para quem
        está na função e na região certas.
      </p>
      <JobPostForm />
    </div>
  );
}
