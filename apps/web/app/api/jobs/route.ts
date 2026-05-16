import { listDocuments } from "@/lib/storage/db";
import { listLocalJobs } from "@/lib/queue/jobs";
import { json } from "@/lib/http";

function jobStatusFromDocument(status: string) {
  if (status === "failed") return "failed";
  if (status === "analyzing" || status === "uploaded") return "running";
  return "succeeded";
}

export async function GET() {
  const documents = await listDocuments();
  const syntheticJobs = documents.flatMap((document) => [
      {
        id: `${document.id}-pipeline`,
        documentId: document.id,
        type: "full_pipeline",
        status: jobStatusFromDocument(document.status),
        attempts: 1,
        progress: document.status === "ready" || document.status === "translated" || document.status === "reformatted" ? 100 : document.status === "failed" ? 100 : 35,
        message:
          document.status === "failed"
            ? "Document processing failed."
            : document.status === "analyzing" || document.status === "uploaded"
              ? "Document is waiting for or running in the background worker."
              : "Document processing completed.",
        createdAt: document.createdAt,
        updatedAt: document.updatedAt
      }
    ]);
  return json({ jobs: [...listLocalJobs(), ...syntheticJobs] });
}
