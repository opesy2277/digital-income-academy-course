
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type SubmittedAnswer = {
  question_number: number;
  selected_option: number;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const quizId = body.quizId;
    const answers = body.answers as SubmittedAnswer[];

    if (
      typeof quizId !== "string" ||
      !Array.isArray(answers)
    ) {
      return NextResponse.json(
        { error: "Invalid quiz submission." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please sign in before submitting." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "student") {
      return NextResponse.json(
        { error: "Only students can submit quiz attempts." },
        { status: 403 }
      );
    }

    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .select("id, published")
      .eq("id", quizId)
      .eq("published", true)
      .maybeSingle();

    if (quizError || !quiz) {
      return NextResponse.json(
        { error: "This quiz is unavailable or unpublished." },
        { status: 404 }
      );
    }

    const { data: questions, error: questionsError } = await supabase
      .from("quiz_questions")
      .select("question_number, options, correct_answer")
      .eq("quiz_id", quizId)
      .order("question_number", { ascending: true });

    if (questionsError) {
      throw questionsError;
    }

    if (!questions || questions.length === 0) {
      return NextResponse.json(
        { error: "This quiz has no questions." },
        { status: 400 }
      );
    }

    if (answers.length !== questions.length) {
      return NextResponse.json(
        { error: "Please answer every question before submitting." },
        { status: 400 }
      );
    }

    const answerMap = new Map<number, number>();

    for (const answer of answers) {
      if (
        !Number.isInteger(answer.question_number) ||
        !Number.isInteger(answer.selected_option) ||
        answer.selected_option < 0 ||
        answerMap.has(answer.question_number)
      ) {
        return NextResponse.json(
          { error: "Your submitted answers are invalid." },
          { status: 400 }
        );
      }

      answerMap.set(
        answer.question_number,
        answer.selected_option
      );
    }

    let score = 0;

    for (const question of questions) {
      const options = Array.isArray(question.options)
        ? question.options
        : [];

      const selectedOption = answerMap.get(
        question.question_number
      );

      if (
        selectedOption === undefined ||
        selectedOption >= options.length
      ) {
        return NextResponse.json(
          { error: "One or more selected options are invalid." },
          { status: 400 }
        );
      }

      const correctAnswer = Number(question.correct_answer);

      if (
        Number.isInteger(correctAnswer) &&
        selectedOption === correctAnswer
      ) {
        score++;
      }
    }

    const savedAnswers = questions.map((question) => ({
      question_number: question.question_number,
      selected_option: answerMap.get(question.question_number),
    }));

    const { data: attempt, error: insertError } = await supabase
      .from("quiz_attempts")
      .insert({
        user_id: user.id,
        quiz_id: quizId,
        score,
        total_questions: questions.length,
        answers: savedAnswers,
      })
      .select("id, score, total_questions, submitted_at, answers")
      .single();

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      attempt,
      percentage: Math.round(
        (score / questions.length) * 100
      ),
    });
  } catch (error) {
    console.error("SUBMIT STUDENT QUIZ ERROR:", error);

    return NextResponse.json(
      { error: "Unable to submit your quiz. Please try again." },
      { status: 500 }
    );
  }
}
