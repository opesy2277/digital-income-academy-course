
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const PRODUCTION_URL = "https://digital-income-academy-portal.vercel.app";

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const name = fullName.trim();
    const cleanEmail = email.trim();

    if (!name) {
      setError("Please enter your full name.");
      return;
    }

    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const redirectBase =
        process.env.NODE_ENV === "production"
          ? PRODUCTION_URL
          : window.location.origin;

      const { data, error: signUpError } =
        await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: name,
            },
            emailRedirectTo: `${redirectBase}/auth/callback?next=/student`,
          },
        });

      if (signUpError) {
        setError(
          signUpError.message.toLowerCase().includes("already registered")
            ? "An account with this email may already exist. Please sign in instead."
            : signUpError.message
        );
        return;
      }

      if (data.session && data.user) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();

        if (profileError || !profile) {
          await supabase.auth.signOut();
          setError(
            "Your account was created, but its profile is not ready. Please contact the academy."
          );
          return;
        }

        if (profile.role === "admin") {
          router.replace("/admin");
        } else if (profile.role === "student") {
          router.replace("/student");
        } else {
          await supabase.auth.signOut();
          setError(
            "Your account role is not recognised. Please contact support."
          );
          return;
        }

        router.refresh();
        return;
      }

      setMessage(
        "Registration submitted! Check your email for the confirmation link. It should return you to the hosted Digital Income Academy website."
      );
    } catch {
      setError("We could not complete registration. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-9">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-950 text-white">
          <BookOpen size={25} />
        </div>

        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
          Digital Income Academy
        </p>

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
          Create your account
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Register to begin your learning journey.
        </p>

        <form onSubmit={handleRegister} className="mt-7 space-y-5">
          <div>
            <label
              htmlFor="fullName"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Full name
            </label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              required
              maxLength={100}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Enter your full name"
              disabled={loading}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              disabled={loading}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              disabled={loading}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50"
            />
          </div>

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
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-950 px-4 py-3.5 font-semibold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <LoaderCircle size={19} className="animate-spin" />
            ) : (
              <ArrowRight size={18} />
            )}
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-7 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <a
            href="/"
            className="font-semibold text-blue-800 hover:underline"
          >
            Sign in
          </a>
        </p>
      </section>
    </main>
  );
}
