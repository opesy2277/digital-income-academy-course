
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  BookOpen,
  CheckCircle,
  CirclePlus,
  Edit,
  ExternalLink,
  LoaderCircle,
  Save,
  Video,
  X,
} from "lucide-react";

type ModuleItem = {
  id: string;
  module_number: number;
  title: string;
  published: boolean;
};

type LessonItem = {
  id: string;
  module_id: string;
  title: string;
  content: string | null;
  media_url: string | null;
  lesson_number: number;
  published: boolean;
};

type LessonForm = {
  module_id: string;
  title: string;
  content: string;
  media_url: string;
  lesson_number: number;
  published: boolean;
};

const emptyForm: LessonForm = {
  module_id: "",
  title: "",
  content: "",
  media_url: "",
  lesson_number: 1,
  published: false,
};

function normalizeGoogleDriveLink(value: string): string {
  const input = value.trim();

  if (!input) return "";

  let url: URL;

  try {
    url = new URL(input);
  } catch {
    throw new Error("Please enter a valid Google Drive sharing link.");
  }

  if (url.protocol !== "https:") {
    throw new Error("Please use an HTTPS Google Drive link.");
  }

  const hostname = url.hostname.toLowerCase();

  if (
    hostname !== "drive.google.com" &&
    hostname !== "docs.google.com"
  ) {
    throw new Error(
      "Please paste a Google Drive video link. Other video URLs are not supported by this form."
    );
  }

  const filePathMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
  const pathId = filePathMatch?.[1];
  const queryId = url.searchParams.get("id");
  const fileId = pathId || queryId;

  if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    throw new Error(
      "We could not find a video file ID in that link. In Google Drive, open the video, select Share, and copy its link."
    );
  }

  return `https://drive.google.com/file/d/${fileId}/preview`;
}

function isGoogleDriveLink(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.hostname.toLowerCase() === "drive.google.com" ||
      url.hostname.toLowerCase() === "docs.google.com"
    );
  } catch {
    return false;
  }
}

