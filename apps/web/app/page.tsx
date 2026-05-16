"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Archive,
  BadgeCheck,
  BarChart3,
  BookOpen,
  Brain,
  Brush,
  Building2,
  CheckCircle2,
  Chrome,
  CircleDollarSign,
  CloudUpload,
  CreditCard,
  Eraser,
  FileSearch,
  Files,
  FileText,
  GitCompare,
  Languages,
  Link,
  Loader2,
  LockKeyhole,
  LogIn,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Target,
  Truck,
  Upload,
  Wand2,
  Zap
} from "lucide-react";
import type { DocumentRecord, SearchHit } from "@/lib/types";

type Stats = {
  documents: number;
  totalPages: number;
  averageQuality: number;
  searchableDocuments: number;
  translatedDocuments: number;
  reformattedDocuments: number;
  byType: Record<string, number>;
};

type Usage = {
  account: { plan: string; apiBillingEnabled: boolean; ssoReady: boolean; retentionDays: number };
  usage: { documents: number; ocrCredits: number; translationCredits: number; storageBytes: number };
};

type BrandSettings = {
  name: string;
  tagline: string;
  logoText: string;
  primaryColor: string;
  accentColor: string;
  marketplaceName: string;
  supportEmail: string;
};

type WorkflowSummary = {
  documentId: string;
  status: string;
  steps: Array<{ id: string; label: string; status: string; owner: string }>;
};

type DuplicateHit = {
  id: string;
  filename: string;
  checksumMatch: boolean;
  similarity: number;
  likelyDuplicate: boolean;
};

type PrintVendor = {
  id: string;
  name: string;
  strengths: string[];
  estimatedPrice: number;
  etaHours: number;
  recommended: boolean;
};

type PrintQuote = {
  id: string;
  vendorName: string;
  paper: string;
  binding: string;
  colorMode: string;
  total: number;
  etaHours: number;
};

type ReviewTaskSummary = {
  id: string;
  documentId: string;
  title: string;
  priority: string;
  owner: string;
  status: string;
};

type AdminAnalytics = {
  documents: number;
  pages: number;
  averageQuality: number;
  averageReadiness: number;
  highRiskDocuments: number;
  extractionAutomationReady: number;
  openReviewTasks: number;
  revenuePotential: number;
};

type CostOptimization = {
  profile: string;
  possibleSavings: number;
  infrastructure: {
    currentRecommendation: string;
    monthlyEstimateInr: number;
    deferUntilNeeded: string[];
  };
  documentOptimizations: Array<{
    id: string;
    filename: string;
    optimizations: Array<{ title: string; saving: number; impact: string; tradeoff: string }>;
  }>;
};

type SearchFacets = {
  documentTypes: Record<string, number>;
  categories: Record<string, number>;
};

type SearchSuggestion = {
  suggestion: string;
  count: number;
};

type SecurityAudit = {
  score: number;
  posture: string;
  findings: Array<{ id: string; severity: string; title: string; status: string; evidence: string; remediation: string }>;
};

