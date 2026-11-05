
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
  ClipboardList,
  Trophy,
  RotateCcw,
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

type VideoType = "drive" | "direct" | "storage" | "none";

type QuizSummary = {
  id: string;
  module_id: string;
  title: string;
  is_final_exam: boolean;
  published: boolean;
};

type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  question_number: number;
};

type QuizData = {
  quiz: QuizSummary;
  questions: QuizQuestion[];
};

type QuizAttempt = {
  id: string;
  quiz_id: string;
  score: number;
  total_questions: number;
  submitted_at: string;
  answers: {
    question_number: number;
    selected_option: number;
  }[];
};

function getGoogleDrivePreviewUrl(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);

    if (
      url.hostname !== "drive.google.com" &&
      url.hostname !== "www.drive.google.com" &&
      url.hostname !== "docs.google.com"
    ) {
      return null;
    }

    const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
    const fileId = fileMatch?.[1] || url.searchParams.get("id");

    if (!fileId) return null;

    return `https://drive.google.com/file/d/${encodeURIComponent(
      fileId
    )}/preview`;
  } catch {
    return null;
  }
}

function getVideoType(value: string | null): VideoType {
  if (!value?.trim()) return "none";

  const trimmed = value.trim();

  if (getGoogleDrivePreviewUrl(trimmed)) return "drive";

  if (/^https?:\/\//i.test(trimmed)) return "direct";

  return "storage";
}

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
  const [videoType, setVideoType] = useState<VideoType>("none");
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState("");
  const [videoRetry, setVideoRetry] = useState(0);

  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<QuizData | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState("");
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [quizResult, setQuizResult] = useState<{
    score: number;
    total_questions: number;
    percentage: number;
  } | null>(null);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);

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

      // Load published module quizzes. The final exam is handled separately.
      const { data: quizData, error: quizLoadError } = await supabase
        .from("quizzes")
        .select("id, module_id, title, is_final_exam, published")
        .eq("module_id", moduleId)
        .eq("published", true)
        .eq("is_final_exam", false)
        .order("title", { ascending: true });

      if (quizLoadError) {
        throw new Error(
          `Lessons loaded, but quizzes could not be loaded: ${quizLoadError.message}`
        );
      }

      setQuizzes((quizData ?? []) as QuizSummary[]);
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
      setVideoType(getVideoType(activeLesson?.media_url ?? null));

      if (!activeLesson?.media_url?.trim()) {
        setVideoType("none");
        return;
      }

      const path = activeLesson.media_url.trim();
      const drivePreviewUrl = getGoogleDrivePreviewUrl(path);

      if (drivePreviewUrl) {
        setVideoType("drive");
        setVideoUrl(drivePreviewUrl);
        return;
      }

      if (/^https?:\/\//i.test(path)) {
        setVideoType("direct");
        setVideoUrl(path);
        return;
      }

      setVideoType("storage");
      setVideoLoading(true);

      try {
        const supabase = createClient();

        const objectPath = path
          .replace(/^\/+/, "")
          .replace(/^course-videos\//, "");

        const { data, error: signedUrlError } = await supabase.storage
          .from("course-videos")
          .createSignedUrl(objectPath, 3600);

        if (cancelled) return;

        if (signedUrlError) {
          console.error("Could not create course video URL:", {
            message: signedUrlError.message,
            bucket: "course-videos",
            objectPath,
            lessonId: activeLesson.id,
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

  async function loadQuiz(quiz: QuizSummary) {
    setQuizLoading(true);
    setQuizError("");
    setQuizResult(null);
    setQuizAnswers({});
    setActiveQuiz(null);
    setAttempts([]);

    try {
      const response = await fetch(
        `/api/student/quizzes/${encodeURIComponent(quiz.id)}`,
        { method: "GET", cache: "no-store" }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load this quiz.");
      }

      setActiveQuiz(result as QuizData);

      // Load only this student's own attempts. RLS must restrict this query.
      setAttemptsLoading(true);

      const supabase = createClient();
      const { data: attemptData, error: attemptError } = await supabase
        .from("quiz_attempts")
        .select("id, quiz_id, score, total_questions, submitted_at, answers")
        .eq("quiz_id", quiz.id)
        .order("submitted_at", { ascending: false });

      if (attemptError) {
        throw new Error(
          `Quiz loaded, but attempt history could not be loaded: ${attemptError.message}`
        );
      }

      setAttempts((attemptData ?? []) as QuizAttempt[]);
    } catch (err) {
      setQuizError(
        err instanceof Error
          ? err.message
          : "Unable to load this quiz. Please try again."
      );
    } finally {
      setQuizLoading(false);
      setAttemptsLoading(false);
    }
  }

  async function submitQuiz() {
    if (!activeQuiz || submittingQuiz) return;

    const questions = activeQuiz.questions ?? [];

    if (questions.length === 0) {
      setQuizError("This quiz does not contain any questions yet.");
      return;
    }

    if (Object.keys(quizAnswers).length !== questions.length) {
      setQuizError("Please answer every question before submitting.");
      return;
    }

    setSubmittingQuiz(true);
    setQuizError("");

    try {
      const answers = questions.map((question) => ({
        question_number: question.question_number,
        selected_option: quizAnswers[question.question_number],
      }));

      const response = await fetch("/api/student/quizzes/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: activeQuiz.quiz.id,
          answers,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Your quiz could not be submitted.");
      }

      setQuizResult({
        score: result.attempt.score,
        total_questions: result.attempt.total_questions,
        percentage: result.percentage,
      });

      setAttempts((current) => [
        result.attempt as QuizAttempt,
        ...current,
      ]);
    } catch (err) {
      setQuizError(
        err instanceof Error
          ? err.message
          : "Your quiz could not be submitted. Please try again."
      );
    } finally {
      setSubmittingQuiz(false);
    }
  }

  function closeQuiz() {
    setActiveQuiz(null);
    setQuizAnswers({});
    setQuizResult(null);
    setQuizError("");
    setAttempts([]);
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
                      ) : videoLoading ? (
                        <div className="flex min-h-40 items-center justify-center gap-2 p-6 text-sm text-white">
                          <LoaderCircle
                            className="animate-spin"
                            size={20}
                          />
                          Preparing lesson video...
                        </div>
                      ) : videoUrl && videoType === "drive" ? (
                        <iframe
                          key={videoUrl}
                          src={videoUrl}
                          title={`Video for ${activeLesson.title}`}
                          className="aspect-video w-full"
                          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                          allowFullScreen
                          referrerPolicy="strict-origin-when-cross-origin"
                        />
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
                              "The video URL was opened, but your browser could not play the file. Check that the link is accessible and the file format is supported."
                            )
                          }
                        >
                          Your browser does not support video playback.
                        </video>
                      ) : (
                        <div className="flex min-h-40 items-center justify-center p-6 text-sm text-white">
                          No video is available for this lesson.
                        </div>
                      )}
                    </div>
                  )}

                  {videoType === "drive" && videoUrl && (
                    <p className="mt-2 text-xs text-slate-500">
                      Video hosted on Google Drive. If it does not play, check
                      that its sharing permission allows viewers with the link.
                    </p>
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

        {/* Module quizzes */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-800">
              <ClipboardList size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Module quizzes</h2>
              <p className="mt-1 text-sm text-slate-500">
                Test what you have learned in this module.
              </p>
            </div>
          </div>

          {quizzes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
              <ClipboardList
                className="mx-auto mb-3 text-slate-400"
                size={30}
              />
              <p className="font-semibold text-slate-700">
                No published quizzes yet
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Published module quizzes will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {quizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex items-start gap-3">
                    <ClipboardList
                      className="mt-1 shrink-0 text-blue-800"
                      size={20}
                    />
                    <div>
                      <h3 className="font-semibold">{quiz.title}</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Module {module.module_number} quiz
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void loadQuiz(quiz)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-900"
                  >
                    <BookOpen size={16} />
                    Open quiz
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Quiz workspace */}
        {(quizLoading || activeQuiz || quizError) && (
          <section
            id="quiz-workspace"
            className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
          >
            {quizLoading ? (
              <div className="flex items-center justify-center gap-3 py-10 text-slate-600">
                <LoaderCircle
                  className="animate-spin text-blue-800"
                  size={24}
                />
                Loading quiz...
              </div>
            ) : (
              <>
                <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-blue-800">
                      Quiz workspace
                    </p>
                    <h2 className="mt-1 text-2xl font-bold">
                      {activeQuiz?.quiz.title || "Quiz"}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={closeQuiz}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                  >
                    Close quiz
                  </button>
                </div>

                {quizError && (
                  <div
                    role="alert"
                    className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
                  >
                    {quizError}
                  </div>
                )}

                {quizResult ? (
                  <div className="rounded-2xl border border-green-200 bg-green-50 p-6">
                    <Trophy className="mb-3 text-green-700" size={34} />
                    <h3 className="text-xl font-bold text-green-900">
                      Quiz submitted!
                    </h3>
                    <p className="mt-2 text-3xl font-bold text-green-800">
                      {quizResult.percentage}%
                    </p>
                    <p className="mt-1 text-sm text-green-800">
                      You scored {quizResult.score} out of{" "}
                      {quizResult.total_questions} questions.
                    </p>
                    <p className="mt-3 text-sm text-green-800">
                      Your result has been saved to your quiz attempts.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setQuizResult(null);
                        setQuizAnswers({});
                        setQuizError("");
                      }}
                      className="mt-5 inline-flex items-center gap-2 rounded-lg bg-green-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-900"
                    >
                      <RotateCcw size={16} />
                      Take quiz again
                    </button>
                  </div>
                ) : activeQuiz ? (
                  <>
                    <div className="mb-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-900">
                      Answer every question, then submit your quiz. Your score
                      is calculated securely when you submit.
                    </div>

                    {activeQuiz.questions.length === 0 ? (
                      <p className="rounded-xl border border-slate-200 p-5 text-sm text-slate-600">
                        This quiz does not contain any questions yet.
                      </p>
                    ) : (
                      <div className="space-y-6">
                        {activeQuiz.questions.map((question, index) => (
                          <fieldset
                            key={question.id}
                            className="rounded-xl border border-slate-200 p-4 sm:p-5"
                          >
                            <legend className="px-2 text-sm font-bold text-slate-900">
                              Question {index + 1} of{" "}
                              {activeQuiz.questions.length}
                            </legend>

                            <p className="mb-4 font-semibold leading-7 text-slate-800">
                              {question.question}
                            </p>

                            <div className="space-y-2">
                              {question.options.map((option, optionIndex) => {
                                const selected =
                                  quizAnswers[question.question_number] ===
                                  optionIndex;

                                return (
                                  <label
                                    key={`${question.id}-${optionIndex}`}
                                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                                      selected
                                        ? "border-blue-400 bg-blue-50"
                                        : "border-slate-200 hover:bg-slate-50"
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name={`question-${question.question_number}`}
                                      value={optionIndex}
                                      checked={selected}
                                      disabled={submittingQuiz}
                                      onChange={() =>
                                        setQuizAnswers((current) => ({
                                          ...current,
                                          [question.question_number]:
                                            optionIndex,
                                        }))
                                      }
                                      className="mt-1 h-4 w-4 accent-blue-800"
                                    />
                                    <span className="text-sm leading-6 text-slate-700">
                                      {option}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </fieldset>
                        ))}

                        <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm text-slate-500">
                            {Object.keys(quizAnswers).length} of{" "}
                            {activeQuiz.questions.length} answered
                          </p>

                          <button
                            type="button"
                            onClick={() => void submitQuiz()}
                            disabled={submittingQuiz}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-800 px-6 py-3 font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {submittingQuiz ? (
                              <LoaderCircle
                                className="animate-spin"
                                size={18}
                              />
                            ) : (
                              <CheckCircle2 size={18} />
                            )}
                            {submittingQuiz
                              ? "Submitting..."
                              : "Submit quiz"}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : null}

                {/* Previous attempts */}
                {activeQuiz && (
                  <div className="mt-8 border-t border-slate-200 pt-6">
                    <h3 className="mb-4 text-lg font-bold">
                      Previous attempts
                    </h3>

                    {attemptsLoading ? (
                      <p className="text-sm text-slate-500">
                        Loading your attempts...
                      </p>
                    ) : attempts.length === 0 ? (
                      <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                        You have not submitted this quiz before.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {attempts.map((attempt, index) => {
                          const percentage =
                            attempt.total_questions > 0
                              ? Math.round(
                                  (attempt.score /
                                    attempt.total_questions) *
                                    100
                                )
                              : 0;

                          return (
                            <div
                              key={attempt.id}
                              className="rounded-xl border border-slate-200 p-4"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="font-semibold">
                                    Attempt {attempts.length - index}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {new Date(
                                      attempt.submitted_at
                                    ).toLocaleString()}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xl font-bold text-blue-800">
                                    {percentage}%
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {attempt.score} /{" "}
                                    {attempt.total_questions}
                                  </p>
                                </div>
                              </div>

                              {attempt.answers?.length > 0 && (
                                <details className="mt-4 border-t border-slate-100 pt-3">
                                  <summary className="cursor-pointer text-sm font-semibold text-blue-800">
                                    Review submitted answers
                                  </summary>
                                  <div className="mt-3 space-y-3">
                                    {attempt.answers.map((answer) => {
                                      const question =
                                        activeQuiz.questions.find(
                                          (item) =>
                                            item.question_number ===
                                            answer.question_number
                                        );

                                      const selectedText =
                                        question?.options[
                                          answer.selected_option
                                        ];

                                      return (
                                        <div
                                          key={`${attempt.id}-${answer.question_number}`}
                                          className="rounded-lg bg-slate-50 p-3"
                                        >
                                          <p className="text-xs font-semibold text-slate-500">
                                            Question {answer.question_number}
                                          </p>
                                          <p className="mt-1 text-sm font-medium text-slate-800">
                                            {question?.question ||
                                              "Question is no longer available."}
                                          </p>
                                          <p className="mt-2 text-sm text-slate-700">
                                            Your answer:{" "}
                                            <strong>
                                              {selectedText ??
                                                "Answer unavailable"}
                                            </strong>
                                          </p>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </details>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
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
