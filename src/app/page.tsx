"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  LoaderCircle,
  LockKeyhole,
  Mail,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function redirectByRole(
    supabase: ReturnType<typeof createClient>,
    userId: string
  ) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      setError(
        "Your account profile could not be found. Please contact the academy."
      );
      return;
    }

    if (profile.role === "admin") {
      router.replace("/admin");
    } else if (profile.role === "student") {
      router.replace("/student");
    } else {
      await supabase.auth.signOut();
      setError("Your account role is not recognised. Please contact support.");
      return;
    }

    router.refresh();
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError || !data.user) {
        setError("Invalid email or password. Please try again.");
        return;
      }

      await redirectByRole(supabase, data.user.id);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError("");
    setGoogleLoading(true);

    try {
      const supabase = createClient();

      const { error: googleError } =
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/auth/callback?next=/student`,
            queryParams: {
              access_type: "offline",
              prompt: "select_account",
            },
          },
        });

      if (googleError) {
        setError(googleError.message);
        setGoogleLoading(false);
      }
    } catch {
      setError("Could not start Google sign-in. Please try again.");
      setGoogleLoading(false);
    }
  }

  const isBusy = loading || googleLoading;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-10 sm:px-6">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-blue-100/70 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-indigo-100/70 blur-3xl" />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl lg:grid-cols-2">
        <section className="hidden flex-col justify-between bg-blue-950 p-10 text-white lg:flex xl:p-12">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
              <BookOpen size={26} />
            </div>
            <div>
              <p className="font-bold">Digital Income Academy</p>
              <p className="text-sm text-blue-200">Your learning journey</p>
            </div>
          </div>

          <div className="py-10">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-blue-300">
              Learn. Promote. Grow.
            </p>
            <h1 className="text-4xl font-bold leading-tight xl:text-5xl">
              Learn the Strategy Behind Every Successful Sale.
            </h1>
            <p className="mt-5 max-w-md leading-7 text-blue-100">
              Sign in to access your learning dashboard, course lessons,
              quizzes and progress.
            </p>
          </div>

          <p className="text-sm text-blue-200">
            Digital Income Academy · Student Learning Portal
          </p>
        </section>

        <section className="p-6 sm:p-10 xl:p-12">
          <div className="mb-8 lg:hidden">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-950 text-white">
              <BookOpen size={25} />
            </div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
              Digital Income Academy
            </p>
          </div>

          <div className="mb-7">
            <h2 className="text-3xl font-bold tracking-tight text-slate-950">
              Welcome back
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Sign in to continue to your academy dashboard.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleGoogleLogin()}
            disabled={isBusy}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {googleLoading ? (
              <LoaderCircle size={19} className="animate-spin" />
            ) : (
              <svg
                aria-hidden="true"
                viewBox="0 0 48 48"
                className="h-5 w-5"
              >
                <path
                  fill="#4285F4"
                  d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.8 6-15Z"
                />
                <path
                  fill="#34A853"
                  d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.7-5.1c-1.8 1.2-4.1 2-6.8 2-5.2 0-9.6-3.5-11.2-8.2H5.9v5.2A20 20 0 0 0 24 44Z"
                />
                <path
                  fill="#FBBC05"
                  d="M12.8 27.9a12 12 0 0 1 0-7.8v-5.2H5.9a20 20 0 0 0 0 18.2l6.9-5.2Z"
                />
                <path
                  fill="#EA4335"
                  d="M24 11.9c3 0 5.7 1 7.8 3.1l5.9-5.9C34.1 5.8 29.5 4 24 4A20 20 0 0 0 5.9 14.9l6.9 5.2c1.6-4.7 6-8.2 11.2-8.2Z"
                />
              </svg>
            )}
            {googleLoading ? "Connecting to Google..." : "Continue with Google"}
          </button>

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Or sign in with email
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Email address
              </label>
              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  disabled={isBusy}
                  className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-slate-900 outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Password
              </label>
              <div className="relative">
                <LockKeyhole
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  disabled={isBusy}
                  className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-slate-900 outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50"
                />
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm leading-6 text-red-700"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isBusy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-950 px-4 py-3.5 font-semibold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <LoaderCircle size={19} className="animate-spin" />
              ) : (
                <ArrowRight size={18} />
              )}
              {loading ? "Signing in..." : "Sign in with email"}
            </button>
          </form>

          <p className="mt-7 text-center text-xs leading-5 text-slate-500">
            Course access is reserved for enrolled students. If you have paid
            but cannot access your account, contact the academy for assistance.
          </p>
        </section>
      </div>
    </main>
  );
}