import type { Application } from "@extra/shared/types/application";
import type { AttendanceRecord } from "@extra/shared/types/attendance";
import type { Company } from "@extra/shared/types/company";
import type { JobPost, JobPostContact } from "@extra/shared/types/job";
import type { Worker } from "@extra/shared/types/worker";
import {
  applications,
  attendanceRecords,
  companies,
  jobPostContacts,
  jobPosts,
  workers,
} from "./fixtures";

/**
 * Estado mutável da camada mock. As fixtures são o estado inicial; no
 * navegador ele é hidratado do localStorage na primeira leitura e persistido
 * a cada escrita, para vaga publicada continuar existindo depois do F5.
 *
 * `store` expõe cada coleção como getter/setter, então quem consome continua
 * escrevendo `store.jobPosts = [...]` como antes — a persistência acontece
 * dentro do setter, sem nenhum call-site de lib/api/ saber que ela existe.
 *
 * ponytail: um blob JSON por navegador, reescrito inteiro a cada escrita.
 * Some quando a API real chegar; até lá o volume é de uma demonstração.
 */

const STORAGE_KEY = "extra_demo_state";

interface MockState {
  companies: Company[];
  workers: Worker[];
  jobPosts: JobPost[];
  jobPostContacts: JobPostContact[];
  applications: Application[];
  attendanceRecords: AttendanceRecord[];
}

type CollectionName = keyof MockState;

const COLLECTIONS: CollectionName[] = [
  "companies",
  "workers",
  "jobPosts",
  "jobPostContacts",
  "applications",
  "attendanceRecords",
];

function fromFixtures(): MockState {
  return {
    companies: [...companies],
    workers: [...workers],
    jobPosts: [...jobPosts],
    jobPostContacts: [...jobPostContacts],
    applications: [...applications],
    attendanceRecords: [...attendanceRecords],
  };
}

const isBrowser = () => typeof window !== "undefined";

/**
 * Só aceita o que tem a forma de MockState. Estado gravado por uma versão
 * anterior das fixtures (uma coleção a menos, por exemplo) é descartado em
 * favor das fixtures novas — numa demonstração, dado meio-velho confunde
 * mais do que recomeçar.
 */
function parseStored(raw: string): MockState | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const candidate = parsed as Record<string, unknown>;
    const isComplete = COLLECTIONS.every((name) =>
      Array.isArray(candidate[name]),
    );
    return isComplete ? (candidate as unknown as MockState) : null;
  } catch {
    return null;
  }
}

// Fora do navegador (render no servidor, api.test.ts via tsx) o estado vive
// só na memória do módulo — é o comportamento que já existia antes.
let state: MockState | null = null;

function currentState(): MockState {
  if (state) return state;

  if (isBrowser()) {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    state = (raw && parseStored(raw)) || fromFixtures();
  } else {
    state = fromFixtures();
  }

  return state;
}

function persist(next: MockState): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Cota estourada ou modo privado: a demonstração segue em memória, sem
    // sobreviver ao F5. Melhor do que derrubar a tela no meio da reunião.
  }
}

function writeCollection<K extends CollectionName>(
  name: K,
  value: MockState[K],
): void {
  const next = { ...currentState(), [name]: value };
  state = next;
  persist(next);
}

export const store = {
  get companies() {
    return currentState().companies;
  },
  set companies(value: Company[]) {
    writeCollection("companies", value);
  },

  get workers() {
    return currentState().workers;
  },
  set workers(value: Worker[]) {
    writeCollection("workers", value);
  },

  get jobPosts() {
    return currentState().jobPosts;
  },
  set jobPosts(value: JobPost[]) {
    writeCollection("jobPosts", value);
  },

  get jobPostContacts() {
    return currentState().jobPostContacts;
  },
  set jobPostContacts(value: JobPostContact[]) {
    writeCollection("jobPostContacts", value);
  },

  get applications() {
    return currentState().applications;
  },
  set applications(value: Application[]) {
    writeCollection("applications", value);
  },

  get attendanceRecords() {
    return currentState().attendanceRecords;
  },
  set attendanceRecords(value: AttendanceRecord[]) {
    writeCollection("attendanceRecords", value);
  },
};

/** Descarta o que foi feito na demonstração e volta às fixtures (/demo/reset). */
export function resetStore(): void {
  if (isBrowser()) window.localStorage.removeItem(STORAGE_KEY);
  state = fromFixtures();
}
