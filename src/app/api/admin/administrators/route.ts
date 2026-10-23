
import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Role = "student" | "admin";

type AuthorizedAdmin =
  | { user: { id: string } }
  | { error: string; status: 401 | 403 };

function errorResponse(
  error: string,
  status: number,
  errorId?: string
) {
  return NextResponse.json(
    { error, ...(errorId ? { errorId } : {}) },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

async function getAuthorizedAdmin(): Promise<AuthorizedAdmin> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Please sign in again.", status: 401 };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Admin authorization profile lookup failed:", error.message);
    return {
      error: "Could not verify administrator permissions.",
      status: 403,
    };
  }

  if (profile?.role !== "admin") {
    return {
      error: "Administrator access required.",
      status: 403,
    };
  }

  return { user: { id: user.id } };
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      `Missing server configuration: ${
        !url ? "NEXT_PUBLIC_SUPABASE_URL" : "SUPABASE_SERVICE_ROLE_KEY"
      }`
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function GET() {
  const errorId = crypto.randomUUID();
  let stage = "authorization";

  try {
    const auth = await getAuthorizedAdmin();

    if ("error" in auth) {
      return errorResponse(auth.error, auth.status);
    }

    stage = "service_client";
    const service = getServiceClient();

    stage = "profile_query";
    const { data: profiles, error: profileError } = await service
      .from("profiles")
      .select("id, full_name, role")
      .order("full_name", { ascending: true });

    if (profileError) {
      console.error(`[Admin API ${errorId}] Profile query failed:`, profileError.message);
      return errorResponse("Could not load student profiles.", 500, errorId);
    }

    stage = "auth_user_query";
    const { data: authData, error: usersError } =
      await service.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

    if (usersError) {
      console.error(`[Admin API ${errorId}] Auth user query failed:`, usersError.message);
      return errorResponse(
        "Could not load account email addresses.",
        500,
        errorId
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

    return NextResponse.json(
      { users },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error(`[Admin API ${errorId}] Failed at ${stage}:`, error);

    return errorResponse(
      "An unexpected server error occurred.",
      500,
      errorId
    );
  }
}

export async function PATCH(request: NextRequest) {
  const errorId = crypto.randomUUID();
  let stage = "authorization";

  try {
    const auth = await getAuthorizedAdmin();

    if ("error" in auth) {
      return errorResponse(auth.error, auth.status);
    }

    let body: { userId?: string; role?: Role };

    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid request body.", 400);
    }

    const { userId, role } = body;

    if (
      typeof userId !== "string" ||
      !userId.trim() ||
      (role !== "student" && role !== "admin")
    ) {
      return errorResponse("Choose a valid user and role.", 400);
    }

    if (userId === auth.user.id && role !== "admin") {
      return errorResponse(
        "You cannot remove your own administrator role here.",
        400
      );
    }

    stage = "service_client";
    const service = getServiceClient();

    stage = "target_profile_query";
    const { data: target, error: targetError } = await service
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();

    if (targetError) {
      console.error(`[Admin API ${errorId}] Target lookup failed:`, targetError.message);
      return errorResponse(
        "Could not verify the selected account.",
        500,
        errorId
      );
    }

    if (!target) {
      return errorResponse("This user profile could not be found.", 404);
    }

    if (target.role === role) {
      return NextResponse.json({
        message: "The user already has this role.",
      });
    }

    if (target.role === "admin" && role === "student") {
      stage = "admin_count_query";

      const { count, error: countError } = await service
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");

      if (countError) {
        console.error(`[Admin API ${errorId}] Admin count failed:`, countError.message);
        return errorResponse(
          "Could not verify administrator accounts.",
          500,
          errorId
        );
      }

      if ((count ?? 0) <= 1) {
        return errorResponse(
          "You cannot remove the last administrator.",
          400
        );
      }
    }

    stage = "role_update";
    const { data: updatedProfiles, error: updateError } = await service
      .from("profiles")
      .update({ role })
      .eq("id", userId)
      .select("id");

    if (updateError) {
      console.error(`[Admin API ${errorId}] Role update failed:`, updateError.message);
      return errorResponse(
        "Could not update this user's role.",
        500,
        errorId
      );
    }

    if (!updatedProfiles || updatedProfiles.length === 0) {
      return errorResponse(
        "The role was not changed. Check database permissions.",
        500,
        errorId
      );
    }

    return NextResponse.json({
      message:
        role === "admin"
          ? "User successfully promoted to administrator."
          : "Administrator role changed to student.",
    });
  } catch (error) {
    console.error(`[Admin API ${errorId}] Failed at ${stage}:`, error);

    return errorResponse(
      "An unexpected server error occurred.",
      500,
      errorId
    );
  }
}
