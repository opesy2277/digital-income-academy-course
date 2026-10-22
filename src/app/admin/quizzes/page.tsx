
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

const emptyQuestion = (): Question => ({
  question: "",
  options: ["", "", "", ""],
  correct_answer: "0",
  question_number: 1,
});

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

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function initialize() {
    setLoading(true);
    setMessage("");

    try {
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

      if (moduleResult.error || quizResult.error) {
        setMessage(
          moduleResult.error?.message ||
            quizResult.error?.message ||
            "Could not load quiz data."
        );
      } else {
        setModules((moduleResult.data ?? []) as Module[]);
        setQuizzes((quizResult.data ?? []) as Quiz[]);
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load quiz data."
      );
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
  }

  async function editQuiz(quiz: Quiz) {
    setSelectedQuiz(quiz.id);
    setTitle(quiz.title);
    setModuleId(quiz.module_id ?? "");
    setIsFinalExam(quiz.is_final_exam);
    setQuestions([]);
    setMessage("Loading quiz questions...");

    const { data, error } = await supabase
      .from("quiz_questions")
      .select("id, question, options, correct_answer, question_number")
      .eq("quiz_id", quiz.id)
      .order("question_number");

    if (error) {
      setMessage(`Could not load questions: ${error.message}`);
      return;
    }

    const rows = (data ?? []) as QuizQuestionRow[];

    setQuestions(
      rows.map((item: QuizQuestionRow) => ({
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
    if (!title.trim()) {
      setMessage("Enter a quiz title.");
      return;
    }

    for (const [index, question] of questions.entries()) {
      if (!question.question.trim()) {
        setMessage(`Enter the text for question ${index + 1}.`);
        return;
      }

      if (
        question.options.length < 2 ||
        question.options.some((option) => !option.trim())
      ) {
        setMessage(
          `Complete every answer option for question ${index + 1}.`
        );
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
        return;
      }
    }

    setBusy(true);
    setMessage("");

    try {
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

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("quizzes")
          .insert({
            title: title.trim(),
            module_id: moduleId || null,
            is_final_exam: isFinalExam,
            published: false,
          })
          .select("id")
          .single();

        if (error) throw error;
        quizId = data.id;
      }

      const { error: deleteError } = await supabase
        .from("quiz_questions")
        .delete()
        .eq("quiz_id", quizId);

      if (deleteError) throw deleteError;

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

        if (insertError) throw insertError;
      }

      setMessage("Quiz saved successfully.");
      await initialize();
      setSelectedQuiz(quizId);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while saving the quiz."
      );
    } finally {
      setBusy(false);
    }
  }

  async function togglePublished(quiz: Quiz) {
    const { error } = await supabase
      .from("quizzes")
      .update({ published: !quiz.published })
      .eq("id", quiz.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setQuizzes((current) =>
      current.map((item: Quiz) =>
        item.id === quiz.id
          ? { ...item, published: !quiz.published }
          : item
      )
    );

    setMessage(
      quiz.published ? "Quiz unpublished." : "Quiz published."
    );
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
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800"
            >
              <Plus size={18} />
              New Quiz
            </button>
          </div>
        </header>

        {message && (
          <div
            role="status"
            className="rounded-lg border border-slate-200 bg-white p-4 text-sm"
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
                key={question.id ?? index}
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
                          .map((item: Question, i: number) => ({
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
          <h2 className="mb-4 text-xl font-bold">Existing Quizzes</h2>

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
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void togglePublished(quiz)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
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
