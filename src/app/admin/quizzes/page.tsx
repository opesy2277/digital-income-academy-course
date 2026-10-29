
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Eye,
  EyeOff,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Module = {
  id: string;
  module_number: number;
  title: string;
};

type Quiz = {
  id: string;
  module_id: string | null;
  title: string;
  is_final_exam: boolean;
  published: boolean;
};

type Question = {
  id?: string;
  question: string;
  options: string[];
  correct_answer: string;
  question_number: number;
};

type QuizQuestionRow = {
  id: string;
  question: string;
  options: unknown;
  correct_answer: string | number;
  question_number: number;
};

type SupabaseErrorDetails = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
  name?: string;
  status?: number;
  statusCode?: number;
};

const emptyQuestion = (): Question => ({
  question: "",
  options: ["", "", "", ""],
  correct_answer: "0",
  question_number: 1,
});

function getErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    const details = error as Error & SupabaseErrorDetails;

    return [
      details.message || "An unknown error occurred.",
      details.code ? `Code: ${details.code}` : "",
      details.details ? `Details: ${details.details}` : "",
      details.hint ? `Hint: ${details.hint}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
  }

  if (typeof error === "object" && error !== null) {
    const details = error as SupabaseErrorDetails;

    return [
      details.message || "An unknown error occurred.",
      details.code ? `Code: ${details.code}` : "",
      details.details ? `Details: ${details.details}` : "",
      details.hint ? `Hint: ${details.hint}` : "",
      details.status ? `HTTP status: ${details.status}` : "",
      details.statusCode ? `Status code: ${details.statusCode}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
  }

  return "An unexpected error occurred.";
}

function logSupabaseError(label: string, error: unknown) {
  if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>;

    const details = {
      message: err.message,
      code: err.code,
      details: err.details,
      hint: err.hint,
      name: err.name,
      status: err.status,
      statusCode: err.statusCode,
      serialized: JSON.stringify(
        error,
        Object.getOwnPropertyNames(error)
      ),
    };

    console.error(label, details);
    return;
  }

  console.error(label, error);
}

