import assert from "node:assert/strict";
import {
  AUTO_NOT_SELECTED_DAYS,
  effectiveAttendanceStatus,
} from "./attendance";

/**
 * Os quatro casos do §16.7 e da regra 10. A função é a ÚNICA dona do número 7
 * ligado a esta regra, então é aqui que ele se prova — o mock e a API só a
 * chamam.
 */
const DAY = 24 * 60 * 60 * 1000;
const NOW = "2026-09-01T12:00:00.000Z";
const endedDaysAgo = (days: number): string =>
  new Date(Date.parse(NOW) - days * DAY).toISOString();

const pending = { status: "pending" as const, markedAt: null };

// 6 dias: a empresa ainda tem prazo, e a pendência continua pendência.
assert.equal(
  effectiveAttendanceStatus(pending, endedDaysAgo(6), NOW),
  "pending",
);

// 8 dias: o silêncio virou desfecho, e o desfecho é o NEUTRO.
assert.equal(
  effectiveAttendanceStatus(pending, endedDaysAgo(8), NOW),
  "not_selected",
);

// A borda exata, para o prazo não escorregar um dia em nenhum sentido.
assert.equal(
  effectiveAttendanceStatus(pending, endedDaysAgo(AUTO_NOT_SELECTED_DAYS), NOW),
  "pending",
  "no sétimo dia ainda dá para marcar",
);

// Marcação de verdade nunca é reescrita pela derivação, por mais velha.
for (const status of ["present", "absent", "not_selected"] as const) {
  assert.equal(
    effectiveAttendanceStatus(
      { status, markedAt: endedDaysAgo(300) },
      endedDaysAgo(300),
      NOW,
    ),
    status,
    `${status} marcado continua ${status}`,
  );
}

console.log("attendance.test.ts: all checks passed");
