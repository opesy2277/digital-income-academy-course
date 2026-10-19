"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  GraduationCap,
  RefreshCw,
  Search,
  Users,
  CheckCircle2,
  Clock,
  ShieldAlert,
} from "lucide-react";

type Student = {
  id: string;
  full_name: string | null;
  role: string;
  created_at?: string;
  email?: string | null;
  enrollment?: {
    payment_status: string;
    access_granted: boolean;
    payment_provider: string | null;
    payment_reference: string | null;
  } | null;
};

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setError("Please sign in with an administrator account.");
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError || profile?.role !== "admin") {
        setIsAdmin(false);
        setError("You do not have permission to view student records.");
        setLoading(false);
        return;
      }

      setIsAdmin(true);

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("role", "student")
        .order("full_name", { ascending: true });

      if (profilesError) {
        throw new Error(profilesError.message);
      }

      const { data: enrollments, error: enrollmentError } = await supabase
        .from("enrollments")
        .select(
          "user_id, payment_status, access_granted, payment_provider, payment_reference"
        );

      if (enrollmentError) {
        throw new Error(enrollmentError.message);
      }

      const enrollmentMap = new Map(
        (enrollments ?? []).map((enrollment) => [
          enrollment.user_id,
          enrollment,
        ])
      );

      const results: Student[] = (profiles ?? []).map((profile) => ({
        ...profile,
        enrollment: enrollmentMap.get(profile.id) ?? null,
      }));

      setStudents(results);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load students. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents, refreshKey]);

  const filteredStudents = students.filter((student) => {
    const query = search.toLowerCase().trim();

    return (
      !query ||
      student.full_name?.toLowerCase().includes(query) ||
      student.id.toLowerCase().includes(query) ||
      student.enrollment?.payment_reference?.toLowerCase().includes(query)
    );
  });

  const verifiedCount = students.filter(
    (student) => student.enrollment?.payment_status === "verified"
  ).length;

  const pendingCount = students.filter(
    (student) => student.enrollment?.payment_status === "pending"
  ).length;

  const accessCount = students.filter(
    (student) => student.enrollment?.access_granted
  ).length;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900"
        >
          <ArrowLeft size={18} />
          Back to Admin Dashboard
        </Link>

        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="rounded-xl bg-blue-100 p-3 text-blue-700">
                <GraduationCap size={27} />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">
                Students Management
              </h1>
            </div>
            <p className="text-sm text-slate-600">
              View registered students, payment records, and course access.
            </p>
          </div>

          <button
            onClick={() => setRefreshKey((key) => key + 1)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </section>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <ShieldAlert size={20} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Students"
            value={students.length}
            icon={<Users size={22} />}
          />
          <StatCard
            title="Verified Payments"
            value={verifiedCount}
            icon={<CheckCircle2 size={22} />}
          />
          <StatCard
            title="Pending Payments"
            value={pendingCount}
            icon={<Clock size={22} />}
          />
          <StatCard
            title="Course Access Granted"
            value={accessCount}
            icon={<GraduationCap size={22} />}
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">Registered Students</h2>
              <p className="mt-1 text-sm text-slate-500">
                {filteredStudents.length} student
                {filteredStudents.length === 1 ? "" : "s"} displayed
              </p>
            </div>

            <div className="relative w-full sm:max-w-sm">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, ID, or payment reference"
                className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500">
              Loading student records...
            </div>
          ) : !isAdmin && !error ? (
            <div className="p-12 text-center text-slate-500">
              Administrator access is required.
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-12 text-center">
              <Users size={36} className="mx-auto mb-3 text-slate-300" />
              <p className="font-semibold text-slate-700">
                No students found
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Students will appear here after their profiles are created.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Student</th>
                    <th className="px-5 py-4">Payment</th>
                    <th className="px-5 py-4">Course Access</th>
                    <th className="px-5 py-4">Payment Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">
                          {student.full_name || "Unnamed student"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          ID: {student.id}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        {student.enrollment ? (
                          <StatusBadge
                            value={student.enrollment.payment_status}
                          />
                        ) : (
                          <StatusBadge value="not enrolled" />
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge
                          value={
                            student.enrollment?.access_granted
                              ? "granted"
                              : "not granted"
                          }
                        />
                      </td>
                      <td className="px-5 py-4">
                        <span className="break-all text-xs text-slate-600">
                          {student.enrollment?.payment_reference || "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="text-xs leading-5 text-slate-500">
          Student information is read from your Supabase profiles and
          enrollments tables. Payment verification and course-access changes
          should be handled through your authorized enrollment workflow.
        </p>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <span className="rounded-lg bg-blue-50 p-2 text-blue-700">{icon}</span>
      </div>
      <p className="mt-4 text-3xl font-bold">{value}</p>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();

  let styles = "bg-slate-100 text-slate-700";

  if (
    normalized === "verified" ||
    normalized === "granted"
  ) {
    styles = "bg-green-100 text-green-800";
  } else if (normalized === "pending") {
    styles = "bg-amber-100 text-amber-800";
  } else if (
    normalized === "failed" ||
    normalized === "refunded" ||
    normalized === "not granted"
  ) {
    styles = "bg-red-100 text-red-800";
  }

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${styles}`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}