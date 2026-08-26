import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JOB_ROLE_LABELS } from "@extra/shared/constants/job-roles";
import { getJobBySlug } from "@/lib/api/jobs";
import { cityName } from "@/lib/api/cities";
import { listMyApplications } from "@/lib/api/applications";
import { getSessionRole } from "@/lib/api/session";
import { isMockMode } from "@/lib/api/mock";
import { JobDetailClient } from "@/components/jobs/job-detail-client";
import { JobDetailView } from "@/components/jobs/job-detail-view";
import {
  formatJobWeekdayAndDate,
  formatMoney,
  formatTimeRange,
} from "@/lib/format";
import { SITE_URL } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/vagas/[cidade]/[slug]">): Promise<Metadata> {
  const { cidade, slug } = await params;
  const result = await getJobBySlug(cidade, slug);
  if (!result.ok || !result.data) return {};
  const job = result.data;

  const { weekday, shortDate } = formatJobWeekdayAndDate(job.startsAt);
  const vacancies = job.vacancies === 1 ? "1 vaga" : `${job.vacancies} vagas`;
  const description = `${JOB_ROLE_LABELS[job.role]} em ${cityName(job.cityId)} — ${weekday} ${shortDate}, ${formatTimeRange(job.startsAt, job.endsAt)} — ${formatMoney(job.payAmount)}. ${vacancies}.`;
  const url = `${SITE_URL}/vagas/${job.citySlug}/${job.slug}`;

  return {
    title: job.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: job.title,
      description,
      url,
      type: "website",
    },
  };
}

export default async function JobDetailPage({
  params,
}: PageProps<"/vagas/[cidade]/[slug]">) {
  const { cidade, slug } = await params;

  // Em modo mock o estado mutável está no localStorage — ver app/page.tsx.
  // Também é quem decide o notFound(): daqui o servidor não enxerga uma vaga
  // publicada na demonstração e a daria como inexistente.
  if (isMockMode) return <JobDetailClient citySlug={cidade} slug={slug} />;

  const result = await getJobBySlug(cidade, slug);
  if (!result.ok || !result.data) notFound();
  const job = result.data;

  // Em paralelo: a candidatura da pessoa e o papel da sessão não dependem um
  // do outro.
  const [applicationsResult, role] = await Promise.all([
    listMyApplications(),
    getSessionRole(),
  ]);

  const myApplication = applicationsResult.ok
    ? (applicationsResult.data.find(
        (item) => item.jobPostId === job.id && item.status !== "withdrawn",
      ) ?? null)
    : null;

  return (
    <JobDetailView
      job={job}
      myApplication={myApplication}
      isWorker={role === "worker"}
    />
  );
}
