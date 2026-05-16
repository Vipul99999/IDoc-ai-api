import { findV1Job, readV1Jobs, requireV1Auth, recordUsage, v1Error, v1Response } from "@/lib/v1";
import { listLocalJobs } from "@/lib/queue/jobs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { principal, response } = await requireV1Auth(request, ["jobs:read"]);
  if (!principal) return response;
  const { id } = await context.params;
  const v1Job = await findV1Job(id);
  const localJob = listLocalJobs().find((job) => job.id === id);
  const job = v1Job
    ? { ...v1Job, ...(localJob ? { status: localJob.status, progress: localJob.progress, message: localJob.message } : {}) }
    : localJob;
  if (!job) return v1Error(request, principal.tenantId, 404, "job_not_found", "Job not found.");
  await recordUsage(principal, "api_call", 1, { endpoint: "/v1/jobs/{id}", method: "GET" }, id);
  return v1Response(request, principal.tenantId, { job });
}

export async function HEAD(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const exists = Boolean((await findV1Job(id)) ?? (await readV1Jobs()).find((job) => job.id === id));
  return new Response(null, { status: exists ? 204 : 404 });
}
