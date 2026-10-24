
import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";



type Role = "student" | "admin";

type AdminAuth =
  | { user: { id: string } }
  | { error: string; status: 401 | 403 };

function respond(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function getAuthorizedAdmin(): Promise<AdminAuth> {
  let supabase;

  try {
    supabase = await createClient();
  } catch (error) {
    console.error("Admin authorization client failed:", error);
    return {
      error: "Could not initialize authentication. Check server configuration.",
      status: 403,
    };
  }

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
    console.error("Admin profile authorization failed:", error.message);
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
      `Missing environment variable: ${
        !url
          ? "NEXT_PUBLIC_SUPABASE_URL"
          : "SUPABASE_SERVICE_ROLE_KEY"
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
      return respond({ error: auth.error }, auth.status);
    }

    stage = "service_client_initialization";
    const service = getServiceClient();

    stage = "profiles_query";
    const { data: profiles, error: profileError } = await service
      .from("profiles")
      .select("id, full_name, role")
      .order("full_name", { ascending: true });

    if (profileError) {
      console.error(`[${errorId}] ${stage}:`, profileError.message);
      return respond(
        {
          error: "Could not load student profiles.",
          errorId,
        },
        500
      );
    }

    stage = "auth_users_query";
    const { data: authData, error: usersError } =
      await service.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

    if (usersError) {
      console.error(`[${errorId}] ${stage}:`, usersError.message);
      return respond(
        {
          error: "Could not load account email addresses.",
          errorId,
        },
        500
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

    return respond({ users });
  } catch (error) {
    console.error(`[Admin GET ${errorId}] Failed at ${stage}:`, error);

    return respond(
      {
        error: "An unexpected server error occurred.",
        errorId,
        stage,
      },
      500
    );
  }
}

export async function PATCH(request: NextRequest) {
  const errorId = crypto.randomUUID();
  let stage = "authorization";

  try {
    const auth = await getAuthorizedAdmin();

    if ("error" in auth) {
      return respond({ error: auth.error }, auth.status);
    }

    let body: { userId?: string; role?: Role };

    try {
      body = await request.json();
    } catch {
      return respond({ error: "Invalid request body." }, 400);
    }

    const { userId, role } = body;

    if (
      typeof userId !== "string" ||
      !userId.trim() ||
      (role !== "student" && role !== "admin")
    ) {
      return respond(
        { error: "Choose a valid user and role." },
        400
      );
    }

    if (userId === auth.user.id && role !== "admin") {
      return respond(
        {
          error:
            "You cannot remove your own administrator role here.",
        },
        400
      );
    }

    stage = "service_client_initialization";
    const service = getServiceClient();

    stage = "target_profile_query";
    const { data: target, error: targetError } = await service
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();

    if (targetError) {
      console.error(`[${errorId}] ${stage}:`, targetError.message);
      return respond(
        { error: "Could not verify the selected account.", errorId },
        500
      );
    }

    if (!target) {
      return respond(
        { error: "This user profile could not be found." },
        404
      );
    }

    if (target.role === role) {
      return respond({ message: "The user already has this role." });
    }

    if (target.role === "admin" && role === "student") {
      stage = "administrator_count_query";

      const { count, error: countError } = await service
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");

      if (countError) {
        console.error(`[${errorId}] ${stage}:`, countError.message);
        return respond(
          {
            error: "Could not verify administrator accounts.",
            errorId,
          },
          500
        );
      }

      if ((count ?? 0) <= 1) {
        return respond(
          { error: "You cannot remove the last administrator." },
          400
        );
      }
    }

    stage = "role_update";
    const { data: updated, error: updateError } = await service
      .from("profiles")
      .update({ role })
      .eq("id", userId)
      .select("id");

    if (updateError) {
      console.error(`[${errorId}] ${stage}:`, updateError.message);
      return respond(
        { error: "Could not update this user's role.", errorId },
        500
      );
    }

    if (!updated || updated.length === 0) {
      return respond(
        {
          error: "No profile was updated. Verify the selected account.",
          errorId,
        },
        500
      );
    }

    return respond({
      message:
        role === "admin"
          ? "User successfully promoted to administrator."
          : "Administrator role changed to student.",
    });
  } catch (error) {
    console.error(`[Admin PATCH ${errorId}] Failed at ${stage}:`, error);

    return respond(
      {
        error: "An unexpected server error occurred.",
        errorId,
        stage,
      },
      500
    );
  }
}
