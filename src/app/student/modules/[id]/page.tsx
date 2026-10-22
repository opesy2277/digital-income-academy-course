
"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  Video,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type CourseModule = {
  id: string;
  module_number: number;
  title: string;
  description: string | null;
  published: boolean;
};

type Lesson = {
  id: string;
  module_id: string;
  title: string;
  content: string | null;
  media_url: string | null;
  lesson_number: number;
  published: boolean;
};

type ProgressRecord = {
  lesson_id: string;
  completed_at: string | null;
};

function StudentModuleContent() {
  const params = useParams<{ id: string }>();
  const moduleId = params.id;
  const router = useRouter();

  const [module, setModule] = useState<CourseModule | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [completed, setCompleted] = useState<
    Record<string, string | null>
  >({});
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState("");
  const [videoRetry, setVideoRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const completedCount = lessons.filter(
    (lesson) => completed[lesson.id] != null
  ).length;

  const progressPercentage =
    lessons.length > 0
      ? Math.round((completedCount / lessons.length) * 100)
      : 0;

  const loadModule = useCallback(async () => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        throw new Error("We couldn't verify your account.");
      }

      if (profile.role === "admin") {
        router.replace("/admin");
        return;
      }

      if (profile.role !== "student") {
        throw new Error("Your account role could not be verified.");
      }

      const { data: moduleData, error: moduleError } = await supabase
        .from("modules")
        .select("id, module_number, title, description, published")
        .eq("id", moduleId)
        .eq("published", true)
        .maybeSingle();

      if (moduleError) {
        throw new Error(moduleError.message);
      }

      if (!moduleData) {
        setModule(null);
        throw new Error(
          "This module is unavailable or has not been published."
        );
      }

      const { data: lessonData, error: lessonError } = await supabase
        .from("lessons")
        .select(
          "id, module_id, title, content, media_url, lesson_number, published"
        )
        .eq("module_id", moduleId)
        .eq("published", true)
        .order("lesson_number", { ascending: true });

      if (lessonError) {
        throw new Error(lessonError.message);
      }

      const visibleLessons = (lessonData ?? []) as Lesson[];

      setModule(moduleData as CourseModule);
      setLessons(visibleLessons);

      const lessonIds = visibleLessons.map((lesson) => lesson.id);
      let progressData: ProgressRecord[] = [];

      if (lessonIds.length > 0) {
        const { data, error: progressError } = await supabase
          .from("lesson_progress")
          .select("lesson_id, completed_at")
          .eq("user_id", user.id)
          .in("lesson_id", lessonIds);

        if (progressError) {
          throw new Error(
            `Lessons loaded, but progress could not be loaded: ${progressError.message}`
          );
        }

        progressData = (data ?? []) as ProgressRecord[];
      }

      const progressMap: Record<string, string | null> = {};

      for (const record of progressData) {
        progressMap[record.lesson_id] = record.completed_at;
      }

      setCompleted(progressMap);

      setActiveLessonId((current) =>
        current && visibleLessons.some((lesson) => lesson.id === current)
          ? current
          : visibleLessons[0]?.id ?? null
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load this module. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [moduleId, router]);

  useEffect(() => {
    void loadModule();
  }, [loadModule]);

  const activeLesson =
    lessons.find((lesson) => lesson.id === activeLessonId) ?? null;

  useEffect(() => {
    let cancelled = false;

    async function prepareVideo() {
      setVideoUrl("");
      setVideoError("");
      setVideoLoading(false);

      if (!activeLesson?.media_url?.trim()) {
        return;
      }

      const path = activeLesson.media_url.trim();

      // External video URLs do not require a Supabase signed URL.
      if (/^https?:\/\//i.test(path)) {
        setVideoUrl(path);
        return;
      }

      setVideoLoading(true);

      try {
        const supabase = createClient();

        // Storage paths must be relative to the bucket.
        // Example:
        // folder-name/video-file.mp4
        const objectPath = path
          .replace(/^\/+/, "")
          .replace(/^course-videos\//, "");

        console.log("Video request details", {
          bucket: "course-videos",
          path: JSON.stringify(objectPath),
          project: process.env.NEXT_PUBLIC_SUPABASE_URL,
          lessonId: activeLesson.id,
        });

        const { data, error: signedUrlError } = await supabase.storage
          .from("course-videos")
          .createSignedUrl(objectPath, 3600);

        if (cancelled) return;

        if (signedUrlError) {
          console.error("Could not create course video URL:", {
            message: signedUrlError.message,
            name: signedUrlError.name,
            status: signedUrlError.status,
            bucket: "course-videos",
            objectPath,
          });

          setVideoError(
            `Could not open this video: ${signedUrlError.message}`
          );
          return;
        }

        if (!data?.signedUrl) {
          setVideoError("Storage did not return a video URL.");
          return;
        }

        setVideoUrl(data.signedUrl);
      } catch (err) {
        if (!cancelled) {
          setVideoError(
            err instanceof Error
              ? `Could not open this video: ${err.message}`
              : "Could not open this video. Please try again."
          );
        }
      } finally {
        if (!cancelled) {
          setVideoLoading(false);
        }
      }
    }

    void prepareVideo();

    return () => {
      cancelled = true;
    };
  }, [activeLesson, videoRetry]);

  async function markCompleted(lesson: Lesson) {
    if (savingId) return;

    if (completed[lesson.id] != null) {
      setMessage("This lesson is already marked as completed.");
      return;
    }

    setSavingId(lesson.id);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError || profile?.role !== "student") {
        throw new Error(
          "Only a signed-in student can record lesson progress."
        );
      }

      const { data: existing, error: existingError } = await supabase
        .from("lesson_progress")
        .select("id, completed_at")
        .eq("user_id", user.id)
        .eq("lesson_id", lesson.id)
        .limit(1);

      if (existingError) {
        throw new Error(existingError.message);
      }

      const timestamp = new Date().toISOString();

      if (existing && existing.length > 0) {
        const record = existing[0];

        if (!record.completed_at) {
          const { error: updateError } = await supabase
            .from("lesson_progress")
            .update({ completed_at: timestamp })
            .eq("id", record.id)
            .eq("user_id", user.id);

          if (updateError) {
            throw new Error(updateError.message);
          }
        }
      } else {
        const { error: insertError } = await supabase
          .from("lesson_progress")
          .insert({
            user_id: user.id,
            lesson_id: lesson.id,
            completed_at: timestamp,
          });

        if (insertError) {
          throw new Error(insertError.message);
        }
      }

      setCompleted((current) => ({
        ...current,
        [lesson.id]: timestamp,
      }));

      setMessage("Lesson completed! Your progress has been saved.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't save your progress. Please try again."
      );
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <LoaderCircle className="animate-spin text-blue-800" size={26} />
        <span className="ml-3 text-slate-700">
          Loading your module...
        </span>
      </main>
    );
  }

  if (!module) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8">
          <ShieldAlert className="mb-4 text-amber-600" size={30} />
          <h1 className="text-xl font-bold">Module unavailable</h1>
          <p className="mt-2 break-words text-sm text-slate-600">
            {error || "This module is unavailable."}
          </p>
          <Link
            href="/student"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-800 px-4 py-3 font-semibold text-white"
          >
            <ArrowLeft size={17} />
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link
            href="/student"
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-800 hover:text-blue-950"
          >
            <ArrowLeft size={18} />
            Student dashboard
          </Link>

          <button
            type="button"
            onClick={() => void loadModule()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-100"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <section className="rounded-2xl bg-gradient-to-r from-blue-950 to-blue-700 p-6 text-white sm:p-8">
          <p className="text-sm text-blue-100">
            Module {module.module_number}
          </p>
          <h1 className="mt-2 text-3xl font-bold">{module.title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-100">
            {module.description ||
              "Work through each published lesson at your own pace."}
          </p>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span>Module progress</span>
              <strong>{progressPercentage}%</strong>
            </div>
            <div
              className="h-3 overflow-hidden rounded-full bg-blue-950/50"
              role="progressbar"
              aria-label="Module completion"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPercentage}
            >
              <div
                className="h-full rounded-full bg-white transition-all"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-blue-100">
              {completedCount} of {lessons.length} lessons completed
            </p>
          </div>
        </section>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
          >
            {message}
          </div>
        )}

        {lessons.length === 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <BookOpen className="mx-auto mb-3 text-slate-400" size={38} />
            <h2 className="font-bold">No published lessons yet</h2>
            <p className="mt-2 text-sm text-slate-600">
              Lessons will appear here after an administrator publishes them.
            </p>
          </section>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
            <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
              {activeLesson ? (
                <>
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800">
                      Lesson {activeLesson.lesson_number}
                    </span>

                    {completed[activeLesson.id] != null && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800">
                        <CheckCircle2 size={14} />
                        Completed
                      </span>
                    )}
                  </div>

                  <h2 className="text-2xl font-bold">
                    {activeLesson.title}
                  </h2>

                  {activeLesson.media_url && (
                    <div className="mt-6 overflow-hidden rounded-xl bg-slate-950">
                      {videoError ? (
                        <div className="space-y-3 p-5 text-sm text-white">
                          <p className="font-semibold">Video unavailable</p>
                          <p className="break-words text-red-200">
                            {videoError}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setVideoError("");
                              setVideoUrl("");
                              setVideoRetry((count) => count + 1);
                            }}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 font-semibold text-slate-900 hover:bg-slate-100"
                          >
                            <RefreshCw size={16} />
                            Try again
                          </button>
                        </div>
                      ) : videoUrl ? (
                        <video
                          key={videoUrl}
                          controls
                          playsInline
                          preload="metadata"
                          className="max-h-[520px] w-full"
                          src={videoUrl}
                          onError={() =>
                            setVideoError(
                              "The URL was created, but your browser could not play the file. Check the file format and Storage URL."
                            )
                          }
                        >
                          Your browser does not support video playback.
                        </video>
                      ) : (
                        <div className="flex min-h-40 items-center justify-center gap-2 p-6 text-sm text-white">
                          {videoLoading ? (
                            <>
                              <LoaderCircle
                                className="animate-spin"
                                size={20}
                              />
                              Preparing lesson video...
                            </>
                          ) : (
                            "No video is available for this lesson."
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-6 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
                    {activeLesson.content ||
                      "No written notes have been added to this lesson."}
                  </div>

                  <div className="mt-8 border-t border-slate-200 pt-5">
                    <button
                      type="button"
                      onClick={() => void markCompleted(activeLesson)}
                      disabled={
                        savingId !== null ||
                        completed[activeLesson.id] != null
                      }
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-800 px-5 py-3 font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      {savingId === activeLesson.id ? (
                        <LoaderCircle className="animate-spin" size={18} />
                      ) : (
                        <CheckCircle2 size={18} />
                      )}
                      {savingId === activeLesson.id
                        ? "Saving progress..."
                        : completed[activeLesson.id] != null
                          ? "Lesson completed"
                          : "Mark as completed"}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-600">
                  Select a lesson to begin.
                </p>
              )}
            </section>

            <aside className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <BookOpen className="text-blue-800" size={21} />
                <h2 className="text-lg font-bold">Module lessons</h2>
              </div>

              <p className="mb-4 text-sm text-slate-500">
                Select a lesson to study or review your completion status.
              </p>

              <div className="space-y-2">
                {lessons.map((lesson) => {
                  const isCompleted = completed[lesson.id] != null;
                  const isActive = lesson.id === activeLessonId;

                  return (
                    <button
                      key={lesson.id}
                      type="button"
                      onClick={() => {
                        setActiveLessonId(lesson.id);
                        setMessage("");
                        setVideoError("");
                      }}
                      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                        isActive
                          ? "border-blue-300 bg-blue-50"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className="mt-0.5 shrink-0">
                        {isCompleted ? (
                          <CheckCircle2
                            size={19}
                            className="text-green-600"
                          />
                        ) : (
                          <Circle size={19} className="text-slate-400" />
                        )}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-slate-500">
                          Lesson {lesson.lesson_number}
                        </span>
                        <span className="mt-1 block break-words text-sm font-semibold text-slate-900">
                          {lesson.title}
                        </span>

                        {lesson.media_url && (
                          <span className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500">
                            <Video size={13} />
                            Video
                          </span>
                        )}

                        {isCompleted && completed[lesson.id] && (
                          <span className="mt-2 inline-flex items-center gap-1 text-xs text-green-700">
                            <Clock size={12} />
                            Completed{" "}
                            {new Date(
                              completed[lesson.id]!
                            ).toLocaleDateString()}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              {progressPercentage === 100 && lessons.length > 0 && (
                <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                  <CheckCircle2 className="mb-2" size={22} />
                  <p className="font-bold">Module completed!</p>
                  <p className="mt-1">
                    You&apos;ve marked every published lesson in this module
                    as complete.
                  </p>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

export default function StudentModulePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center p-6">
          <LoaderCircle className="animate-spin text-blue-800" size={24} />
          <p className="ml-3 text-sm text-slate-600">
            Loading module...
          </p>
        </main>
      }
    >
      <StudentModuleContent />
    </Suspense>
  );
}
