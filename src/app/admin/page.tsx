
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  LoaderCircle,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type PageMode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<PageMode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const isBusy = loading || googleLoading;
  const isRegistering = mode === "register";

  function switchMode(nextMode: PageMode) {
    setMode(nextMode);
    setError("");
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  }

  async function redirectByRole(
    supabase: ReturnType<typeof createClient>,
    userId: string
  ) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const normalizedEmail = email.trim().toLowerCase();
    const name = fullName.trim();

    if (isRegistering) {
      if (name.length < 2) {
        setError("Please enter your full name.");
        return;
      }

      if (password.length < 8) {
        setError("Your password must be at least 8 characters long.");
        return;
      }

      if (password !== confirmPassword) {
        setError("Your passwords do not match.");
        return;
      }
    }

    setLoading(true);

    try {
      const supabase = createClient();

      if (isRegistering) {
        const { data, error: signUpError } =
          await supabase.auth.signUp({
            email: normalizedEmail,
            password,
            options: {
              data: {
                full_name: name,
              },
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          });

        if (signUpError) {
          setError(
            "We couldn't create your account. Check your details or try signing in if you already registered."
          );
          return;
        }

        if (data.session && data.user) {
          await redirectByRole(supabase, data.user.id);
          return;
        }

        setMessage(
          "Registration submitted. If email confirmation is enabled, check your inbox and confirm your email before signing in."
        );
        return;
      }

      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

      if (loginError || !data.user) {
        setError(
          "Incorrect email or password. Check your details or create an account if you're new."
        );
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
    setMessage("");
    setGoogleLoading(true);

    try {
      const supabase = createClient();

      const { error: googleError } =
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
            queryParams: {
              prompt: "select_account",
            },
          },
        });

      if (googleError) {
        setError("Google sign-in could not start. Please try again.");
        setGoogleLoading(false);
      }
    } catch {
      setError("Could not connect to Google. Please try again.");
      setGoogleLoading(false);
    }
  }

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
              <p className="text-sm text-blue-200">
                Your learning journey
              </p>
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
              Access your learning dashboard, course lessons, quizzes
              and progress in one place.
            </p>
          </div>

          <p className="text-sm text-blue-200">
            Digital Income Academy · Student Learning Portal
          </p>
        </section>

        <section className="p-6 sm:p-10 xl:p-12">
          <div className="mb-7 lg:hidden">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-950 text-white">
              <BookOpen size={25} />
            </div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
              Digital Income Academy
            </p>
          </div>

          <div className="mb-7">
            <h2 className="text-3xl font-bold tracking-tight text-slate-950">
              {isRegistering ? "Create your account" : "Welcome back"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {isRegistering
                ? "Enter your details to get started with the academy."
                : "Sign in to continue to your academy dashboard."}
            </p>
          </div>

          <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => switchMode("login")}
              disabled={isBusy}
              className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                !isRegistering
                  ? "bg-white text-blue-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => switchMode("register")}
              disabled={isBusy}
              className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                isRegistering
                  ? "bg-white text-blue-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Create account
            </button>
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
              Or continue with email
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegistering && (
              <div>
                <label
                  htmlFor="fullName"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Full name
                </label>
                <div className="relative">
                  <UserRound
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    id="fullName"
                    type="text"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={100}
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Enter your full name"
                    disabled={isBusy}
                    className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-slate-900 outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50"
                  />
                </div>
              </div>
            )}

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
                  autoComplete={
                    isRegistering ? "new-password" : "current-password"
                  }
                  required
                  minLength={isRegistering ? 8 : undefined}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={
                    isRegistering
                      ? "At least 8 characters"
                      : "Enter your password"
                  }
                  disabled={isBusy}
                  className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-slate-900 outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50"
                />
              </div>
            </div>

            {isRegistering && (
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  placeholder="Enter your password again"
                  disabled={isBusy}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50"
                />
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm leading-6 text-red-700"
              >
                {error}
              </p>
            )}

            {message && (
              <p
                role="status"
                className="rounded-xl border border-green-100 bg-green-50 p-3 text-sm leading-6 text-green-800"
              >
                {message}
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
              {loading
                ? isRegistering
                  ? "Creating account..."
                  : "Signing in..."
                : isRegistering
                  ? "Create account"
                  : "Sign in with email"}
            </button>
          </form>

          <p className="mt-7 text-center text-xs leading-5 text-slate-500">
            Course access is reserved for enrolled students. Creating an
            account does not itself confirm course payment or grant access.
          </p>
        </section>
      </div>
    </main>
  );
}
