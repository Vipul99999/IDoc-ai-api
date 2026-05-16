import { randomUUID } from "node:crypto";
import amqp from "amqplib";

const queues = [
  "document.uploaded",
  "document.preprocess",
  "document.quality",
  "document.ocr",
  "document.translate",
  "document.format",
  "document.embed",
  "billing.meter"
];

console.log("IntelliDoc worker booted", { workerId: randomUUID(), queues });

async function start() {
  if (!process.env.RABBITMQ_URL) {
    console.log("RABBITMQ_URL not set; background processing is disabled until RabbitMQ is configured.");
    return;
  }

  const connection = await amqp.connect(process.env.RABBITMQ_URL);
  const channel = await connection.createChannel();
  await channel.assertQueue("document-jobs", { durable: true });
  channel.prefetch(2);
  console.log("Worker consuming RabbitMQ queue document-jobs");

  channel.consume("document-jobs", async (message) => {
    if (!message) return;
    try {
      const job = JSON.parse(message.content.toString());
      console.log("Processing job", job);
      const baseUrl = process.env.WEB_INTERNAL_URL ?? "http://localhost:3000";
      const response = await fetch(`${baseUrl}/api/internal/jobs/process`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-worker-secret": process.env.INTERNAL_WORKER_SECRET ?? "local-worker-secret"
        },
        body: JSON.stringify({ documentId: job.documentId, jobId: job.id })
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Pipeline failed with ${response.status}: ${text}`);
      }
      channel.ack(message);
    } catch (error) {
      console.error("Job failed", error);
      const failedJob = (() => {
        try {
          return JSON.parse(message.content.toString());
        } catch {
          return { id: "unknown", type: "unknown", documentId: null };
        }
      })();
      const attempts = Number(failedJob.attempts ?? 0) + 1;
      const maxAttempts = Number(failedJob.maxAttempts ?? 3);
      if (attempts < maxAttempts) {
        channel.sendToQueue(
          "document-jobs",
          Buffer.from(
            JSON.stringify({
              ...failedJob,
              attempts,
              status: "queued",
              progress: Math.max(5, failedJob.progress ?? 5),
              message: `Retry ${attempts}/${maxAttempts} after transient processing failure.`,
              updatedAt: new Date().toISOString()
            })
          ),
          { persistent: true }
        );
      } else {
        await channel.assertQueue("document-jobs-dead", { durable: true });
        channel.sendToQueue(
          "document-jobs-dead",
          Buffer.from(JSON.stringify({ ...failedJob, attempts, status: "failed", error: error instanceof Error ? error.message : String(error) })),
          { persistent: true }
        );
      }
      channel.ack(message);
    }
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
