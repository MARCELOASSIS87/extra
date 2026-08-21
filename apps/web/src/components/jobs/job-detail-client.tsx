"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import type { Application } from "@extra/shared/types/application";
import type { JobPost } from "@extra/shared/types/job";
import { getJobBySlug } from "@/lib/api/jobs";
import { listMyApplications } from "@/lib/api/applications";
import { getMyWorkerProfile } from "@/lib/api/workers";
import { getSessionRole } from "@/lib/api/session";
import {
  JobDetailSkeleton,
  JobDetailView,
} from "@/components/jobs/job-detail-view";

interface LoadedJob {
  job: JobPost;
  myApplication: Application | null;
  workerName: string;
  isWorker: boolean;
}

/**
 * Mesmas funções de lib/api/ do caminho do servidor, chamadas do navegador —
 * é o que permite uma vaga publicada na demonstração (estado no localStorage)
 * ter detalhe completo e aceitar candidatura como qualquer outra.
 */
export function JobDetailClient({ slug }: { slug: string }) {
  const [loaded, setLoaded] = useState<LoadedJob | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let active = true;

    // Em paralelo: se a pessoa já se candidatou, o nome dela e o papel da
    // sessão não dependem um do outro.
    Promise.all([
      getJobBySlug(slug),
      listMyApplications(),
      getMyWorkerProfile(),
      getSessionRole(),
    ]).then(([jobResult, applicationsResult, workerResult, role]) => {
      if (!active) return;

      if (!jobResult.ok || !jobResult.data) {
        setMissing(true);
        return;
      }
      const job = jobResult.data;

      setLoaded({
        job,
        myApplication: applicationsResult.ok
          ? (applicationsResult.data.find(
              (item) => item.jobPostId === job.id && item.status !== "withdrawn",
            ) ?? null)
          : null,
        workerName:
          workerResult.ok && workerResult.data ? workerResult.data.fullName : "",
        isWorker: role === "worker",
      });
    });

    return () => {
      active = false;
    };
  }, [slug]);

  // notFound() vale em Client Component: cai no mesmo not-found do servidor,
  // em vez de inventar uma tela de erro só para este caminho.
  if (missing) notFound();
  if (!loaded) return <JobDetailSkeleton />;

  return (
    <JobDetailView
      job={loaded.job}
      myApplication={loaded.myApplication}
      workerName={loaded.workerName}
      isWorker={loaded.isWorker}
    />
  );
}
