export class IntelliDocClient {
  constructor(
    private readonly baseUrl = "http://localhost:3000",
    private readonly apiKey?: string
  ) {}

  async upload(file: File, options?: { budget?: string; urgency?: string }) {
    const formData = new FormData();
    formData.append("file", file);
    if (options?.budget) formData.append("budget", options.budget);
    if (options?.urgency) formData.append("urgency", options.urgency);
    return this.request("/v1/documents", { method: "POST", body: formData });
  }

  async getDocument(id: string) {
    return this.request(`/v1/results/${id}`);
  }

  async listDocuments(options?: { page?: number; limit?: number }) {
    const params = new URLSearchParams();
    if (options?.page) params.set("page", String(options.page));
    if (options?.limit) params.set("limit", String(options.limit));
    return this.request(`/v1/documents${params.size ? `?${params.toString()}` : ""}`);
  }

  async createApiKey(name: string, scopes = ["documents:read", "documents:write", "jobs:write", "search:read", "usage:read"]) {
    return this.request("/v1/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, scopes })
    });
  }

  async createAnalysisJob(documentId: string) {
    return this.request("/v1/jobs/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document_id: documentId })
    });
  }

  async createOcrJob(documentId: string) {
    return this.request("/v1/jobs/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document_id: documentId })
    });
  }

  async search(q: string) {
    return this.request(`/v1/search?q=${encodeURIComponent(q)}`);
  }

  async translate(id: string, targetLanguage: string) {
    return this.request("/v1/jobs/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document_id: id, target_language: targetLanguage })
    });
  }

  async reformat(id: string, format: "pdf" | "docx" | "pptx" = "pdf") {
    return this.request("/v1/jobs/reformat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document_id: id, format })
    });
  }

  async getJob(id: string) {
    return this.request(`/v1/jobs/${id}`);
  }

  async getUsage() {
    return this.request("/v1/usage");
  }

  private async request(path: string, init?: RequestInit) {
    const headers = new Headers(init?.headers);
    if (this.apiKey) headers.set("Authorization", `Bearer ${this.apiKey}`);
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message ?? payload.error ?? "IntelliDoc API request failed");
    return payload;
  }
}
