
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Users,
  ClipboardCheck,
  ShieldCheck,
  LogOut,
  LayoutDashboard,
  GraduationCap,
  Settings,
  LoaderCircle,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  role: string;
  full_name: string | null;
};

export default function AdminDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [checking, setChecking] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkAdmin() {
      const supabase = createClient();

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.replace("/");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", authData.user.id)
        .single();

      if (error || !data || data.role !== "admin") {
        router.replace("/student");
        return;
      }

      if (active) {
        setProfile(data as Profile);
        setChecking(false);
      }
    }

    checkAdmin();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleSignOut() {
    setSigningOut(true);

    const supabase = createClient();
    await supabase.auth.signOut();

    router.replace("/");
    router.refresh();
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <LoaderCircle className="animate-spin" size={22} />
          Checking administrator access...
        </div>
      </main>
    );
  }

  if (!profile) return null;

  const sections = [
   {
  title: "Course Modules",
  description: "Organise and publish your nine course modules.",
  icon: BookOpen,
  href: "/admin/modules",
},
    {
      title: "Lessons",
      description: "Create and manage written, video and audio lessons.",
      icon: GraduationCap,
      href: "/admin/lessons",
    },
    {
      title: "Students",
      description: "Review student accounts and enrolment access.",
      icon: Users,
      href: "/admin/student",
    },
    {
      title: "Quizzes & Exams",
      description: "Manage module quizzes and the final examination.",
      icon: ClipboardCheck,
      href: "/admin/quizzes",
    },
    {
      title: "Admin Management",
      description: "Add administrators and revoke their admin roles.",
      icon: ShieldCheck,
      href: "/admin/administrators",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-900 text-white">
              <LayoutDashboard size={23} />
            </div>

            <div>
              <h1 className="font-bold text-blue-950">
                Digital Income Academy
              </h1>
              <p className="text-xs text-slate-500">Admin Portal</p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            <LogOut size={17} />
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-10">
        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold text-blue-700">
            ADMINISTRATION
          </p>

          <h2 className="text-3xl font-bold tracking-tight">
            Welcome{profile.full_name ? `, ${profile.full_name}` : " back"}
          </h2>

          <p className="mt-2 text-slate-600">
            Manage your learning platform from one place.
          </p>
        </div>

        <div className="mb-8 rounded-xl border border-blue-100 bg-blue-50 p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 text-blue-800" size={24} />
            <div>
              <h3 className="font-semibold text-blue-950">
                Administrator access confirmed
              </h3>
              <p className="mt-1 text-sm leading-6 text-blue-900">
                You are signed in with an administrator account. Use the
                sections below to manage the academy.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((section) => {
            const Icon = section.icon;

            return (
              <div
                key={section.title}
                className="group rounded-xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-md"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-800 transition group-hover:bg-blue-100">
                  <Icon size={24} />
                </div>

                <h3 className="text-lg font-bold">{section.title}</h3>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {section.description}
                </p>

                <button
                  type="button"
                  onClick={() => router.push(section.href)}
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Open section
                  <ArrowRight size={16} />
                </button>
              </div>
            );
          })}
        </div>

        <footer className="mt-12 border-t border-slate-200 py-6 text-center text-sm text-slate-500">
          Digital Income Academy · Administrator Dashboard
        </footer>
      </div>
    </main>
  );
}
