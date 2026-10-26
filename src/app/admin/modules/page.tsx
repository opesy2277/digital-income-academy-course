"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  FileText,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type ModuleRecord = {
  id: string;
  title: string;
  description: string | null;
  module_number: number;
  published: boolean;
  created_at: string;
};

type ModuleFormValues = {
  title: string;
  description: string;
  published: boolean;
};

const TOTAL_MODULES = 9;

const EMPTY_FORM: ModuleFormValues = {
  title: "",
  description: "",
  published: false,
};

const MODULE_SELECT =
  "id, title, description, module_number, published, created_at";

export default function AdminModulesPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [modules, setModules] = useState<ModuleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [editing, setEditing] = useState<ModuleRecord | null>(null);
  const [form, setForm] = useState<ModuleFormValues>(EMPTY_FORM);
  const [search, setSearch] = useState("");

  const loadModules = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: fetchError } = await supabase
        .from("modules")
        .select(MODULE_SELECT)
        .order("module_number", { ascending: true });

      if (fetchError) throw fetchError;

      setModules((data ?? []) as ModuleRecord[]);
    } catch (err) {
      console.error("Unable to load modules:", err);
      setError(
        "Could not load modules. Check your connection and Supabase permissions."
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    let active = true;

    async function checkAdmin() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        if (!profile || profile.role !== "admin") {
          router.replace("/");
          return;
        }

        if (active) {
          setCheckingAccess(false);
          await loadModules();
        }
      } catch (err) {
        console.error("Admin access check failed:", err);

        if (active) {
          setError(
            "Unable to verify admin access. Check your profile and Supabase permissions."
          );
          setCheckingAccess(false);
          setLoading(false);
        }
      }
    }

    void checkAdmin();

    return () => {
      active = false;
    };
  }, [loadModules, router, supabase]);

  const existingNumbers = useMemo(
    () => new Set(modules.map((item) => item.module_number)),
    [modules]
  );

  const availableNumbers = useMemo(
    () =>
      Array.from({ length: TOTAL_MODULES }, (_, index) => index + 1).filter(
        (number) => !existingNumbers.has(number)
      ),
    [existingNumbers]
  );

  const filteredModules = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return modules;

    return modules.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        String(item.module_number).includes(query) ||
        (item.description ?? "").toLowerCase().includes(query)
    );
  }, [modules, search]);

  const publishedCount = modules.filter((item) => item.published).length;
  const draftCount = modules.length - publishedCount;

  function resetForm() {
    setForm(EMPTY_FORM);
    setSelectedNumber(null);
    setEditing(null);
    setCreateMenuOpen(false);
  }

  function startCreating(number: number) {
    if (existingNumbers.has(number)) {
      setError(`Module ${number} already exists and cannot be recreated.`);
      return;
    }

    setError("");
    setNotice("");
    setEditing(null);
    setSelectedNumber(number);
    setForm(EMPTY_FORM);
    setCreateMenuOpen(false);
  }

  // Edit in place. Do not scroll the page.
  function startEditing(item: ModuleRecord) {
    setError("");
    setNotice("");
    setCreateMenuOpen(false);
    setSelectedNumber(null);
    setEditing(item);

    setForm({
      title: item.title,
      description: item.description ?? "",
      published: item.published,
    });
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setNotice("");

    const title = form.title.trim();
    const description = form.description.trim();

    if (!title) {
      setError("Enter a title for this module.");
      return;
    }

    if (!editing && selectedNumber === null) {
      setError("Choose an unused module number first.");
      return;
    }

    if (
      !editing &&
      selectedNumber !== null &&
      existingNumbers.has(selectedNumber)
    ) {
      setError(
        `Module ${selectedNumber} already exists. Refresh and choose an unused number.`
      );
      return;
    }

    setSaving(true);

    try {
      if (editing) {
        const { data, error: updateError } = await supabase
          .from("modules")
          .update({
            title,
            description: description || null,
            published: form.published,
          })
          .eq("id", editing.id)
          .select(MODULE_SELECT)
          .single();

        if (updateError) throw updateError;

        setModules((current) =>
          current
            .map((item) =>
              item.id === editing.id ? (data as ModuleRecord) : item
            )
            .sort((a, b) => a.module_number - b.module_number)
        );

        setNotice(`Module ${editing.module_number} updated successfully.`);
        resetForm();
      } else {
        const numberToCreate = selectedNumber!;

        const { data, error: insertError } = await supabase
          .from("modules")
          .insert({
            module_number: numberToCreate,
            title,
            description: description || null,
            published: form.published,
          })
          .select(MODULE_SELECT)
          .single();

        if (insertError) {
          if (insertError.code === "23505") {
            throw new Error(
              `Module ${numberToCreate} already exists. Refresh and choose an unused number.`
            );
          }

          throw insertError;
        }

        setModules((current) =>
          [...current, data as ModuleRecord].sort(
            (a, b) => a.module_number - b.module_number
          )
        );

        setNotice(`Module ${numberToCreate} created successfully.`);
        resetForm();
      }
    } catch (err) {
      console.error("Saving module failed:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save this module. Check your Supabase policies."
      );
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(item: ModuleRecord) {
    setError("");
    setNotice("");

    try {
      const { data, error: updateError } = await supabase
        .from("modules")
        .update({ published: !item.published })
        .eq("id", item.id)
        .select(MODULE_SELECT)
        .single();

      if (updateError) throw updateError;

      setModules((current) =>
        current.map((module) =>
          module.id === item.id ? (data as ModuleRecord) : module
        )
      );

      setNotice(
        `Module ${item.module_number} ${
          data.published ? "published" : "unpublished"
        } successfully.`
      );
    } catch (err) {
      console.error("Changing module status failed:", err);

      setError(
        "Could not change publication status. Check your Supabase update policy."
      );
    }
  }

  if (checkingAccess || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f9fc] px-4">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <LoaderCircle className="h-5 w-5 animate-spin text-[#12346b]" />
          Loading module management...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
        <div className="mb-8">
          <Link
            href="/admin"
            className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-[#12346b]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>

          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#234c87]">
                <ShieldCheck className="h-4 w-4" />
                Administration
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-[#10284f] sm:text-3xl">
                Course modules
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Create modules, manage course content, and control what
                students can access.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadModules()}
              className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-[#c6d4e8] hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
              className="ml-auto rounded p-1 hover:bg-red-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mb-5 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{notice}</p>
            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Dismiss message"
              className="ml-auto rounded p-1 hover:bg-emerald-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard
            icon={<BookOpen className="h-5 w-5" />}
            label="Existing modules"
            value={`${modules.length} / ${TOTAL_MODULES}`}
            detail="Module numbers already in use"
          />
          <SummaryCard
            icon={<Check className="h-5 w-5" />}
            label="Published"
            value={String(publishedCount)}
            detail="Modules marked as published"
          />
          <SummaryCard
            icon={<FileText className="h-5 w-5" />}
            label="Drafts"
            value={String(draftCount)}
            detail="Modules not currently published"
          />
        </section>

        {/* CREATE MODULE */}
        <section className="mb-9 rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#edf2fa] text-[#12346b]">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[#10284f]">
                  Create module
                </h2>
                <p className="mt-1 text-sm leading-5 text-slate-500">
                  Select a module number that has not been used before.
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {availableNumbers.length > 0
                    ? `${availableNumbers.length} number${
                        availableNumbers.length === 1 ? "" : "s"
                      } available`
                    : "All module numbers are in use"}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Unpublished modules also count as existing modules.
                </p>
              </div>

              <div className="relative w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setNotice("");
                    setCreateMenuOpen((open) => !open);
                  }}
                  disabled={availableNumbers.length === 0}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#12346b] px-4 text-sm font-semibold text-white transition hover:bg-[#0d2855] disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
                >
                  <Plus className="h-4 w-4" />
                  Create module
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      createMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {createMenuOpen && availableNumbers.length > 0 && (
                  <div className="absolute right-0 z-20 mt-2 w-full min-w-56 overflow-hidden rounded-lg border border-slate-200 bg-white p-2 shadow-lg sm:w-64">
                    <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Choose module number
                    </p>
                    {availableNumbers.map((number) => (
                      <button
                        key={number}
                        type="button"
                        onClick={() => startCreating(number)}
                        className="flex w-full items-center justify-between rounded-md px-3 py-3 text-left text-sm text-slate-700 transition hover:bg-[#f0f4fa] hover:text-[#12346b]"
                      >
                        <span>Module {number}</span>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {!editing && selectedNumber !== null && (
              <form
                onSubmit={handleSave}
                className="mt-6 border-t border-slate-100 pt-6"
              >
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#234c87]">
                      New module
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-[#10284f]">
                      Module {selectedNumber}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={resetForm}
                    aria-label="Cancel creating module"
                    className="rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <ModuleFields
                  form={form}
                  setForm={setForm}
                  disabled={saving}
                />
                <FormActions
                  saving={saving}
                  submitLabel="Create module"
                  onCancel={resetForm}
                />
              </form>
            )}

            {availableNumbers.length === 0 && (
              <div className="mt-5 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                All nine module numbers already exist. Edit an existing module
                below instead of creating a duplicate.
              </div>
            )}
          </div>
        </section>

        {/* EDIT EXISTING MODULES */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#edf2fa] text-[#12346b]">
                  <Pencil className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[#10284f]">
                    Edit existing modules
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Edit module details or change publication status.
                  </p>
                </div>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search modules..."
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#5276ad] focus:ring-2 focus:ring-[#12346b]/10"
                />
              </div>
            </div>
          </div>

          {filteredModules.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <BookOpen className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-700">
                {modules.length === 0
                  ? "No modules found"
                  : "No matching modules"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {modules.length === 0
                  ? "Create a module using the section above."
                  : "Try another search term."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredModules.map((item) => (
                <div key={item.id} className="px-5 py-5 sm:px-6">
                  {editing?.id === item.id ? (
                    <form onSubmit={handleSave}>
                      <div className="mb-5 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-[#234c87]">
                            Editing existing record
                          </p>
                          <h3 className="mt-1 text-lg font-semibold text-[#10284f]">
                            Module {item.module_number}
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={resetForm}
                          aria-label="Cancel editing"
                          className="rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>

                      <ModuleFields
                        form={form}
                        setForm={setForm}
                        disabled={saving}
                      />
                      <FormActions
                        saving={saving}
                        submitLabel="Save changes"
                        onCancel={resetForm}
                      />
                    </form>
                  ) : (
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold text-[#12346b]">
                        {String(item.module_number).padStart(2, "0")}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="break-words text-sm font-semibold text-slate-900">
                            {item.title}
                          </h3>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                              item.published
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                item.published
                                  ? "bg-emerald-500"
                                  : "bg-amber-500"
                              }`}
                            />
                            {item.published ? "Published" : "Draft"}
                          </span>
                        </div>

                        <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">
                          {item.description || "No description added yet."}
                        </p>
                        <p className="mt-2 text-xs text-slate-400">
                          Module {item.module_number}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void togglePublished(item)}
                          className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-[#c6d4e8] hover:bg-slate-50 hover:text-[#12346b]"
                        >
                          {item.published ? "Unpublish" : "Publish"}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditing(item)}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#12346b] px-3 text-xs font-semibold text-white transition hover:bg-[#0d2855]"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3 sm:px-6">
            <p className="text-xs text-slate-500">
              Showing {filteredModules.length} of {modules.length} existing
              modules. Existing module numbers cannot be recreated.
            </p>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-slate-400">
          Digital Income Academy · Module Administration
        </p>
      </div>
    </main>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#edf2fa] text-[#12346b]">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-[#10284f]">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function ModuleFields({
  form,
  setForm,
  disabled,
}: {
  form: ModuleFormValues;
  setForm: React.Dispatch<React.SetStateAction<ModuleFormValues>>;
  disabled: boolean;
}) {
  return (
    <div className="space-y-5">
      <div>
        <label
          htmlFor="module-title"
          className="mb-2 block text-sm font-medium text-slate-700"
        >
          Module title <span className="text-red-500">*</span>
        </label>
        <input
          id="module-title"
          type="text"
          required
          maxLength={180}
          value={form.title}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              title: event.target.value,
            }))
          }
          disabled={disabled}
          placeholder="Enter a clear module title"
          className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#5276ad] focus:ring-2 focus:ring-[#12346b]/10 disabled:bg-slate-50"
        />
      </div>

      <div>
        <label
          htmlFor="module-description"
          className="mb-2 block text-sm font-medium text-slate-700"
        >
          Description
        </label>
        <textarea
          id="module-description"
          rows={4}
          maxLength={3000}
          value={form.description}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
          disabled={disabled}
          placeholder="Explain what students will learn in this module..."
          className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-[#5276ad] focus:ring-2 focus:ring-[#12346b]/10 disabled:bg-slate-50"
        />
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-4 transition hover:bg-slate-50">
        <input
          type="checkbox"
          checked={form.published}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              published: event.target.checked,
            }))
          }
          disabled={disabled}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[#12346b]"
        />
        <span>
          <span className="block text-sm font-medium text-slate-800">
            Publish this module
          </span>
          <span className="mt-1 block text-xs leading-5 text-slate-500">
            Published modules can be made available to students according to
            your portal access rules.
          </span>
        </span>
      </label>
    </div>
  );
}

function FormActions({
  saving,
  submitLabel,
  onCancel,
}: {
  saving: boolean;
  submitLabel: string;
  onCancel: () => void;
}) {
  return (
    <div className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={saving}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#12346b] px-5 text-sm font-semibold text-white transition hover:bg-[#0d2855] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {saving ? "Saving..." : submitLabel}
      </button>
    </div>
  );
}