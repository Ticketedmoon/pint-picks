import { NextRequest, NextResponse } from "next/server";
import { getResend, getFromEmail } from "@/lib/resend";
import { buildInvalidPicksEmail } from "@/lib/emailTemplates";
import { logger } from "@/lib/logger";

interface InvalidMember {
  email: string;
  displayName: string;
  invalidPlayers: string[];
}

export async function POST(request: NextRequest) {
  const start = Date.now();
  const route = "/api/notify-invalid-picks";
  try {
    const resend = getResend();
    const { partyId, partyName, invalidMembers } = (await request.json()) as {
      partyId: string;
      partyName: string;
      invalidMembers: InvalidMember[];
    };

    if (!partyId || typeof partyId !== "string") {
      return NextResponse.json({ error: "Missing partyId" }, { status: 400 });
    }
    if (!partyName || typeof partyName !== "string") {
      return NextResponse.json({ error: "Missing partyName" }, { status: 400 });
    }
    if (!invalidMembers || !Array.isArray(invalidMembers) || invalidMembers.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0 });
    }
    if (invalidMembers.length > 50) {
      return NextResponse.json({ error: "Too many members (max 50)" }, { status: 400 });
    }

    const baseUrl = request.headers.get("origin") || "http://localhost:3000";
    const picksUrl = `${baseUrl}/party/${partyId}/picks`;

    const results = await Promise.allSettled(
      invalidMembers.map((member) => {
        const template = buildInvalidPicksEmail({
          displayName: member.displayName,
          partyName,
          invalidPlayers: member.invalidPlayers,
          picksUrl,
        });
        return resend.emails.send({
          from: getFromEmail(),
          to: member.email,
          subject: template.subject,
          html: template.html,
        });
      })
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    logger.info({ route, method: "POST", status: 200, durationMs: Date.now() - start, sent, failed, total: invalidMembers.length });
    return NextResponse.json({ sent, failed, total: invalidMembers.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error({ route, method: "POST", status: 500, durationMs: Date.now() - start, error: message });
    return NextResponse.json(
      { error: "Failed to send notifications" },
      { status: 500 }
    );
  }
}