export default function AdminLessonsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [form, setForm] = useState<LessonForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const checkAdmin = useCallback(async () => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      throw new Error(`Could not verify your session: ${authError.message}`);
    }

    if (!user) {
      throw new Error("Your session has expired. Please sign in again.");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      throw new Error("This account is not recognized as an administrator.");
    }

    return user;
  }, [supabase]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      await checkAdmin();

      const [moduleResult, lessonResult] = await Promise.all([
        supabase
          .from("modules")
          .select("id, module_number, title, published")
          .order("module_number", { ascending: true }),

        supabase
          .from("lessons")
          .select(
            "id, module_id, title, content, media_url, lesson_number, published"
          )
          .order("lesson_number", { ascending: true }),
      ]);

      if (moduleResult.error) {
        throw new Error(
          `Could not load modules: ${moduleResult.error.message}`
        );
      }

      if (lessonResult.error) {
        throw new Error(
          `Could not load lessons: ${lessonResult.error.message}`
        );
      }

      setModules(moduleResult.data ?? []);
      setLessons(lessonResult.data ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load lesson management."
      );
    } finally {
      setLoading(false);
    }
  }, [checkAdmin, supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function openNewLesson() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      module_id: modules[0]?.id ?? "",
    });
    setMessage("");
    setError("");
    setFormOpen(true);
  }

  function openEditLesson(lesson: LessonItem) {
    setEditingId(lesson.id);

    setForm({
      module_id: lesson.module_id,
      title: lesson.title,
      content: lesson.content ?? "",
      media_url: lesson.media_url ?? "",
      lesson_number: lesson.lesson_number,
      published: lesson.published,
    });

    setMessage("");
    setError("");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
    setError("");
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      if (!form.module_id) {
        throw new Error("Please select a module.");
      }

      if (!form.title.trim()) {
        throw new Error("Please enter a lesson title.");
      }

      if (
        !Number.isInteger(Number(form.lesson_number)) ||
        Number(form.lesson_number) < 1
      ) {
        throw new Error("Lesson number must be a whole number greater than 0.");
      }

      await checkAdmin();

      const enteredMediaUrl = form.media_url.trim();
      let mediaUrl: string | null = enteredMediaUrl || null;

      if (enteredMediaUrl && isGoogleDriveLink(enteredMediaUrl)) {
        mediaUrl = normalizeGoogleDriveLink(enteredMediaUrl);
      } else if (
        enteredMediaUrl &&
        /^https?:\/\//i.test(enteredMediaUrl)
      ) {
        throw new Error(
          "Please use a Google Drive video sharing link. Open the video in Google Drive, select Share, and copy the link."
        );
      }

      const lessonData = {
        module_id: form.module_id,
        title: form.title.trim(),
        content: form.content.trim() || null,
        media_url: mediaUrl,
        lesson_number: Number(form.lesson_number),
        published: form.published,
      };

      const result = editingId
        ? await supabase
            .from("lessons")
            .update(lessonData)
            .eq("id", editingId)
            .select("id")
            .maybeSingle()
        : await supabase
            .from("lessons")
            .insert(lessonData)
            .select("id")
            .single();

      if (result.error) {
        throw new Error(
          `The lesson could not be saved: ${result.error.message}`
        );
      }

      if (!result.data) {
        throw new Error(
          "No lesson was saved. Check your lesson permissions and try again."
        );
      }

      setMessage("Lesson saved successfully.");
      setFormOpen(false);
      setEditingId(null);

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(lesson: LessonItem) {
    if (publishingId) return;

    setError("");
    setMessage("");
    setPublishingId(lesson.id);

    try {
      await checkAdmin();

      const { data, error: updateError } = await supabase
        .from("lessons")
        .update({ published: !lesson.published })
        .eq("id", lesson.id)
        .select("id, published")
        .maybeSingle();

      if (updateError) {
        throw new Error(`Could not update lesson: ${updateError.message}`);
      }

      if (!data) {
        throw new Error(
          "No lesson was updated. Check the lesson UPDATE policy in Supabase."
        );
      }

      setLessons((current) =>
        current.map((item) =>
          item.id === data.id
            ? { ...item, published: data.published }
            : item
        )
      );

      setMessage(
        data.published ? "Lesson published." : "Lesson unpublished."
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update lesson."
      );
    } finally {
      setPublishingId(null);
    }
  }

  function moduleName(moduleId: string) {
    const module = modules.find((item) => item.id === moduleId);

    return module
      ? `Module ${module.module_number}: ${module.title}`
      : "Unknown module";
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <div className="flex items-center gap-3 py-12">
          <LoaderCircle className="animate-spin" />
          <p>Loading lesson management...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-blue-700">
            <BookOpen size={22} />
            <span className="text-sm font-semibold">Course management</span>
          </div>

          <h1 className="text-3xl font-bold text-slate-900">
            Lessons Management
          </h1>

          <p className="mt-2 text-slate-600">
            Create lessons, add Google Drive videos, and control publication.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewLesson}
          disabled={modules.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CirclePlus size={19} />
          Add lesson
        </button>
      </div>

      {modules.length === 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
          Create a course module before adding lessons.
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700"
        >
          {error}
        </div>
      )}

      {message && !formOpen && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
          {message}
        </div>
      )}

      {formOpen && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-slate-900">
              {editingId ? "Edit lesson" : "Create lesson"}
            </h2>

            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Close lesson form"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Course module
                </span>

                <select
                  value={form.module_id}
                  onChange={(event) =>
                    setForm({ ...form, module_id: event.target.value })
                  }
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white p-3"
                >
                  <option value="">Select a module</option>
                  {modules.map((module) => (
                    <option key={module.id} value={module.id}>
                      Module {module.module_number}: {module.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Lesson number
                </span>

                <input
                  type="number"
                  min={1}
                  step={1}
                  value={form.lesson_number}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      lesson_number: Number(event.target.value),
                    })
                  }
                  required
                  className="w-full rounded-lg border border-slate-300 p-3"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Lesson title
              </span>

              <input
                type="text"
                value={form.title}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
                placeholder="e.g. Introduction to Affiliate Marketing"
                required
                className="w-full rounded-lg border border-slate-300 p-3"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Lesson content
              </span>

              <textarea
                value={form.content}
                onChange={(event) =>
                  setForm({ ...form, content: event.target.value })
                }
                placeholder="Write the lesson notes or instructions here..."
                rows={6}
                className="w-full rounded-lg border border-slate-300 p-3"
              />
            </label>

            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Video className="text-blue-700" size={22} />
                <h3 className="font-bold text-slate-900">Google Drive video</h3>
              </div>

              <p className="mb-4 text-sm leading-6 text-slate-600">
                Upload your video to Google Drive first. Then copy its sharing
                link and paste it below. The portal saves an embedded preview
                link instead of uploading the video to Supabase.
              </p>

              <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-slate-600">
                <li>Open Google Drive and select your video.</li>
                <li>Choose Share, then copy the video link.</li>
                <li>Check that the intended viewers can open the video.</li>
                <li>Paste the link in the field below.</li>
              </ol>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Google Drive sharing link
                </span>

                <input
                  type="url"
                  value={form.media_url}
                  onChange={(event) =>
                    setForm({ ...form, media_url: event.target.value })
                  }
                  placeholder="https://drive.google.com/file/d/..."
                  className="w-full rounded-lg border border-slate-300 bg-white p-3"
                />
              </label>

              {form.media_url.trim() &&
                isGoogleDriveLink(form.media_url.trim()) && (
                  <div className="mt-3 flex items-start gap-2 text-sm text-green-800">
                    <CheckCircle size={18} className="mt-0.5 shrink-0" />
                    <span>
                      Google Drive link detected. Its preview URL will be
                      saved when you save this lesson.
                    </span>
                  </div>
                )}

              {form.media_url.trim() &&
                !isGoogleDriveLink(form.media_url.trim()) && (
                  <p className="mt-2 text-sm text-amber-800">
                    Paste a Google Drive sharing link to add or replace a
                    video. If this lesson has an older Supabase video path,
                    leave it unchanged to preserve the existing value.
                  </p>
                )}

              {form.media_url.trim() &&
                /^https?:\/\//i.test(form.media_url.trim()) &&
                !isGoogleDriveLink(form.media_url.trim()) && (
                  <a
                    href={form.media_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 underline"
                  >
                    Open current video link
                    <ExternalLink size={14} />
                  </a>
                )}

              <p className="mt-3 text-xs leading-5 text-slate-500">
                Important: anyone with access to an unlisted or publicly
                shared Drive link may be able to share it with others.
                Restricting access to this lesson page does not fully protect
                the original Drive video link.
              </p>
            </div>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(event) =>
                  setForm({ ...form, published: event.target.checked })
                }
                className="h-4 w-4"
              />

              <span className="text-sm font-semibold text-slate-700">
                Publish this lesson
              </span>
            </label>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            {message && <p className="text-sm text-blue-700">{message}</p>}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {saving ? (
                  <LoaderCircle size={18} className="animate-spin" />
                ) : (
                  <Save size={18} />
                )}
                {saving ? "Saving..." : "Save lesson"}
              </button>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">
            Existing lessons
          </h2>

          <span className="text-sm text-slate-500">
            {lessons.length} lesson{lessons.length === 1 ? "" : "s"}
          </span>
        </div>

        {lessons.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <BookOpen className="mx-auto mb-3 text-slate-400" size={36} />
            <p className="font-semibold text-slate-800">
              No lessons created yet
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Click Add lesson to create your first lesson.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {lessons.map((lesson) => (
              <article
                key={lesson.id}
                className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                      Lesson {lesson.lesson_number}
                    </span>

                    <span
                      className={`rounded px-2 py-1 text-xs font-semibold ${
                        lesson.published
                          ? "bg-green-100 text-green-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {lesson.published ? "Published" : "Draft"}
                    </span>

                    {lesson.media_url && (
                      <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800">
                        <Video size={13} />
                        Video attached
                      </span>
                    )}
                  </div>

                  <h3 className="break-words text-lg font-bold text-slate-900">
                    {lesson.title}
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {moduleName(lesson.module_id)}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void togglePublished(lesson)}
                    disabled={publishingId !== null || saving}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {publishingId === lesson.id && (
                      <LoaderCircle size={15} className="animate-spin" />
                    )}
                    {lesson.published ? "Unpublish" : "Publish"}
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditLesson(lesson)}
                    disabled={publishingId !== null || saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                  >
                    <Edit size={16} />
                    Edit
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
