import { API_BASE, authFetch } from "./client";

export type AssetType =
  | "internship"
  | "project"
  | "education"
  | "research"
  | "award"
  | "highlight";

export interface Asset {
  id: string;
  type: AssetType;
  title: string;
  company: string;
  time: string;
  raw_memory: string;
  resume_snippet: string;
  tags: string[];
  school: string;
  major: string;
  degree: string;
  created_at: string;
  updated_at: string;
}

export interface AssetInput {
  type: AssetType;
  title: string;
  company?: string;
  time?: string;
  raw_memory?: string;
  resume_snippet?: string;
  tags?: string[];
  school?: string;
  major?: string;
  degree?: string;
}

export async function listAssets(type?: AssetType): Promise<Asset[]> {
  const qs = type ? `?type=${type}` : "";
  const res = await authFetch(`${API_BASE}/assets${qs}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createAsset(input: AssetInput): Promise<Asset> {
  const res = await authFetch(`${API_BASE}/assets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateAsset(id: string, input: Partial<AssetInput>): Promise<Asset> {
  const res = await authFetch(`${API_BASE}/assets/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteAsset(id: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/assets/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await res.text());
}

/** 解析已上传的简历 PDF → 候选资产草稿（不落库，供人工审核）。 */
export async function importFromResume(): Promise<AssetInput[]> {
  const res = await authFetch(`${API_BASE}/assets/import-from-resume`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.drafts ?? [];
}

/** 解析一段自由文本 → 候选资产草稿（不落库，供人工审核）。 */
export async function parseText(text: string): Promise<AssetInput[]> {
  const res = await authFetch(`${API_BASE}/assets/parse-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.drafts ?? [];
}

/** 导出全部资产为 Markdown（备份），触发浏览器下载。 */
export async function exportAssetsMarkdown(): Promise<void> {
  const res = await authFetch(`${API_BASE}/assets/export`);
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "assets-backup.md";
  a.click();
  URL.revokeObjectURL(url);
}
