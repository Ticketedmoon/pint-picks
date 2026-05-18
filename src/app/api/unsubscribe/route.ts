import { NextRequest, NextResponse } from "next/server";
import { doc, updateDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { logger } from "@/lib/logger";

/**
 * POST /api/unsubscribe
 * Sets emailOptOut: true on the user's document to stop marketing emails.
 */
export async function POST(request: NextRequest) {
  const start = Date.now();
  const route = "/api/unsubscribe";
  try {
    const { uid } = (await request.json()) as { uid: string };
    if (!uid || typeof uid !== "string") {
      logger.warn({ route, method: "POST", status: 400, error: "Missing uid" });
      return NextResponse.json({ error: "Missing uid" }, { status: 400 });
    }

    const db = getFirebaseDb();
    await updateDoc(doc(db, "users", uid), { emailOptOut: true });

    logger.info({ route, method: "POST", status: 200, durationMs: Date.now() - start, uid });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ route, method: "POST", status: 500, durationMs: Date.now() - start, error: message });
    return NextResponse.json({ error: "Failed to unsubscribe" }, { status: 500 });
  }
}
