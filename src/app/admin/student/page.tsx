
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
  ShieldAlert,
} from "lucide-react";

type Student = {
  id: string;
  full_name: string | null;
  role: string;
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
        return;
      }

      setIsAdmin(true);

      const { data, error: studentsError } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("role", "student")
        .order("full_name", { ascending: true });

      if (studentsError) {
        throw new Error(studentsError.message);
      }

      setStudents(data ?? []);
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
    const query = search.trim().toLowerCase();

    return (
      !query ||
      student.full_name?.toLowerCase().includes(query) ||
      student.id.toLowerCase().includes(query)
    );
  });

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
              View and search registered student profiles.
            </p>
          </div>

          <button
            onClick={() => setRefreshKey((key) => key + 1)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            <RefreshCw
              size={17}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </section>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <ShieldAlert size={20} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Registered Students
              </p>
              <p className="mt-2 text-3xl font-bold">{students.length}</p>
            </div>
            <span className="rounded-xl bg-blue-50 p-3 text-blue-700">
              <Users size={25} />
            </span>
          </div>
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
                placeholder="Search student name or ID"
                className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500">
              Loading student profiles...
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
                Registered student profiles will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Student</th>
                    <th className="px-5 py-4">Account Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">
                          {student.full_name || "Unnamed student"}
                        </p>
                        <p className="mt-1 break-all text-xs text-slate-500">
                          ID: {student.id}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold capitalize text-blue-800">
                          Student
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