export default function AdminQuizzesPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [modules, setModules] = useState<Module[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [title, setTitle] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [isFinalExam, setIsFinalExam] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<
    "error" | "success" | "info"
  >("info");

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verifyAdmin() {
    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError) {
      throw new Error(
        `Could not verify your login: ${authError.message}`
      );
    }

    if (!authData.user) {
      throw new Error(
        "Your session has expired. Please sign in again."
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError) {
      logSupabaseError("ADMIN PROFILE CHECK ERROR", profileError);
      throw new Error(
        `Could not verify your admin profile: ${getErrorMessage(profileError)}`
      );
    }

    console.info("QUIZ ADMIN CHECK", {
      userId: authData.user.id,
      email: authData.user.email,
      role: profile?.role ?? null,
    });

    if (profile?.role !== "admin") {
      throw new Error(
        `The signed-in account ${
          authData.user.email ?? ""
        } does not have the admin role. Sign in with an administrator account.`
      );
    }

    return authData.user;
  }

  async function initialize() {
    setLoading(true);
    setMessage("");

    try {
      await verifyAdmin();

      const [moduleResult, quizResult] = await Promise.all([
        supabase
          .from("modules")
          .select("id, module_number, title")
          .order("module_number"),

        supabase
          .from("quizzes")
          .select("id, module_id, title, is_final_exam, published")
          .order("title"),
      ]);

      if (moduleResult.error) {
        logSupabaseError("MODULE LOAD ERROR", moduleResult.error);
        throw new Error(
          `Could not load modules: ${getErrorMessage(moduleResult.error)}`
        );
      }

      if (quizResult.error) {
        logSupabaseError("QUIZ LOAD ERROR", quizResult.error);
        throw new Error(
          `Could not load quizzes: ${getErrorMessage(quizResult.error)}`
        );
      }

      setModules((moduleResult.data ?? []) as Module[]);
      setQuizzes((quizResult.data ?? []) as Quiz[]);
    } catch (error) {
      const errorMessage = getErrorMessage(error);

      console.error("QUIZ INITIALIZATION FAILED", error);
      setMessage(errorMessage);
      setMessageType("error");

      if (
        errorMessage.includes("session has expired") ||
        errorMessage.includes("does not have the admin role")
      ) {
        router.replace("/");
      }
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setSelectedQuiz("");
    setTitle("");
    setModuleId("");
    setIsFinalExam(false);
    setQuestions([]);
    setMessage("");
    setMessageType("info");
  }

  async function editQuiz(quiz: Quiz) {
    setSelectedQuiz(quiz.id);
    setTitle(quiz.title);
    setModuleId(quiz.module_id ?? "");
    setIsFinalExam(quiz.is_final_exam);
    setQuestions([]);
    setMessage("Loading quiz questions...");
    setMessageType("info");

    try {
      await verifyAdmin();

      const { data, error } = await supabase
        .from("quiz_questions")
        .select("id, question, options, correct_answer, question_number")
        .eq("quiz_id", quiz.id)
        .order("question_number");

      if (error) {
        logSupabaseError("QUIZ QUESTION LOAD ERROR", error);
        throw new Error(getErrorMessage(error));
      }

      const rows = (data ?? []) as QuizQuestionRow[];

      setQuestions(
        rows.map((item) => ({
          id: item.id,
          question: item.question,
          options: Array.isArray(item.options)
            ? item.options.map((option: unknown) => String(option))
            : [],
          correct_answer: String(item.correct_answer),
          question_number: item.question_number,
        }))
      );

      setMessage("");
    } catch (error) {
      setMessage(
        `Could not load questions: ${getErrorMessage(error)}`
      );
      setMessageType("error");
    }
  }

  function updateQuestion(
    index: number,
    changes: Partial<Question>
  ) {
    setQuestions((current) =>
      current.map((question, i) =>
        i === index ? { ...question, ...changes } : question
      )
    );
  }

  function updateOption(
    questionIndex: number,
    optionIndex: number,
    value: string
  ) {
    setQuestions((current) =>
      current.map((question, i) =>
        i === questionIndex
          ? {
              ...question,
              options: question.options.map((option, j) =>
                j === optionIndex ? value : option
              ),
            }
          : question
      )
    );
  }

  async function saveQuiz() {
    if (busy) return;

    if (!title.trim()) {
      setMessage("Enter a quiz title.");
      setMessageType("error");
      return;
    }

    for (const [index, question] of questions.entries()) {
      if (!question.question.trim()) {
        setMessage(`Enter the text for question ${index + 1}.`);
        setMessageType("error");
        return;
      }

      if (
        question.options.length < 2 ||
        question.options.some((option) => !option.trim())
      ) {
        setMessage(
          `Complete every answer option for question ${index + 1}.`
        );
        setMessageType("error");
        return;
      }

      const answerIndex = Number(question.correct_answer);

      if (
        !Number.isInteger(answerIndex) ||
        answerIndex < 0 ||
        answerIndex >= question.options.length
      ) {
        setMessage(
          `Choose the correct answer for question ${index + 1}.`
        );
        setMessageType("error");
        return;
      }
    }

    setBusy(true);
    setMessage("Saving quiz...");
    setMessageType("info");

    try {
      const user = await verifyAdmin();

      console.info("QUIZ SAVE START", {
        userId: user.id,
        email: user.email,
        editingQuiz: Boolean(selectedQuiz),
        quizTitle: title.trim(),
        moduleId: moduleId || null,
        isFinalExam,
      });

      let quizId = selectedQuiz;

      if (quizId) {
        const { error } = await supabase
          .from("quizzes")
          .update({
            title: title.trim(),
            module_id: moduleId || null,
            is_final_exam: isFinalExam,
          })
          .eq("id", quizId);

        if (error) {
          logSupabaseError("QUIZ UPDATE ERROR", error);
          throw new Error(
            `Could not update quiz: ${getErrorMessage(error)}`
          );
        }
      } else {
        const payload = {
          title: title.trim(),
          module_id: moduleId || null,
          is_final_exam: isFinalExam,
          published: false,
        };

        console.info("QUIZ INSERT PAYLOAD", payload);

        const { data, error } = await supabase
          .from("quizzes")
          .insert(payload)
          .select("id")
          .single();

        if (error) {
          logSupabaseError("QUIZ INSERT ERROR DETAILS", error);
          throw new Error(
            `Could not create quiz: ${getErrorMessage(error)}`
          );
        }

        if (!data?.id) {
          throw new Error(
            "Supabase did not return the new quiz ID."
          );
        }

        quizId = data.id;
      }

      const { error: deleteError } = await supabase
        .from("quiz_questions")
        .delete()
        .eq("quiz_id", quizId);

      if (deleteError) {
        logSupabaseError("QUIZ QUESTION DELETE ERROR", deleteError);
        throw new Error(
          `Quiz was saved, but its old questions could not be replaced: ${getErrorMessage(deleteError)}`
        );
      }

      if (questions.length > 0) {
        const rows = questions.map((question, index) => ({
          quiz_id: quizId,
          question: question.question.trim(),
          options: question.options.map((option) => option.trim()),
          correct_answer: question.correct_answer,
          question_number: index + 1,
        }));

        const { error: insertError } = await supabase
          .from("quiz_questions")
          .insert(rows);

        if (insertError) {
          logSupabaseError(
            "QUIZ QUESTION INSERT ERROR",
            insertError
          );
          throw new Error(
            `Quiz was saved, but its questions could not be saved: ${getErrorMessage(insertError)}`
          );
        }
      }

      setSelectedQuiz(quizId);
      setMessage("Quiz saved successfully.");
      setMessageType("success");

      await initialize();
      setSelectedQuiz(quizId);
    } catch (error) {
      const errorMessage = getErrorMessage(error);

      console.error("QUIZ SAVE FAILED", error);
      setMessage(errorMessage);
      setMessageType("error");
    } finally {
      setBusy(false);
    }
  }

  async function togglePublished(quiz: Quiz) {
    if (busy) return;

    setBusy(true);
    setMessage("");

    try {
      await verifyAdmin();

      const { data, error } = await supabase
        .from("quizzes")
        .update({ published: !quiz.published })
        .eq("id", quiz.id)
        .select("id, published")
        .maybeSingle();

      if (error) {
        logSupabaseError("QUIZ PUBLICATION ERROR", error);
        throw new Error(
          `Could not update publication status: ${getErrorMessage(error)}`
        );
      }

      if (!data) {
        throw new Error(
          "No quiz was updated. Check your admin permissions and database policies."
        );
      }

      setQuizzes((current) =>
        current.map((item) =>
          item.id === quiz.id
            ? { ...item, published: data.published }
            : item
        )
      );

      setMessage(
        data.published ? "Quiz published." : "Quiz unpublished."
      );
      setMessageType("success");
    } catch (error) {
      setMessage(getErrorMessage(error));
      setMessageType("error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        <LoaderCircle className="mr-2 animate-spin" size={20} />
        Loading quiz management...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              Digital Income Academy
            </p>
            <h1 className="mt-2 text-3xl font-bold">
              Quiz Management
            </h1>
            <p className="mt-2 text-slate-600">
              Create, edit and publish course quizzes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/admin")}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 hover:bg-slate-100"
            >
              <ArrowLeft size={18} />
              Back to Dashboard
            </button>

            <button
              type="button"
              onClick={resetForm}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
            >
              <Plus size={18} />
              New Quiz
            </button>
          </div>
        </header>

        {message && (
          <div
            role="status"
            aria-live="polite"
            className={`rounded-lg border p-4 text-sm ${
              messageType === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : messageType === "success"
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            {message}
          </div>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-bold">
            {selectedQuiz ? "Edit Quiz" : "Create Quiz"}
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="block text-sm font-medium">
                Quiz title
              </span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Affiliate Marketing Basics"
                className="w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-blue-600"
              />
            </label>

            <label className="space-y-2">
              <span className="block text-sm font-medium">
                Course module
              </span>
              <select
                value={moduleId}
                onChange={(event) => setModuleId(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3"
              >
                <option value="">Not linked to a module</option>
                {modules.map((module) => (
                  <option key={module.id} value={module.id}>
                    Module {module.module_number}: {module.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-4 flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={isFinalExam}
              onChange={(event) =>
                setIsFinalExam(event.target.checked)
              }
              className="h-4 w-4"
            />
            This is the final examination
          </label>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-bold">Questions</h3>

            <button
              type="button"
              onClick={() =>
                setQuestions((current) => [
                  ...current,
                  {
                    ...emptyQuestion(),
                    question_number: current.length + 1,
                  },
                ])
              }
              className="inline-flex items-center gap-2 rounded-lg border border-blue-700 px-3 py-2 font-medium text-blue-700 hover:bg-blue-50"
            >
              <Plus size={17} />
              Add Question
            </button>
          </div>

          <div className="mt-4 space-y-5">
            {questions.map((question, index) => (
              <article
                key={question.id ?? `question-${index}`}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h4 className="font-bold">
                    Question {index + 1}
                  </h4>

                  <button
                    type="button"
                    onClick={() =>
                      setQuestions((current) =>
                        current
                          .filter((_, i) => i !== index)
                          .map((item, i) => ({
                            ...item,
                            question_number: i + 1,
                          }))
                      )
                    }
                    aria-label={`Remove question ${index + 1}`}
                    className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <textarea
                  value={question.question}
                  onChange={(event) =>
                    updateQuestion(index, {
                      question: event.target.value,
                    })
                  }
                  placeholder="Type your question..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 bg-white p-3"
                />

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {question.options.map((option, optionIndex) => (
                    <label key={optionIndex} className="space-y-1">
                      <span className="text-sm font-medium">
                        Option {String.fromCharCode(65 + optionIndex)}
                      </span>

                      <input
                        value={option}
                        onChange={(event) =>
                          updateOption(
                            index,
                            optionIndex,
                            event.target.value
                          )
                        }
                        placeholder={`Answer option ${optionIndex + 1}`}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                      />
                    </label>
                  ))}
                </div>

                <label className="mt-4 block space-y-2">
                  <span className="text-sm font-medium">
                    Correct answer
                  </span>

                  <select
                    value={question.correct_answer}
                    onChange={(event) =>
                      updateQuestion(index, {
                        correct_answer: event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 sm:max-w-md"
                  >
                    {question.options.map((option, optionIndex) => (
                      <option
                        key={optionIndex}
                        value={String(optionIndex)}
                      >
                        {String.fromCharCode(65 + optionIndex)} —{" "}
                        {option || `Option ${optionIndex + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              </article>
            ))}

            {questions.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500">
                No questions added yet. Click Add Question to begin.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => void saveQuiz()}
            disabled={busy}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <LoaderCircle size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            {busy ? "Saving..." : "Save Quiz"}
          </button>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Existing Quizzes</h2>

            <button
              type="button"
              onClick={() => void initialize()}
              disabled={busy || loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          {quizzes.length === 0 ? (
            <p className="text-slate-500">
              No quizzes created yet. Create your first quiz above.
            </p>
          ) : (
            <div className="space-y-3">
              {quizzes.map((quiz) => (
                <article
                  key={quiz.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 p-4"
                >
                  <div>
                    <h3 className="font-semibold">{quiz.title}</h3>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-slate-100 px-2 py-1">
                        {quiz.is_final_exam ? "Final exam" : "Course quiz"}
                      </span>

                      <span
                        className={`rounded-full px-2 py-1 ${
                          quiz.published
                            ? "bg-green-100 text-green-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {quiz.published ? "Published" : "Draft"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void editQuiz(quiz)}
                      disabled={busy}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => void togglePublished(quiz)}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                    >
                      {quiz.published ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                      {quiz.published ? "Unpublish" : "Publish"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
