
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  BookOpen,
  GraduationCap,
  ClipboardCheck,
  LogOut,
  RefreshCw,
  ArrowRight,
  LayoutDashboard,
  ShieldAlert,
} from "lucide-react";

type Module = {
  id: string;
  title: string;
  description: string | null;
  module_number: number;
};

export default function StudentDashboard() {
  const router = useRouter();

  const [fullName, setFullName] = useState("Student");
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

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
        .select("full_name, role")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        setError("We couldn't load your account profile.");
        return;
      }

      if (profile.role === "admin") {
        router.replace("/admin");
        return;
      }

      if (profile.role !== "student") {
        setError("Your account role could not be verified.");
        return;
      }

      setFullName(profile.full_name?.trim() || "Student");

      const { data: moduleData, error: moduleError } = await supabase
        .from("modules")
        .select("id, title, description, module_number")
        .order("module_number", { ascending: true });

      if (moduleError) {
        throw new Error(moduleError.message);
      }

      setModules(moduleData ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your dashboard."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/");
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/student" className="flex items-center gap-3">
            <span className="rounded-xl bg-blue-700 p-2.5 text-white">
              <GraduationCap size={25} />
            </span>
            <span>
              <span className="block text-lg font-bold">
                Digital Income Academy
              </span>
              <span className="block text-xs text-slate-500">
                Student Portal
              </span>
            </span>
          </Link>

          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            <LogOut size={17} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-blue-950 via-blue-800 to-blue-600 p-7 text-white shadow-sm sm:p-10">
          <div className="max-w-3xl">
            <div className="mb-4 flex items-center gap-2 text-sm text-blue-100">
              <LayoutDashboard size={17} />
              Student Dashboard
            </div>

            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Welcome back, {fullName}!
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-blue-100 sm:text-base">
              Continue learning digital marketing and affiliate marketing
              skills at your own pace. Choose a module below to get started.
            </p>

            <a
              href="#course-modules"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-bold text-blue-900 hover:bg-blue-50"
            >
              Explore modules
              <ArrowRight size={17} />
            </a>
          </div>
        </section>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <ShieldAlert size={20} className="mt-0.5 shrink-0" />
            <div className="flex-1">
              <p>{error}</p>
              <button
                onClick={() => void loadDashboard()}
                className="mt-2 font-semibold underline"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        <section className="grid gap-5 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="inline-flex rounded-xl bg-blue-50 p-3 text-blue-700">
              <BookOpen size={23} />
            </span>
            <p className="mt-4 text-sm text-slate-500">Course modules</p>
            <p className="mt-1 text-3xl font-bold">
              {loading ? "—" : modules.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="inline-flex rounded-xl bg-indigo-50 p-3 text-indigo-700">
              <ClipboardCheck size={23} />
            </span>
            <p className="mt-4 text-sm text-slate-500">Learning activities</p>
            <p className="mt-1 text-lg font-bold">Quizzes and exams</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="inline-flex rounded-xl bg-emerald-50 p-3 text-emerald-700">
              <GraduationCap size={23} />
            </span>
            <p className="mt-4 text-sm text-slate-500">Learning mode</p>
            <p className="mt-1 text-lg font-bold">Self-paced learning</p>
          </div>
        </section>

        <section id="course-modules" className="scroll-mt-6 space-y-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-2xl font-bold">Your Course Modules</h2>
              <p className="mt-2 text-sm text-slate-600">
                Explore the learning topics available in the course.
              </p>
            </div>

            <button
              onClick={() => void loadDashboard()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-100 disabled:opacity-60 sm:self-auto"
            >
              <RefreshCw
                size={16}
                className={loading ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
              Loading your course modules...
            </div>
          ) : modules.length === 0 && !error ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
              <BookOpen
                size={38}
                className="mx-auto mb-3 text-slate-300"
              />
              <h3 className="font-bold">No modules available yet</h3>
              <p className="mt-2 text-sm text-slate-500">
                Course modules will appear here when they are added.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {modules.map((module) => (
                <article
                  key={module.id}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-blue-800">
                      Module {module.module_number}
                    </span>
                    <BookOpen size={22} className="text-blue-700" />
                  </div>

                  <h3 className="mt-5 text-lg font-bold">
                    {module.title}
                  </h3>

                  <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">
                    {module.description || "Explore the lessons in this module."}
                  </p>

                  <Link
                    href={`/student/modules/${module.id}`}
                    className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800"
                  >
                    Open module
                    <ArrowRight size={17} />
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="border-t border-slate-200 py-5 text-center text-xs text-slate-500">
          Digital Income Academy · Keep learning, keep growing.
        </footer>
      </div>
    </main>
  );
}
