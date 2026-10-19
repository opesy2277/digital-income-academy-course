
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const secret = process.env.SELAR_WEBHOOK_SECRET;
  const suppliedSecret = request.headers.get("x-selar-webhook-secret");

  if (!secret || !suppliedSecret || suppliedSecret !== secret) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  // Safe placeholder: no enrollment or course access is granted.
  // Payment verification must be implemented before processing sales.

  return NextResponse.json({
    received: true,
    processed: false,
    message: "Payment verification is not configured yet.",
  });
}
