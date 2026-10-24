
"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MailCheck,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "register";

const DEVICE_VISIT_KEY = "dia_auth_page_visited";
const PRODUCTION_URL = "https://digital-income-academy-portal.vercel.app";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("register");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const isBusy =
    loading ||
    googleLoading ||
    resetLoading ||
    resendLoading ||
    checkingSession;

  function getRedirectBase() {
    return process.env.NODE_ENV === "production"
      ? PRODUCTION_URL
      : window.location.origin;
  }

  async function redirectByRole(userId: string) {
    const supabase = createClient();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile) {
      console.error("Profile lookup failed:", profileError?.message);
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
      setError("Your account role is not recognised. Please contact support.");
      return;
    }

    router.refresh();
  }

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        try {
          if (
            active &&
            window.localStorage.getItem(DEVICE_VISIT_KEY) === "yes"
          ) {
            setMode("login");
          }
        } catch {
          // Registration remains the default if browser storage is unavailable.
        }

        const supabase = createClient();
        const {
          data: { user },
          error: sessionError,
        } = await supabase.auth.getUser();

        if (!active) return;

        if (!sessionError && user) {
          await redirectByRole(user.id);
        }
      } catch (err) {
        console.error("Session check failed:", err);
      } finally {
        if (active) setCheckingSession(false);
      }
    }

    void checkSession();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function rememberVisit() {
    try {
      window.localStorage.setItem(DEVICE_VISIT_KEY, "yes");
    } catch {
      // Authentication still works if browser storage is unavailable.
    }
  }

  function switchMode(nextMode: Mode) {
    rememberVisit();
    setMode(nextMode);
    setError("");
    setMessage("");
    setVerificationEmail("");
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();

    if (mode === "register") {
      if (!cleanName) {
        setError("Please enter your full name.");
        return;
      }

      if (password.length < 8) {
        setError("Your password must contain at least 8 characters.");
        return;
      }

      if (password !== confirmPassword) {
        setError("Your passwords do not match.");
        return;
      }
    }

    rememberVisit();
    setLoading(true);

    try {
      const supabase = createClient();

      if (mode === "register") {
        const redirectBase = getRedirectBase();

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: { full_name: cleanName },
            emailRedirectTo: `${redirectBase}/auth/callback?next=/student`,
          },
        });

        if (signUpError) {
          const lowerMessage = signUpError.message.toLowerCase();

          if (lowerMessage.includes("rate limit")) {
            setError(
              "Too many verification email requests. Please wait a while before trying again."
            );
          } else if (
            lowerMessage.includes("already registered") ||
            lowerMessage.includes("already exists")
          ) {
            setError(
              "An account may already exist with this email. Try logging in or requesting a password reset."
            );
          } else {
            setError(signUpError.message);
          }
          return;
        }

        if (data.session && data.user) {
          await redirectByRole(data.user.id);
          return;
        }

        setVerificationEmail(cleanEmail);
        setEmail(cleanEmail);
        setMessage(
          "Your registration was received. Check your email inbox for a verification link. Open the message and click the link to verify your email before signing in. If it is missing, check your spam or junk folder."
        );
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        return;
      }

      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (loginError || !data.user) {
        const details = loginError?.message.toLowerCase() ?? "";

        if (details.includes("email not confirmed")) {
          setVerificationEmail(cleanEmail);
          setError(
            "Your email has not been verified yet. Check your inbox for the verification link, or request another one below."
          );
        } else {
          setError(
            "Login failed. Check your email and password. If you registered recently, confirm your email first."
          );
        }
        return;
      }

      await redirectByRole(data.user.id);
    } catch (err) {
      console.error("Authentication error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    const cleanEmail = (verificationEmail || email).trim().toLowerCase();

    setError("");
    setMessage("");

    if (!cleanEmail) {
      setError("Enter your email address first.");
      return;
    }

    setResendLoading(true);

    try {
      const supabase = createClient();

      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: cleanEmail,
        options: {
          emailRedirectTo: `${getRedirectBase()}/auth/callback?next=/student`,
        },
      });

      if (resendError) {
        const lowerMessage = resendError.message.toLowerCase();

        if (lowerMessage.includes("rate limit")) {
          setError(
            "Please wait before requesting another verification email."
          );
        } else {
          setError(
            "We could not resend the email right now. Check the address and try again later."
          );
        }
        return;
      }

      setVerificationEmail(cleanEmail);
      setMessage(
        "If this address has a pending registration, a new verification email has been requested. Check your inbox and spam or junk folder."
      );
    } catch (err) {
      console.error("Resend verification failed:", err);
      setError("Could not resend the verification email. Please try again.");
    } finally {
      setResendLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError("");
    setMessage("");
    rememberVisit();
    setGoogleLoading(true);

    try {
      const supabase = createClient();

      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${getRedirectBase()}/auth/callback?next=/student`,
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
    } catch (err) {
      console.error("Google sign-in error:", err);
      setError("Could not start Google sign-in. Please try again.");
      setGoogleLoading(false);
    }
  }

  async function handlePasswordReset() {
    setError("");
    setMessage("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Enter your email address first, then request a password reset.");
      return;
    }

    setResetLoading(true);

    try {
      const supabase = createClient();

      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${getRedirectBase()}/auth/callback?next=/auth/update-password`,
        });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setMessage(
        "If an account exists for that email, you will receive instructions to set or reset your password. Check your inbox and spam folder."
      );
    } catch (err) {
      console.error("Password reset request failed:", err);
      setError("Could not request a password reset. Please try again.");
    } finally {
      setResetLoading(false);
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
              Create your account or sign in to continue learning, access
              lessons, take quizzes and track your progress.
            </p>
          </div>

          <p className="text-sm text-blue-200">
            Digital Income Academy · Student Learning Portal
          </p>
        </section>

        <section className="p-6 sm:p-10 xl:p-12">
          <div className="mb-7 lg:hidden">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-950 text-white">
              <BookOpen size={25} />
            </div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
              Digital Income Academy
            </p>
          </div>

          <div className="mb-6">
            <h2 className="text-3xl font-bold tracking-tight text-slate-950">
              {mode === "register" ? "Create your account" : "Welcome back"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {mode === "register"
                ? "Register with your email or Google account."
                : "Sign in with your email and password or Google."}
            </p>
          </div>

          <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => switchMode("register")}
              disabled={isBusy}
              className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                mode === "register"
                  ? "bg-white text-blue-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Register
            </button>
            <button
              type="button"
              onClick={() => switchMode("login")}
              disabled={isBusy}
              className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                mode === "login"
                  ? "bg-white text-blue-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Login
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
              <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5">
                <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.8 6-15Z" />
                <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.7-5.1c-1.8 1.2-4.1 2-6.8 2-5.2 0-9.6-3.5-11.2-8.2H5.9v5.2A20 20 0 0 0 24 44Z" />
                <path fill="#FBBC05" d="M12.8 27.9a12 12 0 0 1 0-7.8v-5.2H5.9a20 20 0 0 0 0 18.2l6.9-5.2Z" />
                <path fill="#EA4335" d="M24 11.9c3 0 5.7 1 7.8 3.1l5.9-5.9C34.1 5.8 29.5 4 24 4A20 20 0 0 0 5.9 14.9l6.9 5.2c1.6-4.7 6-8.2 11.2-8.2Z" />
              </svg>
            )}
            {googleLoading ? "Connecting to Google..." : "Continue with Google"}
          </button>

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Or use email
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === "register" && (
              <div>
                <label htmlFor="fullName" className="mb-2 block text-sm font-semibold text-slate-700">
                  Full name
                </label>
                <div className="relative">
                  <UserRound size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="fullName"
                    type="text"
                    autoComplete="name"
                    required
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
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">
                Email address
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
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
              <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700">
                {mode === "register" ? "Create password" : "Password"}
              </label>
              <div className="relative">
                <LockKeyhole size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  minLength={mode === "register" ? 8 : undefined}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={mode === "register" ? "At least 8 characters" : "Enter your password"}
                  disabled={isBusy}
                  className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-slate-900 outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50"
                />
              </div>
            </div>

            {mode === "register" && (
              <div>
                <label htmlFor="confirmPassword" className="mb-2 block text-sm font-semibold text-slate-700">
                  Confirm password
                </label>
                <div className="relative">
                  <LockKeyhole size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Enter your password again"
                    disabled={isBusy}
                    className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-slate-900 outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50"
                  />
                </div>
              </div>
            )}

            {mode === "login" && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => void handlePasswordReset()}
                  disabled={isBusy}
                  className="text-sm font-semibold text-blue-800 hover:underline disabled:opacity-60"
                >
                  {resetLoading ? "Sending instructions..." : "Forgot or need to set a password?"}
                </button>
              </div>
            )}

            {error && (
              <p role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm leading-6 text-red-700">
                {error}
              </p>
            )}

            {message && (
              <div role="status" className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                <div className="flex items-start gap-2">
                  <MailCheck size={20} className="mt-0.5 shrink-0 text-blue-700" />
                  <p>{message}</p>
                </div>
              </div>
            )}

            {verificationEmail && (
              <button
                type="button"
                onClick={() => void handleResendVerification()}
                disabled={isBusy}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 px-4 py-3 font-semibold text-blue-900 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resendLoading ? (
                  <LoaderCircle size={18} className="animate-spin" />
                ) : (
                  <MailCheck size={18} />
                )}
                {resendLoading ? "Requesting email..." : "Resend verification email"}
              </button>
            )}

            <button
              type="submit"
              disabled={isBusy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-950 px-4 py-3.5 font-semibold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading || checkingSession ? (
                <LoaderCircle size={19} className="animate-spin" />
              ) : (
                <ArrowRight size={18} />
              )}
              {checkingSession
                ? "Checking account..."
                : loading
                  ? mode === "register"
                    ? "Creating account..."
                    : "Signing in..."
                  : mode === "register"
                    ? "Create account"
                    : "Sign in"}
            </button>
          </form>

          <p className="mt-7 text-center text-xs leading-5 text-slate-500">
            Your account role controls which dashboard you can access.
            Registration does not grant administrator privileges.
          </p>
        </section>
      </div>
    </main>
  );
}
