
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ quizId: string }>;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  { params }: RouteContext
) {
  try {
    const supabase = await createClient();

    // 1. Get quiz ID from route parameters, with URL fallback
    const routeParams = await params;

    const urlQuizId = new URL(request.url)
      .pathname.split("/")
      .filter(Boolean)
      .pop();

    const quizId =
      routeParams?.quizId && routeParams.quizId !== "undefined"
        ? routeParams.quizId
        : urlQuizId;

    if (!quizId || !UUID_REGEX.test(quizId)) {
      console.error("INVALID QUIZ ID:", {
        routeQuizId: routeParams?.quizId,
        urlQuizId,
      });

      return NextResponse.json(
        { error: "A valid quiz ID is required." },
        { status: 400 }
      );
    }

    // 2. Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please sign in to access this quiz." },
        { status: 401 }
      );
    }

    // 3. Verify student role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("PROFILE LOOKUP ERROR:", profileError);

      return NextResponse.json(
        { error: "Unable to verify your student account." },
        { status: 500 }
      );
    }

    if (profile?.role !== "student") {
      return NextResponse.json(
        { error: "Student access is required." },
        { status: 403 }
      );
    }

    // 4. Verify enrollment
    const { data: enrollment, error: enrollmentError } = await supabase
      .from("enrollments")
      .select("payment_status, access_granted")
      .eq("user_id", user.id)
      .eq("payment_status", "verified")
      .eq("access_granted", true)
      .maybeSingle();

    if (enrollmentError) {
      console.error("ENROLLMENT CHECK ERROR:", enrollmentError);

      return NextResponse.json(
        { error: "Unable to verify your course enrollment." },
        { status: 500 }
      );
    }

    if (!enrollment) {
      return NextResponse.json(
        { error: "No verified course enrollment was found for this account." },
        { status: 403 }
      );
    }

    // 5. Find published quiz
    console.log("LOADING QUIZ:", quizId);

    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .select("id, title, module_id, is_final_exam, published")
      .eq("id", quizId)
      .eq("published", true)
      .maybeSingle();

    if (quizError) {
      console.error("QUIZ LOOKUP ERROR:", {
        quizId,
        message: quizError.message,
        code: quizError.code,
        details: quizError.details,
        hint: quizError.hint,
      });

      return NextResponse.json(
        { error: "Unable to check quiz availability." },
        { status: 500 }
      );
    }

    if (!quiz) {
      return NextResponse.json(
        { error: "Quiz not found or hidden by database permissions." },
        { status: 404 }
      );
    }

    // 6. Load questions without exposing correct answers
    const { data: questions, error: questionsError } = await supabase
      .from("quiz_questions")
      .select("id, question, options, question_number")
      .eq("quiz_id", quizId)
      .order("question_number", { ascending: true });

    if (questionsError) {
      console.error("QUESTION LOAD ERROR:", questionsError);

      return NextResponse.json(
        { error: "Unable to load quiz questions." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      quiz,
      questions: questions ?? [],
    });

  } catch (error) {
    console.error("LOAD STUDENT QUIZ ERROR:", error);

    return NextResponse.json(
      { error: "Unable to load this quiz. Please try again." },
      { status: 500 }
    );
  }
}
