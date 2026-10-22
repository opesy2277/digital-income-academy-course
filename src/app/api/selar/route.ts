
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const secret = process.env.SELAR_WEBHOOK_SECRET;
  const suppliedSecret = request.headers.get(
    "x-selar-webhook-secret"
  );

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

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body)
  ) {
    return NextResponse.json(
      { error: "Expected a JSON object" },
      { status: 400 }
    );
  }

  const sale = body as Record<string, unknown>;

  const buyerEmail =
    typeof sale.buyer_email === "string"
      ? sale.buyer_email.trim().toLowerCase()
      : "";

  const productId =
    typeof sale.product_id === "string" ||
    typeof sale.product_id === "number"
      ? String(sale.product_id)
      : "";

  if (!buyerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) {
    return NextResponse.json(
      { error: "A valid buyer email is required" },
      { status: 400 }
    );
  }

  if (!productId) {
    return NextResponse.json(
      { error: "Product ID is required" },
      { status: 400 }
    );
  }

  // Deliberately do not grant access.
  // Trusted payment verification and duplicate-sale protection
  // must be implemented before processing enrollments.

  return NextResponse.json(
    {
      received: true,
      processed: false,
      message: "Sale received; payment verification is not configured.",
    },
    { status: 202 }
  );
}
