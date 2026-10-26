
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Plus,
  Pencil,
  Save,
  X,
  Eye,
  EyeOff,
  LoaderCircle,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type CourseModule = {
  id: string;
  module_number: number;
  title: string;
  description: string | null;
  published: boolean;
};

const MAX_MODULES = 9;

export default function CourseModulesPage() {
  const router = useRouter();

  const [modules, setModules] = useState<CourseModule[]>([]);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CourseModule | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [moduleNumber, setModuleNumber] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const usedNumbers = new Set(modules.map((item) => item.module_number));

  function getFirstAvailableNumber() {
    for (let number = 1; number <= MAX_MODULES; number++) {
      if (!usedNumbers.has(number)) return number;
    }
    return null;
  }

  async function loadModules() {
    const supabase = createClient();

    const { data, error: fetchError } = await supabase
      .from("modules")
      .select("id, module_number, title, description, published")
      .order("module_number", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      return false;
    }

    setModules((data ?? []) as CourseModule[]);
    return true;
  }

  useEffect(() => {
    let active = true;

    async function initialise() {
      try {
        const supabase = createClient();
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError || !authData.user) {
          router.replace("/");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", authData.user.id)
          .single();

        if (profileError || profile?.role !== "admin") {
          router.replace("/");
          return;
        }

        const { data, error: modulesError } = await supabase
          .from("modules")
          .select("id, module_number, title, description, published")
          .order("module_number", { ascending: true });

        if (!active) return;

        if (modulesError) {
          setError(modulesError.message);
        } else {
          setModules((data ?? []) as CourseModule[]);
        }
      } catch {
        if (active) {
          setError("Unable to load modules. Please refresh the page.");
        }
      } finally {
        if (active) setChecking(false);
      }
    }

    void initialise();

    return () => {
      active = false;
    };
  }, [router]);

  function clearForm() {
    setFormOpen(false);
    setEditing(null);
    setTitle("");
    setDescription("");
    setModuleNumber("");
    setError("");
    setMessage("");
  }

  function startNewModule() {
    setError("");
    setMessage("");

    const availableNumber = getFirstAvailableNumber();

    if (availableNumber === null) {
      setError("All nine module numbers are already in use.");
      return;
    }

    setEditing(null);
    setModuleNumber(String(availableNumber));
    setTitle("");
    setDescription("");
    setFormOpen(true);
  }

  function startEditing(item: CourseModule) {
    setEditing(item);
    setModuleNumber(String(item.module_number));
    setTitle(item.title);
    setDescription(item.description ?? "");
    setMessage("");
    setError("");
    setFormOpen(true);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const number = Number(moduleNumber);
      const cleanTitle = title.trim();

      if (!Number.isInteger(number) || number < 1 || number > MAX_MODULES) {
        setError("Choose a module number from 1 to 9.");
        return;
      }

      if (!cleanTitle) {
        setError("Please enter a module title.");
        return;
      }

      // Refresh from the database before checking a new module number.
      const supabase = createClient();

      const { data: latestModules, error: fetchError } = await supabase
        .from("modules")
        .select("id, module_number, title, description, published");

      if (fetchError) {
        setError(`Could not verify module numbers: ${fetchError.message}`);
        return;
      }

      const currentModules = (latestModules ?? []) as CourseModule[];
      setModules(currentModules);

      const duplicate = currentModules.some(
        (item) =>
          item.module_number === number &&
          item.id !== editing?.id
      );

      if (duplicate) {
        setError(
          `Module ${number} already exists. Choose an unused module number.`
        );
        return;
      }

      if (!editing && currentModules.length >= MAX_MODULES) {
        setError("You already have nine modules.");
        return;
      }

      const values = {
        module_number: number,
        title: cleanTitle,
        description: description.trim() || null,
      };

      const result = editing
        ? await supabase
            .from("modules")
            .update(values)
            .eq("id", editing.id)
        : await supabase.from("modules").insert(values);

      if (result.error) {
        if (
          result.error.code === "23505" ||
          result.error.message.includes("modules_module_number_key")
        ) {
          setError(
            `Module ${number} is already in use. Refresh the page and select another number.`
          );
        } else {
          setError(result.error.message);
        }
        return;
      }

      const refreshed = await loadModules();

      if (!refreshed) {
        setMessage(
          "The module was saved, but the list could not refresh. Reload the page."
        );
        return;
      }

      setMessage(
        editing
          ? "Module updated successfully."
          : "Module created successfully."
      );

      setFormOpen(false);
      setEditing(null);
      setTitle("");
      setDescription("");
      setModuleNumber("");
    } catch {
      setError("Something went wrong while saving. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function togglePublished(item: CourseModule) {
    if (updatingId) return;

    setUpdatingId(item.id);
    setMessage("");
    setError("");

    try {
      const supabase = createClient();

      const { error: updateError } = await supabase
        .from("modules")
        .update({ published: !item.published })
        .eq("id", item.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setModules((current) =>
        current.map((module) =>
          module.id === item.id
            ? { ...module, published: !item.published }
            : module
        )
      );

      setMessage(item.published ? "Module unpublished." : "Module published.");
    } catch {
      setError("Unable to update this module. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoaderCircle className="animate-spin" size={24} />
        <span className="ml-3">Checking administrator access...</span>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-900 text-white">
              <BookOpen size={23} />
            </div>
            <div>
              <h1 className="font-bold text-blue-950">Course Modules</h1>
              <p className="text-xs text-slate-500">Digital Income Academy</p>
            </div>
          </div>

          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-100"
          >
            <ArrowLeft size={16} />
            Dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-3xl font-bold">Manage your modules</h2>
            <p className="mt-2 text-slate-600">
              Create and organise the nine modules in your course.
            </p>
          </div>

          <button
            type="button"
            onClick={startNewModule}
            disabled={modules.length >= MAX_MODULES}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-900 px-4 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={18} />
            Add module
          </button>
        </div>

        {message && (
          <div role="status" className="mb-5 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <CheckCircle2 size={19} />
            {message}
          </div>
        )}

        {error && (
          <div role="alert" className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Total modules</p>
            <p className="mt-2 text-3xl font-bold">{modules.length} / 9</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Published</p>
            <p className="mt-2 text-3xl font-bold">
              {modules.filter((item) => item.published).length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Drafts</p>
            <p className="mt-2 text-3xl font-bold">
              {modules.filter((item) => !item.published).length}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {modules.map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 font-bold text-blue-900">
                    {item.module_number}
                  </div>
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold">{item.title}</h3>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.published ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                        {item.published ? "Published" : "Draft"}
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-slate-600">
                      {item.description || "No description added."}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => startEditing(item)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                  >
                    <Pencil size={16} />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePublished(item)}
                    disabled={updatingId !== null}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-60 ${item.published ? "border border-amber-300 text-amber-800 hover:bg-amber-50" : "bg-blue-900 text-white hover:bg-blue-800"}`}
                  >
                    {updatingId === item.id ? (
                      <LoaderCircle className="animate-spin" size={16} />
                    ) : item.published ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                    {updatingId === item.id ? "Updating..." : item.published ? "Unpublish" : "Publish"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {modules.length >= MAX_MODULES && (
          <p className="mt-5 text-sm text-slate-500">
            You have reached the limit of nine modules.
          </p>
        )}

        {formOpen && (
          <div className="mt-10 rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h3 className="text-xl font-bold">{editing ? "Edit module" : "Add a new module"}</h3>
              <button
                type="button"
                onClick={clearForm}
                aria-label="Close module form"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label htmlFor="moduleNumber" className="mb-2 block text-sm font-semibold">
                  Module number
                </label>
                <select
                  id="moduleNumber"
                  value={moduleNumber}
                  onChange={(event) => setModuleNumber(event.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                >
                  {Array.from({ length: MAX_MODULES }, (_, index) => index + 1).map((number) => {
                    const alreadyUsed = usedNumbers.has(number);
                    const allowedForEditing = editing?.module_number === number;

                    return (
                      <option
                        key={number}
                        value={number}
                        disabled={alreadyUsed && !allowedForEditing}
                      >
                        Module {number}{alreadyUsed && !allowedForEditing ? " (already exists)" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label htmlFor="moduleTitle" className="mb-2 block text-sm font-semibold">
                  Module title
                </label>
                <input
                  id="moduleTitle"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                  maxLength={150}
                  placeholder="Enter the module title"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label htmlFor="moduleDescription" className="mb-2 block text-sm font-semibold">
                  Description
                </label>
                <textarea
                  id="moduleDescription"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  placeholder="Explain what students will learn in this module"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-900 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {loading ? <LoaderCircle className="animate-spin" size={18} /> : <Save size={18} />}
                  {loading ? "Saving..." : editing ? "Save changes" : "Create module"}
                </button>
                <button
                  type="button"
                  onClick={clearForm}
                  disabled={loading}
                  className="rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