const phases = ["Upload", "Quality", "Classify", "OCR", "Search", "Translate", "Format", "Govern"];
const tabs = ["Overview", "AI Tools", "Search", "Commerce", "Ops"] as const;
const languages = [
  ["hi", "Hindi"],
  ["en", "English"],
  ["bn", "Bengali"],
  ["ta", "Tamil"],
  ["te", "Telugu"],
  ["ur", "Urdu"]
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function scoreTone(score?: number) {
  if (!score) return "from-slate-400 to-slate-500";
  if (score >= 85) return "from-emerald-400 to-teal-500";
  if (score >= 70) return "from-amber-300 to-orange-500";
  return "from-rose-400 to-red-500";
}

function readableStatus(status: string) {
  return status.replace(/[_-]/g, " ");
}

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("owner@intellidoc.local");
  const [password, setPassword] = useState("password");
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [brand, setBrand] = useState<BrandSettings | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [reviewTasks, setReviewTasks] = useState<ReviewTaskSummary[]>([]);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [costOptimization, setCostOptimization] = useState<CostOptimization | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searchFacets, setSearchFacets] = useState<SearchFacets | null>(null);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [searchTypeFilter, setSearchTypeFilter] = useState("");
  const [searchCategoryFilter, setSearchCategoryFilter] = useState("");
  const [minQualityFilter, setMinQualityFilter] = useState("");
  const [question, setQuestion] = useState("What are the key points?");
  const [duplicates, setDuplicates] = useState<DuplicateHit[]>([]);
  const [vendors, setVendors] = useState<PrintVendor[]>([]);
  const [quote, setQuote] = useState<PrintQuote | null>(null);
  const [compareTargetId, setCompareTargetId] = useState("");
  const [comparison, setComparison] = useState<string | null>(null);
  const [securityAudit, setSecurityAudit] = useState<SecurityAudit | null>(null);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Overview");
  const [isUploading, setIsUploading] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => documents.find((document) => document.id === selectedId) ?? documents[0] ?? null, [documents, selectedId]);
  const selectedWorkflow = useMemo(() => workflows.find((workflow) => workflow.documentId === selected?.id) ?? null, [workflows, selected?.id]);
  const selectedOptimizations = useMemo(
    () => costOptimization?.documentOptimizations.find((item) => item.id === selected?.id)?.optimizations ?? [],
    [costOptimization?.documentOptimizations, selected?.id]
  );

  const apiFetch = useCallback(
    (path: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return fetch(path, { ...init, headers });
    },
    [token]
  );

  async function signIn(event?: React.FormEvent) {
    event?.preventDefault();
    setError(null);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "Sign in failed");
      return;
    }
    localStorage.setItem("intellidoc.token", payload.token);
    setToken(payload.token);
  }

  const refresh = useCallback(async () => {
    if (!token) return;
    const [documentsResponse, statsResponse, usageResponse, brandResponse, workflowResponse, tasksResponse, analyticsResponse, costResponse] =
      await Promise.all([
        apiFetch("/api/documents"),
        apiFetch("/api/admin/stats"),
        apiFetch("/api/enterprise/usage"),
        apiFetch("/api/brand"),
        apiFetch("/api/workflows"),
        apiFetch("/api/review/tasks"),
        apiFetch("/api/admin/analytics"),
        apiFetch("/api/cost/optimize")
      ]);

    const documentsPayload = await documentsResponse.json();
    const statsPayload = await statsResponse.json();
    const usagePayload = await usageResponse.json();
    const brandPayload = await brandResponse.json();
    const workflowPayload = await workflowResponse.json();
    const tasksPayload = await tasksResponse.json();
    const analyticsPayload = await analyticsResponse.json();
    const costPayload = await costResponse.json();

    setDocuments(documentsPayload.documents ?? []);
    setStats(statsPayload.stats ?? null);
    setUsage(usagePayload ?? null);
    setBrand(brandPayload.brand ?? null);
    setWorkflows(workflowPayload.workflows ?? []);
    setReviewTasks(tasksPayload.tasks ?? []);
    setAnalytics(analyticsPayload.analytics ?? null);
    setCostOptimization(costPayload ?? null);
    if (!selectedId && documentsPayload.documents?.[0]) setSelectedId(documentsPayload.documents[0].id);
  }, [apiFetch, selectedId, token]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthToken = params.get("token");
    const authError = params.get("authError");
    if (oauthToken) {
      localStorage.setItem("intellidoc.token", oauthToken);
      setToken(oauthToken);
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }
    if (authError) {
      setError(authError);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    const stored = localStorage.getItem("intellidoc.token");
    if (stored) setToken(stored);
    else signIn().catch(() => setError("Sign in to load the workspace."));
  }, []);

  useEffect(() => {
    refresh().catch(() => setError("Could not load the document workspace."));
  }, [refresh]);

  async function uploadFile(formData: FormData) {
    setError(null);
    setIsUploading(true);
    try {
      const response = await apiFetch("/api/documents/batch-upload", { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Upload failed");
      setSelectedId(payload.documents?.[0]?.id ?? payload.document?.id ?? null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  async function runAction(path: string, init?: RequestInit) {
    if (!selected) return;
    setIsWorking(true);
    setError(null);
    try {
      const response = await apiFetch(path, { method: "POST", ...init });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Action failed");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setIsWorking(false);
    }
  }

  async function runSearch() {
    const response = await apiFetch("/api/search/advanced", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: searchQuery,
        documentType: searchTypeFilter || undefined,
        category: searchCategoryFilter || undefined,
        minQuality: minQualityFilter ? Number(minQualityFilter) : undefined
      })
    });
    const payload = await response.json();
    setHits(payload.hits ?? []);
    setSearchFacets(payload.facets ?? null);
  }

  async function loadSuggestions(value: string) {
    setSearchQuery(value);
    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const response = await apiFetch(`/api/search/suggest?q=${encodeURIComponent(value)}`);
    const payload = await response.json();
    setSuggestions(payload.suggestions ?? []);
  }

  async function loadDuplicates() {
    if (!selected) return;
    const response = await apiFetch(`/api/documents/${selected.id}/duplicates`);
    const payload = await response.json();
    setDuplicates(payload.duplicates ?? []);
  }

  async function loadVendors() {
    const response = await apiFetch("/api/marketplace/print-options");
    const payload = await response.json();
    setVendors(payload.vendors ?? []);
  }

  async function compareDocuments() {
    if (!selected || !compareTargetId) return;
    const response = await apiFetch(`/api/documents/${selected.id}/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetDocumentId: compareTargetId })
    });
    const payload = await response.json();
    if (payload.comparison) setComparison(`${payload.comparison.semanticSimilarity}% similar. ${payload.comparison.recommendation}`);
  }

  async function saveBrand(formData: FormData) {
    const response = await apiFetch("/api/brand", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        logoText: formData.get("logoText"),
        tagline: formData.get("tagline"),
        supportEmail: formData.get("supportEmail"),
        marketplaceName: formData.get("marketplaceName")
      })
    });
    const payload = await response.json();
    if (payload.brand) setBrand(payload.brand);
  }

  async function createQuote(vendorId = "campus-fastprint") {
    if (!selected) return;
    const response = await apiFetch("/api/marketplace/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: selected.id, vendorId, copies: 1 })
    });
    const payload = await response.json();
    setQuote(payload.quote ?? null);
  }

  async function createCheckout() {
    const response = await apiFetch("/api/payments/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountCents: 79900,
        currency: "inr",
        description: "IntelliDoc Pro credits",
        metadata: { product: "pro-credit-pack" }
      })
    });
    const payload = await response.json();
    if (payload.session?.url) window.open(payload.session.url, "_blank", "noopener,noreferrer");
  }

  async function placeOrder(vendorId = "campus-fastprint") {
    if (!selected) return;
    setIsWorking(true);
    await apiFetch("/api/marketplace/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: selected.id, vendorId, copies: 1, deliveryMode: "pickup" })
    });
    setIsWorking(false);
  }

  async function refreshExtractionAndValidation() {
    if (!selected) return;
    setIsWorking(true);
    await apiFetch(`/api/documents/${selected.id}/extract`, { method: "POST" });
    await apiFetch(`/api/documents/${selected.id}/validate`, { method: "POST" });
    await refresh();
    setIsWorking(false);
  }

  async function loadSecurityAudit() {
    const response = await apiFetch("/api/security/audit");
    const payload = await response.json();
    setSecurityAudit(payload.audit ?? null);
  }

  return (
    <main className="app-shell min-h-screen overflow-hidden text-slate-950">
      <div className="ambient-grid" />
      <div className="relative z-10 mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-4 py-4 sm:px-6 lg:grid lg:grid-cols-[280px_1fr] lg:py-6">
        <aside className="glass-panel sticky top-4 h-fit p-4 lg:min-h-[calc(100vh-3rem)]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white shadow-glow">
              {brand?.logoText ?? "ID"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-black tracking-normal">{brand?.name ?? "IntelliDoc AI"}</p>
              <p className="truncate text-xs font-semibold text-slate-500">{brand?.tagline ?? "Document intelligence OS"}</p>
            </div>
          </div>

          <form onSubmit={signIn} className="mt-5 rounded-2xl border border-white/65 bg-white/60 p-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-black">
              <LockKeyhole size={16} className="text-indigo-600" />
              Workspace Access
            </div>
            <input value={email} onChange={(event) => setEmail(event.target.value)} className="field mb-2 h-10" placeholder="Email" />
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" className="field h-10" placeholder="Password" />
            <button className="primary-button mt-3 h-10 w-full">
              {token ? <CheckCircle2 size={16} /> : <LogIn size={16} />}
              {token ? "Signed In" : "Sign In"}
            </button>
            <a href="/api/auth/google/start" className="secondary-button mt-2 h-10 w-full justify-center">
              <Chrome size={16} />
              Continue with Google
            </a>
          </form>

          <nav className="mt-5 grid gap-2">
            {tabs.map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`nav-pill ${activeTab === tab ? "nav-pill-active" : ""}`}>
                {tab === "Overview" ? <Activity size={17} /> : null}
                {tab === "AI Tools" ? <Brain size={17} /> : null}
                {tab === "Search" ? <Search size={17} /> : null}
                {tab === "Commerce" ? <Store size={17} /> : null}
                {tab === "Ops" ? <ShieldCheck size={17} /> : null}
                {tab}
              </button>
            ))}
          </nav>

          <div className="mt-5 grid gap-3">
            <MiniStat label="Documents" value={stats?.documents ?? 0} />
            <MiniStat label="Quality" value={`${stats?.averageQuality ?? 0}/100`} />
            <MiniStat label="Savings" value={`Rs ${costOptimization?.possibleSavings ?? 0}`} />
          </div>
        </aside>

        <section className="space-y-5">
          <header className="hero-shell glass-panel overflow-hidden p-5 md:p-6">
            <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_330px] xl:items-stretch">
              <div className="max-w-4xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-black text-slate-700 ring-1 ring-white/70">
                    <Sparkles size={14} className="text-fuchsia-600" />
                    Production document command center
                  </span>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">RBAC secured</span>
                  <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-black text-cyan-800">Queue ready</span>
                </div>
                <h1 className="mt-4 max-w-5xl text-4xl font-black leading-[0.97] tracking-normal text-slate-950 md:text-5xl 2xl:text-6xl">
                  Analyze, search, translate, format, and sell document services from one beautiful workspace.
                </h1>
                <div className="mt-5 grid max-w-2xl gap-2 sm:grid-cols-3">
                  <div className="hero-chip">OCR ready</div>
                  <div className="hero-chip">Semantic search</div>
                  <div className="hero-chip">Print commerce</div>
                </div>
              </div>
              <div className="hero-console">
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => refresh()} className="secondary-button h-11">
                    <RefreshCcw size={17} />
                    Refresh
                  </button>
                  <button onClick={createCheckout} className="primary-button h-11">
                    <CreditCard size={17} />
                    Buy Credits
                  </button>
                </div>
                <div className="signal-stack">
                  <div className="signal-line signal-line-a" />
                  <div className="signal-line signal-line-b" />
                  <div className="signal-line signal-line-c" />
                </div>
                <div className="hero-console-footer">
                  <span>Live intelligence fabric</span>
                  <span>{documents.length} docs</span>
                </div>
              </div>
            </div>
          </header>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm font-semibold text-rose-800 shadow-soft">{error}</div>
          ) : null}

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
            <div className="space-y-5">
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Metric icon={<Archive size={20} />} label="Docs" value={stats?.documents ?? 0} tone="violet" />
                <Metric icon={<BookOpen size={20} />} label="Pages" value={stats?.totalPages ?? 0} tone="cyan" />
                <Metric icon={<BadgeCheck size={20} />} label="Quality" value={`${stats?.averageQuality ?? 0}/100`} tone="emerald" />
                <Metric icon={<Target size={20} />} label="Ready" value={`${analytics?.averageReadiness ?? 0}/100`} tone="amber" />
              </section>

              <section className="tool-panel p-4 md:p-5">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <SectionTitle icon={<CloudUpload size={20} />} title="Upload Pipeline" />
                  <div className="flex items-center gap-2 text-xs font-black text-slate-500">
                    <Zap size={15} className="text-amber-500" />
                    Background jobs only
                  </div>
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    uploadFile(new FormData(event.currentTarget));
                  }}
                  className="grid gap-4 lg:grid-cols-[1fr_280px]"
                >
                  <label className="upload-zone group">
                    <input
                      name="file"
                      type="file"
                      multiple
                      required
                      accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.webp,.bmp,.gif,.heic,.heif,.doc,.docx,.odt,.rtf,.txt,.md,.csv,.tsv,.xls,.xlsx,.ppt,.pptx,.html,.xml,.json"
                      className="sr-only"
                    />
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-glow">
                      <Upload size={24} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-lg font-black">Drop or select documents</span>
                      <span className="mt-1 block text-sm font-semibold text-slate-500">PDF, scans, photos, Office files, sheets, decks, data, and text</span>
                    </span>
                  </label>
                  <div className="grid gap-3">
                    <select name="budget" className="field h-12">
                      <option value="standard">Standard budget</option>
                      <option value="economy">Economy budget</option>
                      <option value="premium">Premium budget</option>
                    </select>
                    <select name="urgency" className="field h-12">
                      <option value="normal">Normal delivery</option>
                      <option value="express">Express delivery</option>
                    </select>
                    <button disabled={isUploading} className="primary-button h-12 disabled:opacity-60">
                      {isUploading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                      Queue Files
                    </button>
                  </div>
                </form>
              </section>

              {selected ? (
                <>
                  <DocumentFocus
                    selected={selected}
                    selectedWorkflow={selectedWorkflow}
                    isWorking={isWorking}
                    onAnalyze={() => runAction(`/api/documents/${selected.id}/analyze`)}
                    onOcr={() => runAction(`/api/documents/${selected.id}/ocr`)}
                    onExtract={refreshExtractionAndValidation}
                  />

                  {activeTab === "Overview" ? (
                    <OverviewTab selected={selected} phases={phases} reviewTasks={reviewTasks} />
                  ) : null}

                  {activeTab === "AI Tools" ? (
                    <AiToolsTab
                      selected={selected}
                      question={question}
                      setQuestion={setQuestion}
                      isWorking={isWorking}
                      runAction={runAction}
                    />
                  ) : null}

                  {activeTab === "Search" ? (
                    <SearchTab
                      searchQuery={searchQuery}
                      loadSuggestions={loadSuggestions}
                      runSearch={runSearch}
                      suggestions={suggestions}
                      setSearchQuery={setSearchQuery}
                      setSuggestions={setSuggestions}
                      hits={hits}
                      setSelectedId={setSelectedId}
                      searchTypeFilter={searchTypeFilter}
                      setSearchTypeFilter={setSearchTypeFilter}
                      searchCategoryFilter={searchCategoryFilter}
                      setSearchCategoryFilter={setSearchCategoryFilter}
                      minQualityFilter={minQualityFilter}
                      setMinQualityFilter={setMinQualityFilter}
                      searchFacets={searchFacets}
                    />
                  ) : null}

                  {activeTab === "Commerce" ? (
                    <CommerceTab
                      selected={selected}
                      vendors={vendors}
                      quote={quote}
                      loadVendors={loadVendors}
                      createQuote={createQuote}
                      placeOrder={placeOrder}
                      createCheckout={createCheckout}
                      selectedOptimizations={selectedOptimizations}
                      costOptimization={costOptimization}
                      isWorking={isWorking}
                    />
                  ) : null}

                  {activeTab === "Ops" ? (
                    <OpsTab
                      selected={selected}
                      documents={documents}
                      duplicates={duplicates}
                      comparison={comparison}
                      compareTargetId={compareTargetId}
                      setCompareTargetId={setCompareTargetId}
                      setSelectedId={setSelectedId}
                      loadDuplicates={loadDuplicates}
                      compareDocuments={compareDocuments}
                      securityAudit={securityAudit}
                      loadSecurityAudit={loadSecurityAudit}
                      saveBrand={saveBrand}
                      brand={brand}
                      isWorking={isWorking}
                      runAction={runAction}
                    />
                  ) : null}
                </>
              ) : (
                <section className="tool-panel p-10 text-center">
                  <FileText className="mx-auto text-indigo-600" size={44} />
                  <h2 className="mt-4 text-2xl font-black">Your workspace is ready.</h2>
                  <p className="mx-auto mt-2 max-w-lg text-sm font-semibold text-slate-500">Upload a file to start the intelligence pipeline.</p>
                </section>
              )}
            </div>

            <aside className="space-y-5">
              <DocumentList documents={documents} selectedId={selected?.id ?? null} setSelectedId={setSelectedId} />
              <section className="tool-panel p-4">
                <SectionTitle icon={<Building2 size={20} />} title="Enterprise Pulse" />
                <div className="mt-4 grid gap-3">
                  <Fact label="Plan" value={usage?.account.plan ?? "developer-sandbox"} />
                  <Fact label="Retention" value={`${usage?.account.retentionDays ?? 30} days`} />
                  <Fact label="Storage" value={formatBytes(usage?.usage.storageBytes ?? 0)} />
                  <Fact label="Revenue Potential" value={`Rs ${analytics?.revenuePotential ?? 0}`} />
                </div>
              </section>
            </aside>
          </section>
        </section>
      </div>
    </main>
  );
}

function DocumentList({
  documents,
  selectedId,
  setSelectedId
}: {
  documents: DocumentRecord[];
  selectedId: string | null;
  setSelectedId: (id: string) => void;
}) {
  return (
    <section className="tool-panel p-4">
      <div className="mb-4 flex items-center justify-between">
        <SectionTitle icon={<Files size={20} />} title="Document Queue" />
        <span className="rounded-full bg-slate-950 px-2.5 py-1 text-xs font-black text-white">{documents.length}</span>
      </div>
      <div className="grid max-h-[540px] gap-2 overflow-y-auto pr-1">
        {documents.length === 0 ? (
          <p className="rounded-2xl bg-white/55 p-4 text-sm font-semibold text-slate-500">No documents yet.</p>
        ) : (
          documents.map((document) => (
            <button
              key={document.id}
              onClick={() => setSelectedId(document.id)}
              className={`queue-row ${selectedId === document.id ? "queue-row-active" : ""}`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 text-white">
                <FileText size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black">{document.originalName}</span>
                <span className="mt-1 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                  <span>{document.analysis?.documentType ?? document.status}</span>
                  <span>{formatBytes(document.size)}</span>
                </span>
              </span>
              <span className={`rounded-full bg-gradient-to-r px-2 py-1 text-xs font-black text-white ${scoreTone(document.analysis?.qualityScore)}`}>
                {document.analysis?.qualityScore ?? "--"}
              </span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

function DocumentFocus({
  selected,
  selectedWorkflow,
  isWorking,
  onAnalyze,
  onOcr,
  onExtract
}: {
  selected: DocumentRecord;
  selectedWorkflow: WorkflowSummary | null;
  isWorking: boolean;
  onAnalyze: () => void;
  onOcr: () => void;
  onExtract: () => void;
}) {
  const quality = selected.analysis?.qualityScore ?? 0;
  return (
    <section className="tool-panel overflow-hidden p-0">
      <div className="grid gap-0 lg:grid-cols-[1fr_260px]">
        <div className="p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-indigo-600">Selected Document</p>
              <h2 className="mt-2 truncate text-3xl font-black tracking-normal">{selected.originalName}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge>{selected.analysis?.documentType ?? "Queued"}</Badge>
                <Badge>{selected.metadata.detectedCategory}</Badge>
                <Badge>{selected.pageCount} pages</Badge>
                <Badge>{readableStatus(selected.status)}</Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button disabled={isWorking} onClick={onAnalyze} className="secondary-button h-10">
                <Wand2 size={16} />
                Analyze
              </button>
              <button disabled={isWorking} onClick={onOcr} className="secondary-button h-10">
                <FileSearch size={16} />
                OCR
              </button>
              <button disabled={isWorking} onClick={onExtract} className="primary-button h-10">
                {isWorking ? <Loader2 className="animate-spin" size={16} /> : <BadgeCheck size={16} />}
                Validate
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <Fact label="Language" value={selected.analysis?.language ?? "pending"} />
            <Fact label="OCR Blocks" value={selected.ocr?.blocks.length ?? 0} />
            <Fact label="Compliance Risk" value={selected.compliance?.riskScore ?? 0} />
            <Fact label="Readiness" value={`${selected.validation?.readinessScore ?? 0}/100`} />
          </div>
          {selectedWorkflow ? (
            <div className="mt-5 grid gap-2 md:grid-cols-5">
              {selectedWorkflow.steps.slice(0, 5).map((step) => (
                <div key={step.id} className="timeline-step">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="truncate text-xs font-black">{step.label}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="relative flex min-h-56 items-center justify-center bg-slate-950 p-5 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,.35),transparent_35%),radial-gradient(circle_at_80%_30%,rgba(217,70,239,.35),transparent_32%),radial-gradient(circle_at_50%_90%,rgba(250,204,21,.28),transparent_35%)]" />
          <div className="relative text-center">
            <div className={`mx-auto flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br ${scoreTone(quality)} p-1 shadow-glow`}>
              <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-950 text-4xl font-black">{quality || "--"}</div>
            </div>
            <p className="mt-3 text-sm font-black text-white/80">Quality Score</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function OverviewTab({ selected, phases, reviewTasks }: { selected: DocumentRecord; phases: string[]; reviewTasks: ReviewTaskSummary[] }) {
  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Panel icon={<Activity size={20} />} title="Pipeline Map">
        <div className="grid gap-3 md:grid-cols-4">
          {phases.map((phase, index) => (
            <div key={phase} className="phase-tile">
              <span className="text-xs font-black text-slate-400">0{index + 1}</span>
              <span className="mt-2 block font-black">{phase}</span>
            </div>
          ))}
        </div>
      </Panel>
      <Panel icon={<ShieldCheck size={20} />} title="Review Load">
        <div className="grid gap-2">
          {reviewTasks.slice(0, 4).map((task) => (
            <div key={task.id} className="flat-row">
              <span className="truncate font-black">{task.title}</span>
              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-black text-amber-800">{task.priority}</span>
            </div>
          ))}
          {reviewTasks.length === 0 ? <p className="text-sm font-semibold text-slate-500">No open review tasks.</p> : null}
        </div>
      </Panel>
      <Panel icon={<FileText size={20} />} title="Extracted Summary">
        <p className="text-sm font-semibold leading-6 text-slate-600">{selected.analysis?.summary ?? "Analysis pending."}</p>
      </Panel>
      <Panel icon={<BadgeCheck size={20} />} title="Recommendations">
        <div className="grid gap-2 md:grid-cols-2">
          {(selected.analysis?.recommendations ?? []).slice(0, 6).map((recommendation) => (
            <div key={recommendation.title} className="flat-stack">
              <div className="flex items-center justify-between gap-3">
                <p className="font-black">{recommendation.title}</p>
                <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-black text-indigo-800">{recommendation.priority}</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-500">{recommendation.reason}</p>
            </div>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function AiToolsTab({
  selected,
  question,
  setQuestion,
  isWorking,
  runAction
}: {
  selected: DocumentRecord;
  question: string;
  setQuestion: (value: string) => void;
  isWorking: boolean;
  runAction: (path: string, init?: RequestInit) => void;
}) {
  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Panel icon={<Brain size={20} />} title="Generative Studio">
        <div className="grid gap-3 md:grid-cols-3">
          <button disabled={isWorking} onClick={() => runAction(`/api/documents/${selected.id}/summarize`)} className="action-tile">
            <Brain size={20} />
            Summary
          </button>
          <button disabled={isWorking} onClick={() => runAction(`/api/documents/${selected.id}/flashcards`)} className="action-tile">
            <BookOpen size={20} />
            Flashcards
          </button>
          <button disabled={isWorking} onClick={() => runAction(`/api/documents/${selected.id}/study-guide`)} className="action-tile">
            <Sparkles size={20} />
            Study Guide
          </button>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]">
          <input value={question} onChange={(event) => setQuestion(event.target.value)} className="field h-12" />
          <button
            disabled={isWorking}
            onClick={() =>
              runAction(`/api/documents/${selected.id}/ask`, {
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question })
              })
            }
            className="primary-button h-12"
          >
            Ask
          </button>
        </div>
      </Panel>
      <Panel icon={<Languages size={20} />} title="Translation">
        <div className="grid gap-2">
          {languages.map(([code, label]) => (
            <button
              key={code}
              disabled={isWorking}
              onClick={() =>
                runAction(`/api/documents/${selected.id}/translate`, {
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ targetLanguage: code })
                })
              }
              className="language-row"
            >
              <span>{label}</span>
              <Languages size={16} />
            </button>
          ))}
        </div>
      </Panel>
      <Panel icon={<Brush size={20} />} title="Formatting">
        <div className="grid gap-3 md:grid-cols-3">
          {["pdf", "docx", "pptx"].map((format) => (
            <button
              key={format}
              disabled={isWorking}
              onClick={() =>
                runAction(`/api/documents/${selected.id}/reformat`, {
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ format })
                })
              }
              className="action-tile uppercase"
            >
              <Wand2 size={20} />
              {format}
            </button>
          ))}
        </div>
      </Panel>
      <Panel icon={<CheckCircle2 size={20} />} title="Generated Assets">
        <div className="grid gap-3 md:grid-cols-4">
          <Fact label="Summaries" value={selected.generated?.summaries.length ?? 0} />
          <Fact label="Flashcards" value={selected.generated?.flashcards.length ?? 0} />
          <Fact label="Study Guides" value={selected.generated?.studyGuides.length ?? 0} />
          <Fact label="Answers" value={selected.generated?.answers.length ?? 0} />
        </div>
      </Panel>
    </section>
  );
}

function SearchTab(props: {
  searchQuery: string;
  loadSuggestions: (value: string) => void;
  runSearch: () => void;
  suggestions: SearchSuggestion[];
  setSearchQuery: (value: string) => void;
  setSuggestions: (value: SearchSuggestion[]) => void;
  hits: SearchHit[];
  setSelectedId: (id: string) => void;
  searchTypeFilter: string;
  setSearchTypeFilter: (value: string) => void;
  searchCategoryFilter: string;
  setSearchCategoryFilter: (value: string) => void;
  minQualityFilter: string;
  setMinQualityFilter: (value: string) => void;
  searchFacets: SearchFacets | null;
}) {
  return (
    <Panel icon={<Search size={20} />} title="Search Console">
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <input
          value={props.searchQuery}
          onChange={(event) => props.loadSuggestions(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") props.runSearch();
          }}
          className="field h-12"
          placeholder="Search documents, OCR text, metadata, clauses..."
        />
        <button onClick={props.runSearch} className="primary-button h-12">
          <Search size={18} />
          Search
        </button>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <select value={props.searchTypeFilter} onChange={(event) => props.setSearchTypeFilter(event.target.value)} className="field h-11">
          <option value="">All types</option>
          {Object.keys(props.searchFacets?.documentTypes ?? {}).map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <select value={props.searchCategoryFilter} onChange={(event) => props.setSearchCategoryFilter(event.target.value)} className="field h-11">
          <option value="">All formats</option>
          {Object.keys(props.searchFacets?.categories ?? {}).map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <select value={props.minQualityFilter} onChange={(event) => props.setMinQualityFilter(event.target.value)} className="field h-11">
          <option value="">Any quality</option>
          <option value="50">50+</option>
          <option value="70">70+</option>
          <option value="85">85+</option>
        </select>
      </div>
      {props.suggestions.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {props.suggestions.map((item) => (
            <button
              key={item.suggestion}
              onClick={() => {
                props.setSearchQuery(item.suggestion);
                props.setSuggestions([]);
              }}
              className="rounded-full bg-white/70 px-3 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200"
            >
              {item.suggestion} ({item.count})
            </button>
          ))}
        </div>
      ) : null}
      <div className="mt-5 grid gap-3">
        {props.hits.map((hit) => (
          <button key={hit.id} onClick={() => props.setSelectedId(hit.id)} className="search-hit">
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-black">{hit.filename}</span>
              <span className="mt-1 line-clamp-2 text-sm font-semibold text-slate-500">{hit.snippet}</span>
            </span>
            <span className="rounded-full bg-gradient-to-r from-emerald-400 to-cyan-500 px-3 py-1 text-xs font-black text-white">{hit.score}</span>
          </button>
        ))}
      </div>
    </Panel>
  );
}

function CommerceTab(props: {
  selected: DocumentRecord;
  vendors: PrintVendor[];
  quote: PrintQuote | null;
  loadVendors: () => void;
  createQuote: () => void;
  placeOrder: () => void;
  createCheckout: () => void;
  selectedOptimizations: CostOptimization["documentOptimizations"][number]["optimizations"];
  costOptimization: CostOptimization | null;
  isWorking: boolean;
}) {
  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Panel icon={<Store size={20} />} title="Print Marketplace">
        <div className="mb-4 flex flex-wrap gap-2">
          <button onClick={props.loadVendors} className="secondary-button h-10">
            <Store size={16} />
            Vendors
          </button>
          <button onClick={() => props.createQuote()} className="secondary-button h-10">
            <CreditCard size={16} />
            Quote
          </button>
          <button disabled={props.isWorking} onClick={() => props.placeOrder()} className="primary-button h-10">
            <Truck size={16} />
            Order
          </button>
        </div>
        {props.quote ? (
          <div className="mb-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 p-4 text-white">
            <p className="font-black">
              {props.quote.vendorName}: Rs {props.quote.total}
            </p>
            <p className="mt-1 text-sm font-semibold text-white/80">
              {props.quote.paper}, {props.quote.binding}, {props.quote.colorMode}, ETA {props.quote.etaHours}h
            </p>
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-3">
          {props.vendors.map((vendor) => (
            <div key={vendor.id} className="vendor-tile">
              <div className="flex items-center justify-between gap-3">
                <p className="font-black">{vendor.name}</p>
                {vendor.recommended ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-800">Best</span> : null}
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-500">{vendor.strengths.join(", ")}</p>
              <p className="mt-3 font-black">
                Rs {vendor.estimatedPrice.toFixed(0)} · {vendor.etaHours}h
              </p>
            </div>
          ))}
        </div>
      </Panel>
      <Panel icon={<CircleDollarSign size={20} />} title="Cost Control">
        <div className="grid gap-3">
          <Fact label="Profile" value={props.costOptimization?.profile ?? "single-vm-cpu-first"} />
          <Fact label="Infra" value={`Rs ${props.costOptimization?.infrastructure.monthlyEstimateInr ?? 650}`} />
          <Fact label="Savings" value={`Rs ${props.costOptimization?.possibleSavings ?? 0}`} />
        </div>
        <button onClick={props.createCheckout} className="primary-button mt-4 h-11 w-full">
          <CreditCard size={17} />
          Checkout
        </button>
      </Panel>
      <Panel icon={<Zap size={20} />} title="Optimization Moves">
        <div className="grid gap-3 md:grid-cols-2">
          {props.selectedOptimizations.slice(0, 4).map((item) => (
            <div key={item.title} className="flat-stack">
              <div className="flex items-center justify-between gap-3">
                <p className="font-black">{item.title}</p>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-800">Rs {item.saving}</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-500">{item.tradeoff}</p>
            </div>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function OpsTab(props: {
  selected: DocumentRecord;
  documents: DocumentRecord[];
  duplicates: DuplicateHit[];
  comparison: string | null;
  compareTargetId: string;
  setCompareTargetId: (value: string) => void;
  setSelectedId: (id: string) => void;
  loadDuplicates: () => void;
  compareDocuments: () => void;
  securityAudit: SecurityAudit | null;
  loadSecurityAudit: () => void;
  saveBrand: (formData: FormData) => void;
  brand: BrandSettings | null;
  isWorking: boolean;
  runAction: (path: string, init?: RequestInit) => void;
}) {
  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Panel icon={<Files size={20} />} title="Document Control">
        <div className="grid gap-3 md:grid-cols-[auto_1fr_auto]">
          <button onClick={props.loadDuplicates} className="secondary-button h-11">
            <Files size={16} />
            Duplicates
          </button>
          <select value={props.compareTargetId} onChange={(event) => props.setCompareTargetId(event.target.value)} className="field h-11">
            <option value="">Compare with...</option>
            {props.documents
              .filter((document) => document.id !== props.selected.id)
              .map((document) => (
                <option key={document.id} value={document.id}>
                  {document.originalName}
                </option>
              ))}
          </select>
          <button onClick={props.compareDocuments} disabled={!props.compareTargetId} className="primary-button h-11 disabled:opacity-50">
            <GitCompare size={16} />
            Compare
          </button>
        </div>
        {props.comparison ? <p className="mt-3 rounded-2xl bg-white/60 p-3 text-sm font-semibold text-slate-600">{props.comparison}</p> : null}
        <div className="mt-3 grid gap-2">
          {props.duplicates.slice(0, 4).map((duplicate) => (
            <button key={duplicate.id} onClick={() => props.setSelectedId(duplicate.id)} className="flat-row">
              <span className="truncate font-black">{duplicate.filename}</span>
              <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-black text-indigo-800">{duplicate.similarity}%</span>
            </button>
          ))}
        </div>
      </Panel>
      <Panel icon={<ShieldCheck size={20} />} title="Security Audit">
        <button onClick={props.loadSecurityAudit} className="primary-button h-11 w-full">
          <ShieldCheck size={16} />
          Run Audit
        </button>
        {props.securityAudit ? (
          <div className="mt-4">
            <div className="rounded-2xl bg-slate-950 p-4 text-white">
              <p className="text-sm font-semibold text-white/60">Security Score</p>
              <p className="mt-1 text-4xl font-black">{props.securityAudit.score}</p>
              <p className="text-sm font-black capitalize text-cyan-200">{readableStatus(props.securityAudit.posture)}</p>
            </div>
            <div className="mt-3 grid gap-2">
              {props.securityAudit.findings.slice(0, 5).map((finding) => (
                <div key={finding.id} className="flat-row">
                  <span className="truncate font-black">{finding.title}</span>
                  <span className={`rounded-full px-2 py-1 text-xs font-black ${finding.status === "pass" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                    {finding.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Panel>
      <Panel icon={<Brush size={20} />} title="Brand System">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            props.saveBrand(new FormData(event.currentTarget));
          }}
          className="grid gap-3 md:grid-cols-2"
        >
          <input name="name" defaultValue={props.brand?.name ?? "IntelliDoc AI"} className="field h-11" />
          <input name="logoText" defaultValue={props.brand?.logoText ?? "ID"} className="field h-11" />
          <input name="tagline" defaultValue={props.brand?.tagline ?? ""} className="field h-11" />
          <input name="marketplaceName" defaultValue={props.brand?.marketplaceName ?? "Print Network"} className="field h-11" />
          <input name="supportEmail" defaultValue={props.brand?.supportEmail ?? "support@intellidoc.local"} className="field h-11 md:col-span-2" />
          <button className="secondary-button h-11 md:col-span-2">Save Brand</button>
        </form>
      </Panel>
      <Panel icon={<Eraser size={20} />} title="Privacy Actions">
        <button
          disabled={props.isWorking}
          onClick={() =>
            props.runAction(`/api/documents/${props.selected.id}/redact`, {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({})
            })
          }
          className="primary-button h-11 w-full"
        >
          <Eraser size={16} />
          Create Redacted Copy
        </button>
        <button disabled={props.isWorking} onClick={() => props.runAction(`/api/documents/${props.selected.id}/signed-url`)} className="secondary-button mt-3 h-11 w-full">
          <Link size={16} />
          Signed URL
        </button>
      </Panel>
    </section>
  );
}

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string | number; tone: "violet" | "cyan" | "emerald" | "amber" }) {
  const tones = {
    violet: "from-violet-600 to-fuchsia-500",
    cyan: "from-cyan-500 to-blue-600",
    emerald: "from-emerald-500 to-teal-600",
    amber: "from-amber-400 to-orange-500"
  };
  return (
    <div className="metric-tile">
      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-soft ${tones[tone]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xl font-black leading-none sm:text-2xl">{value}</p>
        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white/65 px-3 py-2 ring-1 ring-white/70">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <span className="font-black">{value}</span>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="tool-panel p-4 md:p-5">
      <SectionTitle icon={icon} title={title} />
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SectionTitle({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white">{icon}</span>
      <h3 className="text-base font-black tracking-normal">{title}</h3>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-white/60 px-4 py-3 ring-1 ring-white/70">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 truncate text-base font-black">{value}</p>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-black capitalize text-slate-600 ring-1 ring-slate-200">{children}</span>;
}
