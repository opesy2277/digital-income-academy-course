import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";



type Role = "student" | "admin";

async function getAuthorizedAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Please sign in again.", status: 401 as const };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error || profile?.role !== "admin") {
    return { error: "Administrator access required.", status: 403 as const };
  }

  return { user };
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Server Supabase configuration is missing.");
  }

  return createSupabaseClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function GET() {
  try {
    const auth = await getAuthorizedAdmin();

    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const service = getServiceClient();

    const { data: profiles, error: profileError } = await service
      .from("profiles")
      .select("id, full_name, role")
      .order("full_name", { ascending: true });

    if (profileError) {
      console.error("Admin profile list failed:", profileError.message);
      return NextResponse.json(
        { error: "Could not load student profiles." },
        { status: 500 }
      );
    }

    const { data: authData, error: usersError } =
      await service.auth.admin.listUsers({ page: 1, perPage: 1000 });

    if (usersError) {
      console.error("Auth user list failed:", usersError.message);
      return NextResponse.json(
        { error: "Could not load account email addresses." },
        { status: 500 }
      );
    }

    const usersById = new Map(
      authData.users.map((user) => [user.id, user])
    );

    const users = (profiles ?? []).map((profile) => {
      const authUser = usersById.get(profile.id);

      return {
        id: profile.id,
        full_name: profile.full_name,
        role: profile.role,
        email: authUser?.email ?? null,
        created_at: authUser?.created_at ?? null,
        email_confirmed: Boolean(authUser?.email_confirmed_at),
      };
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Admin list error:", error);
    return NextResponse.json(
      { error: "An unexpected server error occurred." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthorizedAdmin();

    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    let body: { userId?: string; role?: Role };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const { userId, role } = body;

    if (
      typeof userId !== "string" ||
      !userId.trim() ||
      (role !== "student" && role !== "admin")
    ) {
      return NextResponse.json(
        { error: "Choose a valid user and role." },
        { status: 400 }
      );
    }

    if (userId === auth.user.id && role !== "admin") {
      return NextResponse.json(
        { error: "You cannot remove your own administrator role here." },
        { status: 400 }
      );
    }

    const service = getServiceClient();

    const { data: target, error: targetError } = await service
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();

    if (targetError) {
      console.error("Target profile lookup failed:", targetError.message);
      return NextResponse.json(
        { error: "Could not verify the selected account." },
        { status: 500 }
      );
    }

    if (!target) {
      return NextResponse.json(
        { error: "This user profile could not be found." },
        { status: 404 }
      );
    }

    if (target.role === role) {
      return NextResponse.json({ message: "The user already has this role." });
    }

    if (target.role === "admin" && role === "student") {
      const { count, error: countError } = await service
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");

      if (countError) {
        console.error("Admin count failed:", countError.message);
        return NextResponse.json(
          { error: "Could not verify administrator accounts." },
          { status: 500 }
        );
      }

      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { error: "You cannot remove the last administrator." },
          { status: 400 }
        );
      }
    }

    const { error: updateError } = await service
      .from("profiles")
      .update({ role })
      .eq("id", userId);

    if (updateError) {
      console.error("Role update failed:", updateError.message);
      return NextResponse.json(
        { error: "Could not update this user's role." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message:
        role === "admin"
          ? "Student successfully promoted to administrator."
          : "Administrator role changed to student.",
    });
  } catch (error) {
    console.error("Role management error:", error);
    return NextResponse.json(
      { error: "An unexpected server error occurred." },
      { status: 500 }
    );
  }
}