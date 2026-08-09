import { useCallback, useEffect, useState } from "react";
import { Briefcase, FolderKanban, GraduationCap, Plus, Pencil, Trash2, X, FileUp, Loader2, Download, FlaskConical, Trophy, Sparkles } from "lucide-react";
import {
  Asset,
  AssetInput,
  createAsset,
  deleteAsset,
  exportAssetsMarkdown,
  importFromResume,
  listAssets,
  parseText,
  updateAsset,
} from "../api/assets";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import RichTextEditor from "../resume/shared/rich-editor/RichEditor";

const PAGE_CLASS =
  "flex-1 w-full max-w-[1600px] mx-auto px-4 py-6 md:px-7 md:py-8 xl:px-10 2xl:px-12";

const TABS = [
  { key: "internship" as const, label: "实习经历", icon: Briefcase },
  { key: "project" as const, label: "项目经历", icon: FolderKanban },
  { key: "research" as const, label: "科研经历", icon: FlaskConical },
  { key: "award" as const, label: "获奖经历", icon: Trophy },
  { key: "education" as const, label: "教育背景", icon: GraduationCap },
  { key: "highlight" as const, label: "个人优势", icon: Sparkles },
];

const TYPE_LABEL: Record<string, string> = {
  internship: "实习经历",
  project: "项目经历",
  research: "科研经历",
  award: "获奖经历",
  education: "教育背景",
  highlight: "个人优势",
};

const EMPTY_FORM: AssetInput = {
  type: "internship",
  title: "",
  company: "",
  time: "",
  raw_memory: "",
  resume_snippet: "",
  tags: [],
  school: "",
  major: "",
  degree: "",
};

type TabKey = (typeof TABS)[number]["key"];

