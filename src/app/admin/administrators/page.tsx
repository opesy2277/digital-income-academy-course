"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  Shield,
  RefreshCw,
  Search,
  UserRound,
  UserPlus,
  UserMinus,
  AlertCircle,
} from "lucide-react";

type ManagedUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "student";
};

export default function AdministratorsPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/administrators", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load users.");
      }

      setUsers(data.users ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function changeRole(user: ManagedUser) {
    const nextRole = user.role === "admin" ? "student" : "admin";
    const action = nextRole === "admin" ? "promote" : "remove";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} administrator access ${
        nextRole === "admin" ? "for" : "from"
      } ${user.full_name || user.email}?`
    );

    if (!confirmed) return;

    setWorkingId(user.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/administrators", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          role: nextRole,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to update this user's role.");
      }

      setMessage(data.message || "Administrator role updated.");
      await loadUsers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setWorkingId(null);
    }
  }

  const filteredUsers = users.filter((user) => {
    const query = search.toLowerCase();

    return (
      (user.full_name || "").toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    );
  });

  const adminCount = users.filter((user) => user.role === "admin").length;
  const studentCount = users.filter((user) => user.role === "student").length;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/admin"
          className="mb-6 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100"
        >
          <ArrowLeft size={17} />
          Back to Dashboard
        </Link>

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-blue-700">
              <ShieldCheck size={25} />
              <span className="text-sm font-semibold uppercase tracking-wide">
                Administration
              </span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight">
              Admin Management
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              View registered users and manage administrator access securely.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadUsers()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Total users</span>
              <UserRound className="text-blue-700" size={22} />
            </div>
            <p className="mt-3 text-3xl font-bold">{users.length}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Administrators</span>
              <ShieldCheck className="text-green-700" size={22} />
            </div>
            <p className="mt-3 text-3xl font-bold">{adminCount}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Students</span>
              <Shield className="text-slate-600" size={22} />
            </div>
            <p className="mt-3 text-3xl font-bold">{studentCount}</p>
          </div>
        </div>

        {message && (
          <div
            role="status"
            className="mb-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800"
          >
            {message}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-5 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <span>{error}</span>
          </div>
        )}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">Registered users</h2>
              <p className="mt-1 text-sm text-slate-500">
                Promote students or remove administrator privileges.
              </p>
            </div>

            <div className="relative w-full sm:max-w-xs">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name or email"
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500">
              Loading users...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              No users found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-semibold">User</th>
                    <th className="px-5 py-4 font-semibold">Email</th>
                    <th className="px-5 py-4 font-semibold">Role</th>
                    <th className="px-5 py-4 text-right font-semibold">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4 font-medium">
                        {user.full_name || "Unnamed user"}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {user.email}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            user.role === "admin"
                              ? "bg-green-100 text-green-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {user.role === "admin" ? (
                            <ShieldCheck size={14} />
                          ) : (
                            <UserRound size={14} />
                          )}
                          {user.role === "admin" ? "Administrator" : "Student"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => void changeRole(user)}
                          disabled={workingId !== null}
                          className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                            user.role === "admin"
                              ? "bg-red-600 hover:bg-red-700"
                              : "bg-blue-700 hover:bg-blue-800"
                          }`}
                        >
                          {user.role === "admin" ? (
                            <UserMinus size={15} />
                          ) : (
                            <UserPlus size={15} />
                          )}
                          {workingId === user.id
                            ? "Updating..."
                            : user.role === "admin"
                              ? "Remove admin"
                              : "Make admin"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="mt-5 text-xs leading-5 text-slate-500">
          Role changes affect permissions. Only authorized administrators
          should use this page. Server-side authorization must be configured
          before enabling these actions.
        </p>
      </div>
    </main>
  );
}
