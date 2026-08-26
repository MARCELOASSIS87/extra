import { ImageResponse } from "next/og";
import { JOB_ROLE_LABELS } from "@extra/shared/constants/job-roles";
import { getJobBySlug } from "@/lib/api/jobs";
import { cityName } from "@/lib/api/cities";
import {
  formatJobWeekdayAndDate,
  formatMoney,
  formatTimeRange,
} from "@/lib/format";

// Mesmas cores de icon.tsx/apple-icon.tsx, em literal: o Satori (motor do
// ImageResponse) não lê classe Tailwind nem var(--cor), só style inline.
const GREEN = "#027A48"; // --primary / verde-700
const BLACK = "#0A0C0B"; // --secondary, preto da marca
const FOREGROUND = "#111827";
const MUTED = "#4B5563";
const BORDER = "#E5E7EB";

export const alt = "Vaga de trabalho extra na Extraqui";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function Brand() {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 48,
          height: 48,
          borderRadius: 10,
          background: GREEN,
          color: "#FFFFFF",
          fontSize: 26,
          fontWeight: 700,
          marginRight: 12,
        }}
      >
        E
      </div>
      <div style={{ display: "flex", fontSize: 28, fontWeight: 700 }}>
        <span style={{ color: FOREGROUND }}>Extra</span>
        <span style={{ color: GREEN }}>qui</span>
      </div>
    </div>
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ cidade: string; slug: string }>;
}) {
  const { cidade, slug } = await params;
  const result = await getJobBySlug(cidade, slug);
  const job = result.ok ? result.data : null;

  // Vaga expirada ou link errado: cartão genérico da marca em vez de imagem
  // quebrada no preview de quem compartilhou.
  if (!job) {
    return new ImageResponse(
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FFFFFF",
        }}
      >
        <Brand />
      </div>,
      { ...size },
    );
  }

  const { weekday, shortDate } = formatJobWeekdayAndDate(job.startsAt);
  const vacancies = job.vacancies === 1 ? "1 vaga" : `${job.vacancies} vagas`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 64,
        background: "#FFFFFF",
      }}
    >
      <Brand />

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            background: BLACK,
            color: "#FFFFFF",
            fontSize: 24,
            fontWeight: 600,
            padding: "8px 20px",
            borderRadius: 999,
            marginBottom: 28,
          }}
        >
          {JOB_ROLE_LABELS[job.role]}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 56,
            fontWeight: 700,
            color: FOREGROUND,
            lineHeight: 1.15,
            marginBottom: 24,
          }}
        >
          {job.title}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 28,
            color: MUTED,
            marginBottom: 8,
          }}
        >
          {`${weekday}, ${shortDate} · ${formatTimeRange(job.startsAt, job.endsAt)}`}
        </div>
        <div style={{ display: "flex", fontSize: 28, color: MUTED }}>
          {`${cityName(job.cityId)} · ${vacancies}`}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          borderTop: `2px solid ${BORDER}`,
          paddingTop: 32,
        }}
      >
        <div style={{ display: "flex", fontSize: 24, color: MUTED }}>
          valor informado pela empresa
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 700,
            color: GREEN,
          }}
        >
          {formatMoney(job.payAmount)}
        </div>
      </div>
    </div>,
    { ...size },
  );
}
