import { BookOpen, Code2, CreditCard, KeyRound, Search, Webhook, Workflow } from "lucide-react";
import type { ReactNode } from "react";

const endpoints = [
  ["POST", "/v1/documents", "Upload a document and queue analysis"],
  ["POST", "/v1/jobs/analyze", "Run document intelligence asynchronously"],
  ["POST", "/v1/jobs/ocr", "Extract OCR text and coordinates"],
  ["POST", "/v1/jobs/translate", "Translate document content"],
  ["GET", "/v1/results/{id}", "Fetch analysis, OCR, and generated outputs"],
  ["GET", "/v1/usage", "Inspect metered usage and quotas"]
];

const sdkSnippet = `import { IntelliDocClient } from "@intellidoc/sdk";

const client = new IntelliDocClient("https://api.example.com", process.env.INTELLIDOC_API_KEY);
const uploaded = await client.upload(file);
const job = await client.createAnalysisJob(uploaded.data.document.id);
const result = await client.waitForJob(job.data.job.id);`;

export default function DevelopersPage() {
  return (
    <main className="app-shell min-h-screen text-slate-950">
      <div className="ambient-grid" />
      <section className="relative z-10 mx-auto grid w-full max-w-6xl gap-5 px-4 py-6 md:px-6">
        <header className="glass-panel p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-black text-slate-700 ring-1 ring-white/70">
              <BookOpen size={14} className="text-indigo-600" />
              Developer Portal
            </span>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">API-first</span>
            <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-black text-cyan-800">OpenAPI 3.1</span>
          </div>
          <h1 className="mt-4 max-w-4xl text-4xl font-black leading-none tracking-normal md:text-5xl">Build document intelligence into any app.</h1>
          <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
            Upload documents, create async jobs, receive signed webhooks, track usage, and bill customers through a tenant-safe production API.
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          <section className="tool-panel p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white">
                <Code2 size={20} />
              </span>
              <h2 className="text-base font-black">Quick Start</h2>
            </div>
            <pre className="mt-4 overflow-auto rounded-2xl bg-slate-950 p-4 text-sm font-semibold leading-6 text-cyan-100">{sdkSnippet}</pre>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {endpoints.map(([method, path, detail]) => (
                <div key={path} className="flat-stack">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-black text-indigo-800">{method}</span>
                    <code className="truncate text-sm font-black">{path}</code>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-500">{detail}</p>
                </div>
              ))}
            </div>
          </section>

          <aside className="grid gap-5">
            <PortalCard icon={<KeyRound size={19} />} title="API Keys" body="Create scoped keys with tenant-level isolation, expiry, revocation, and usage attribution." />
            <PortalCard icon={<Workflow size={19} />} title="Async Jobs" body="Every heavy operation returns a job ID and completes through workers, polling, and webhooks." />
            <PortalCard icon={<Webhook size={19} />} title="Webhooks" body="Receive HMAC-signed events for job completion, failures, quota thresholds, and invoices." />
            <PortalCard icon={<CreditCard size={19} />} title="Billing" body="Usage records feed subscriptions, overages, invoices, and payment reconciliation." />
            <PortalCard icon={<Search size={19} />} title="Search" body="Combine full-text, metadata, semantic ranking, and document intelligence signals." />
          </aside>
        </div>
      </section>
    </main>
  );
}

function PortalCard({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <section className="tool-panel p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white">{icon}</span>
        <h3 className="font-black">{title}</h3>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{body}</p>
    </section>
  );
}