export default function AssetsPage() {
  const [tab, setTab] = useState<TabKey>("internship");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 编辑态:undefined=关闭;null=新建;Asset=编辑已有
  const [editing, setEditing] = useState<Asset | null | undefined>(undefined);
  const [form, setForm] = useState<AssetInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // 简历导入审核态:undefined=关闭;null=加载中;AssetInput[]=待审核草稿
  const [importing, setImporting] = useState<boolean>(false);
  const [drafts, setDrafts] = useState<AssetInput[] | null | undefined>(undefined);
  const [draftSelected, setDraftSelected] = useState<boolean[]>([]);
  const [importError, setImportError] = useState("");

  // 文本导入态:undefined=关闭;''=输入框已开待解析;非空=解析中
  const [textModal, setTextModal] = useState<boolean>(false);
  const [textInput, setTextInput] = useState("");
  const [parsing, setParsing] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await listAssets(tab);
      setAssets(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleImport() {
    setImporting(true);
    setImportError("");
    try {
      const result = await importFromResume();
      setDrafts(result);
      setDraftSelected(result.map(() => true)); // 默认全选
    } catch (e) {
      setImportError(String(e));
      setDrafts(null);
    } finally {
      setImporting(false);
    }
  }

  async function handleExport() {
    try {
      await exportAssetsMarkdown();
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleParseText() {
    if (!textInput.trim() || parsing) return;
    setParsing(true);
    setImportError("");
    try {
      const result = await parseText(textInput);
      setTextModal(false);
      setTextInput("");
      setDrafts(result);
      setDraftSelected(result.map(() => true));
    } catch (e) {
      setImportError(String(e));
    } finally {
      setParsing(false);
    }
  }

  function updateDraft(i: number, patch: Partial<AssetInput>) {
    setDrafts((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  }

  async function handleImportConfirm() {
    if (!drafts) return;
    const chosen = drafts.filter((_, i) => draftSelected[i]);
    setSaving(true);
    try {
      const created: Asset[] = [];
      for (const d of chosen) {
        if (!d.title.trim()) continue;
        created.push(await createAsset(d));
      }
      setDrafts(undefined);
      setAssets((prev) => [...created, ...prev]);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM, type: tab });
    setEditing(null);
  }

  function openEdit(asset: Asset) {
    setForm({
      type: asset.type,
      title: asset.title,
      company: asset.company,
      time: asset.time,
      raw_memory: asset.raw_memory,
      resume_snippet: asset.resume_snippet,
      tags: [...asset.tags],
      school: asset.school ?? "",
      major: asset.major ?? "",
      degree: asset.degree ?? "",
    });
    setEditing(asset);
  }

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateAsset(editing.id, form);
        setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      } else {
        const created = await createAsset(form);
        setAssets((prev) => [created, ...prev]);
      }
      setEditing(undefined);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("确定删除这条资产？此操作不可恢复。")) return;
    try {
      await deleteAsset(id);
      setAssets((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div className={PAGE_CLASS}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">经历资产库</h1>
          <p className="text-sm text-dim mt-1">
            每段经历存「真实回忆」和「已整理简历片段」两个视角，供后续 JD 匹配与简历生成使用。
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleExport} title="导出全部资产为 Markdown 备份">
            <Download size={16} className="mr-1.5" /> 导出备份
          </Button>
          <Button variant="outline" onClick={() => setTextModal(true)}>
            <FileUp size={16} className="mr-1.5" /> 文本导入
          </Button>
          <Button variant="outline" onClick={handleImport} disabled={importing}>
            {importing ? <Loader2 size={16} className="mr-1.5 animate-spin" /> : <FileUp size={16} className="mr-1.5" />}
            从简历导入
          </Button>
          <Button onClick={openCreate}>
            <Plus size={16} className="mr-1.5" /> 新建资产
          </Button>
        </div>
      </div>

      {importError && (
        <div className="mb-4 px-3 py-2 rounded-lg text-[13px] bg-red-500/10 text-red-400">
          {importError}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 mb-5">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] transition-all",
              tab === key
                ? "bg-primary/12 text-primary font-medium"
                : "text-dim hover:text-text hover:bg-hover"
            )}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg text-[13px] bg-red-500/10 text-red-400">
          {error}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="text-sm text-dim py-10 text-center">加载中…</div>
      ) : assets.length === 0 ? (
        <Card className="py-12 text-center text-sm text-dim border-dashed">
          <p className="mb-3">还没有「{TYPE_LABEL[tab]}」资产</p>
          <Button variant="outline" size="sm" onClick={openCreate}>
            <Plus size={14} className="mr-1" /> 添加第一条
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {assets.map((asset) => (
            <Card key={asset.id}>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">
                      {asset.type === "education"
                        ? (asset.major || asset.title)
                        : asset.title}
                    </h3>
                    {asset.type === "education" ? (
                      <p className="text-xs text-dim mt-0.5">
                        {[asset.school, asset.degree, asset.time].filter(Boolean).join(" · ")}
                      </p>
                    ) : (
                      (asset.company || asset.time) && (
                        <p className="text-xs text-dim mt-0.5">
                          {[asset.company, asset.time].filter(Boolean).join(" · ")}
                        </p>
                      )
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(asset)}
                      title="编辑"
                    >
                      <Pencil size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(asset.id)}
                      title="删除"
                    >
                      <Trash2 size={15} className="text-red-400" />
                    </Button>
                  </div>
                </div>

                {asset.raw_memory && (
                  <div className="mt-3">
                    <div className="text-xs text-dim mb-1">真实回忆</div>
                    <p className="text-[13px] whitespace-pre-wrap leading-relaxed">
                      {asset.raw_memory}
                    </p>
                  </div>
                )}
                {asset.resume_snippet && (
                  <div className="mt-3">
                    <div className="text-xs text-dim mb-1">简历片段</div>
                    <div
                      className="text-[13px] leading-relaxed text-text/90 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:space-y-1 [&_li]:mt-0.5 [&_b]:font-semibold [&_u]:underline [&_i]:italic"
                      dangerouslySetInnerHTML={{ __html: asset.resume_snippet }}
                    />
                  </div>
                )}

                {asset.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {asset.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="text-[11px]">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Editor modal */}
      {editing !== undefined && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold">
                  {editing ? "编辑资产" : "新建资产"}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setEditing(undefined)}>
                  <X size={16} />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <Label className="text-xs">类型</Label>
                  <select
                    value={form.type}
                    onChange={(e) =>
                      setForm({ ...form, type: e.target.value as AssetInput["type"] })
                    }
                    className="mt-1 w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {TABS.map(({ key, label }) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">
                    {form.type === "education" ? "专业 *" : form.type === "award" ? "奖项名 *" : "名称 *"}
                  </Label>
                  <Input
                    className="mt-1"
                    placeholder={
                      form.type === "education"
                        ? "如：人工智能"
                        : form.type === "award"
                          ? "如：国家奖学金"
                          : "如：推荐系统实习"
                    }
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>

                {form.type === "education" ? (
                  <>
                    <div>
                      <Label className="text-xs">学校</Label>
                      <Input
                        className="mt-1"
                        placeholder="如：中山大学"
                        value={form.school ?? ""}
                        onChange={(e) => setForm({ ...form, school: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">学历</Label>
                      <Input
                        className="mt-1"
                        placeholder="如：硕士 / 本科"
                        value={form.degree ?? ""}
                        onChange={(e) => setForm({ ...form, degree: e.target.value })}
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <Label className="text-xs">
                      {form.type === "project" ? "担任角色" : form.type === "research" ? "期刊 / 会议" : "公司 / 组织"}
                    </Label>
                    <Input
                      className="mt-1"
                      placeholder={
                        form.type === "project"
                          ? "如：项目负责人"
                          : form.type === "research"
                            ? "如：ESWA (SCI 一区)"
                            : "如：字节跳动"
                      }
                      value={form.company}
                      onChange={(e) => setForm({ ...form, company: e.target.value })}
                    />
                  </div>
                )}

                <div>
                  <Label className="text-xs">时间段</Label>
                  <Input
                    className="mt-1"
                    placeholder="如：2025.06 - 2025.09"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                  />
                </div>
              </div>

              <div className="mb-4">
                <Label className="text-xs">真实回忆（口头语言总结实际工作）</Label>
                <Textarea
                  className="mt-1 min-h-[80px]"
                  placeholder="用你的话说这段经历做了什么、遇到什么问题、怎么解决的…"
                  value={form.raw_memory}
                  onChange={(e) => setForm({ ...form, raw_memory: e.target.value })}
                />
              </div>

              <div className="mb-4">
                <Label className="text-xs">简历片段（富文本：可加粗、下划线、分点）</Label>
                <div className="mt-1 rounded-md border border-border">
                  <RichTextEditor
                    content={form.resume_snippet ?? ""}
                    onChange={(html) => setForm({ ...form, resume_snippet: html })}
                    placeholder="写要点，选中文字可加粗/加下划线…"
                  />
                </div>
              </div>

              <div className="mb-5">
                <Label className="text-xs">标签（逗号分隔）</Label>
                <Input
                  className="mt-1"
                  placeholder="如：推荐, 高并发, 图神经网络"
                  value={(form.tags ?? []).join(", ")}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      tags: e.target.value
                        .split(/[,，]/)
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEditing(undefined)}>
                  取消
                </Button>
                <Button onClick={handleSave} disabled={saving || !form.title.trim()}>
                  {saving ? "保存中…" : "保存"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 文本导入弹窗 */}
      {textModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-2xl">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">文本导入经历</h2>
                <Button variant="ghost" size="icon" onClick={() => setTextModal(false)}>
                  <X size={16} />
                </Button>
              </div>
              <p className="text-xs text-dim mb-3">
                粘贴一段自由文本（口头回忆、笔记、聊天记录等），自动拆成多条候选经历，审核后入库。
              </p>
              <Textarea
                className="min-h-[180px] text-[13px]"
                placeholder={"例如：\n2025.09-12 在字节做 AI Agent 工程师，用 Claude Code 开发自动化 Agent，搭了 SOP 流程，效果提升 40%…\n2024 年自己做了个金融 RAG 项目，用 FastAPI + Web Components 搭的…"}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
              />
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="ghost" onClick={() => setTextModal(false)}>
                  取消
                </Button>
                <Button onClick={handleParseText} disabled={parsing || !textInput.trim()}>
                  {parsing ? (
                    <>
                      <Loader2 size={15} className="mr-1.5 animate-spin" /> 解析中…
                    </>
                  ) : (
                    "解析并审核"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 简历导入审核弹窗 */}
      {drafts !== undefined && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-3xl max-h-[90vh] flex flex-col">
            <CardContent className="pt-6 flex flex-col min-h-0 flex-1">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold">
                  审核简历导入{drafts === null ? "" : `（${drafts.length} 条）`}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setDrafts(undefined)}>
                  <X size={16} />
                </Button>
              </div>

              {drafts === null ? (
                <div className="py-12 text-center text-sm text-dim">暂无可导入的经历条目</div>
              ) : drafts.length === 0 ? (
                <div className="py-12 text-center text-sm text-dim">
                  解析完成，但没有可导入的条目（可能简历内容较少）
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-3 text-xs text-dim">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDraftSelected(draftSelected.map(() => true))}
                    >
                      全选
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDraftSelected(draftSelected.map(() => false))}
                    >
                      全不选
                    </Button>
                    <span>
                      已选 {draftSelected.filter(Boolean).length} 条，确认后逐条写入资产库
                    </span>
                  </div>

                  <div className="space-y-3 overflow-y-auto pr-1 flex-1 min-h-0">
                    {drafts.map((d, i) => (
                      <Card key={i} className="p-4">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={draftSelected[i]}
                            onChange={(e) => {
                              const next = [...draftSelected];
                              next[i] = e.target.checked;
                              setDraftSelected(next);
                            }}
                            className="mt-1.5 shrink-0"
                          />
                          <div className="flex-1 space-y-2">
                            <div className="flex gap-2">
                              <div className="w-1/3">
                                <Label className="text-[11px] text-dim">
                                  {d.type === "education" ? "专业" : "名称"}
                                </Label>
                                <Input
                                  className="mt-0.5 h-8 text-[13px]"
                                  value={d.title}
                                  onChange={(e) => updateDraft(i, { title: e.target.value })}
                                />
                              </div>
                              <div className="w-1/3">
                                <Label className="text-[11px] text-dim">
                                  {d.type === "education"
                                    ? "学校"
                                    : d.type === "project"
                                      ? "角色"
                                      : d.type === "research"
                                        ? "期刊/会议"
                                        : "公司/组织"}
                                </Label>
                                <Input
                                  className="mt-0.5 h-8 text-[13px]"
                                  value={(d.school ?? "") || (d.company ?? "")}
                                  onChange={(e) => {
                                    if (d.type === "education") {
                                      updateDraft(i, { school: e.target.value });
                                    } else {
                                      updateDraft(i, { company: e.target.value });
                                    }
                                  }}
                                />
                              </div>
                              <div className="w-1/3">
                                <Label className="text-[11px] text-dim">时间</Label>
                                <Input
                                  className="mt-0.5 h-8 text-[13px]"
                                  value={d.time ?? ""}
                                  onChange={(e) => updateDraft(i, { time: e.target.value })}
                                />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <select
                                value={d.type}
                                onChange={(e) =>
                                  updateDraft(i, { type: e.target.value as AssetInput["type"] })
                                }
                                className="h-8 px-2 rounded-md border border-border bg-background text-[13px] focus:outline-none"
                              >
                                {TABS.map(({ key, label }) => (
                                  <option key={key} value={key}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                              {d.type === "education" && (
                                <Input
                                  className="h-8 text-[13px]"
                                  placeholder="学历（如 硕士）"
                                  value={d.degree ?? ""}
                                  onChange={(e) => updateDraft(i, { degree: e.target.value })}
                                />
                              )}
                            </div>
                            <div>
                              <Label className="text-[11px] text-dim">简历片段（富文本）</Label>
                              <div className="mt-0.5 rounded-md border border-border">
                                <RichTextEditor
                                  content={d.resume_snippet ?? ""}
                                  onChange={(html) => updateDraft(i, { resume_snippet: html })}
                                  placeholder="写要点，选中文字可加粗/加下划线…"
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-[11px] text-dim">真实回忆（可补充口头总结，可留空）</Label>
                              <Textarea
                                className="mt-0.5 min-h-[40px] text-[13px]"
                                placeholder="用你的话说这段经历…"
                                value={d.raw_memory ?? ""}
                                onChange={(e) => updateDraft(i, { raw_memory: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label className="text-[11px] text-dim">标签</Label>
                              <Input
                                className="mt-0.5 h-8 text-[13px]"
                                value={(d.tags ?? []).join(", ")}
                                onChange={(e) =>
                                  updateDraft(i, {
                                    tags: e.target.value
                                      .split(/[,，]/)
                                      .map((s) => s.trim())
                                      .filter(Boolean),
                                  })
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="ghost" onClick={() => setDrafts(undefined)}>
                      取消
                    </Button>
                    <Button onClick={handleImportConfirm} disabled={saving}>
                      {saving ? "导入中…" : "导入选中条目"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
