import { NextRequest, NextResponse } from "next/server";
import { getResend, getFromEmail } from "@/lib/resend";
import { buildInviteEmail } from "@/lib/emailTemplates";

export async function POST(request: NextRequest) {
  try {
    const resend = getResend();
    const { emails, partyName, inviteCode, invitedBy } = await request.json();

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: "No emails provided" }, { status: 400 });
    }
    if (!partyName || typeof partyName !== "string") {
      return NextResponse.json({ error: "Missing partyName" }, { status: 400 });
    }
    if (!inviteCode || typeof inviteCode !== "string") {
      return NextResponse.json({ error: "Missing inviteCode" }, { status: 400 });
    }
    if (emails.length > 20) {
      return NextResponse.json({ error: "Too many emails (max 20)" }, { status: 400 });
    }

    // Validate each email is a string with basic format
    const validEmails = emails.filter(
      (e: unknown) => typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
    );
    if (validEmails.length === 0) {
      return NextResponse.json({ error: "No valid emails provided" }, { status: 400 });
    }

    const baseUrl = request.headers.get("origin") || "http://localhost:3000";
    const joinUrl = `${baseUrl}/party/join?code=${inviteCode}`;
    const template = buildInviteEmail({ invitedBy, partyName, joinUrl, inviteCode });

    const results = await Promise.allSettled(
      validEmails.map((email: string) =>
        resend.emails.send({
          from: getFromEmail(),
          to: email,
          subject: template.subject,
          html: template.html,
        })
      )
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return NextResponse.json({ sent, failed, total: emails.length });
  } catch (error) {
    console.error("Email invite error:", error);
    return NextResponse.json(
      { error: "Failed to send invites" },
      { status: 500 }
    );
  }
}
