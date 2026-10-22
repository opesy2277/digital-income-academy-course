
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      new URL("/?error=google_signin_failed", origin)
    );
  }

  const supabase = await createClient();

  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(
      new URL("/?error=google_signin_failed", origin)
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.redirect(
      new URL("/?error=google_signin_failed", origin)
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    await supabase.auth.signOut();

    return NextResponse.redirect(
      new URL("/?error=profile_not_found", origin)
    );
  }

  if (profile.role === "admin") {
    return NextResponse.redirect(new URL("/admin", origin));
  }

  if (profile.role === "student") {
    return NextResponse.redirect(new URL("/student", origin));
  }

  await supabase.auth.signOut();

  return NextResponse.redirect(
    new URL("/?error=invalid_account_role", origin)
  );
}
