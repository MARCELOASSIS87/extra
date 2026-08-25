"use client";

import { useEffect, useState } from "react";
import { listMyApplicationsWithJob } from "@/lib/api/applications";
import { listJobsForMe } from "@/lib/api/jobs";
import { getMyWorkerProfile } from "@/lib/api/workers";
import {
  WorkerHomeView,
  type WorkerHomeData,
} from "@/components/home/worker-home-view";

/** Mesmas funções de lib/api/ do caminho do servidor, chamadas do navegador. */
export function WorkerHomeClient() {
  const [state, setState] = useState<{
    data: WorkerHomeData;
    now: string;
  } | null>(null);

  useEffect(() => {
    let active = true;

    // Em paralelo: as três seções não dependem uma da outra.
    Promise.all([
      getMyWorkerProfile(),
      listMyApplicationsWithJob(),
      listJobsForMe(),
    ]).then(([worker, applications, jobs]) => {
      // "Agora" calculado aqui, junto com o dado: no render ele viraria na
      // hidratação de uma sessão aberta pela meia-noite.
      if (active) {
        setState({
          data: { worker, applications, jobs },
          now: new Date().toISOString(),
        });
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return <WorkerHomeView data={state?.data ?? null} now={state?.now ?? ""} />;
}
