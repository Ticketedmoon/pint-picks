import { NextRequest, NextResponse } from "next/server";
import { collection, getDocs } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { getResend, getFromEmail } from "@/lib/resend";
import { buildMajorReminderEmail } from "@/lib/emailTemplates";
import { fetchCurrentTournaments } from "@/lib/espn";
import { logger } from "@/lib/logger";

const DAYS_BEFORE = 7; // notify when major is within 7 days

/**
 * POST /api/notify-major
 *
 * Checks for upcoming majors within the next 7 days and emails all
 * registered users a reminder. Designed to be called from a cron job
 * (e.g. Vercel Cron) or manually by the admin.
 *
 * Expects an Authorization header with the CRON_SECRET to prevent
 * unauthorized triggers.
 */
export async function POST(request: NextRequest) {
  const start = Date.now();
  const route = "/api/notify-major";

  // Simple auth check for cron/admin
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      logger.warn({ route, method: "POST", status: 401, error: "Unauthorized" });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    // Find upcoming majors within the notification window
    const tournaments = await fetchCurrentTournaments();
    const now = Date.now();
    const cutoff = now + DAYS_BEFORE * 24 * 60 * 60 * 1000;

    const upcomingMajors = tournaments.filter((t) => {
      if (!t.isMajor) return false;
      const startMs = new Date(t.startDate).getTime();
      return startMs > now && startMs <= cutoff;
    });

    if (upcomingMajors.length === 0) {
      logger.info({ route, method: "POST", status: 200, durationMs: Date.now() - start, message: "No upcoming majors" });
      return NextResponse.json({ sent: 0, message: "No upcoming majors within notification window" });
    }

    // Get all registered users from analytics_last_visit (best proxy for active users)
    const db = getFirebaseDb();
    const usersSnap = await getDocs(collection(db, "analytics_last_visit"));
    const users = usersSnap.docs
      .map((d) => ({ uid: d.id, email: d.data().email as string | null, displayName: d.data().displayName as string | null }))
      .filter((u) => u.email);

    if (users.length === 0) {
      logger.info({ route, method: "POST", status: 200, durationMs: Date.now() - start, message: "No users to notify" });
      return NextResponse.json({ sent: 0, message: "No users with emails found" });
    }

    const resend = getResend();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin") || "http://localhost:3000";
    let totalSent = 0;
    let totalFailed = 0;

    for (const major of upcomingMajors) {
      const results = await Promise.allSettled(
        users.map((user) => {
          const template = buildMajorReminderEmail({
            displayName: user.displayName || "Golfer",
            tournamentName: major.name,
            courseName: major.courseName,
            startDate: major.startDate,
            createPartyUrl: `${baseUrl}/party/create`,
          });
          return resend.emails.send({
            from: getFromEmail(),
            to: user.email!,
            subject: template.subject,
            html: template.html,
          });
        })
      );

      totalSent += results.filter((r) => r.status === "fulfilled").length;
      totalFailed += results.filter((r) => r.status === "rejected").length;
    }

    logger.info({
      route,
      method: "POST",
      status: 200,
      durationMs: Date.now() - start,
      majors: upcomingMajors.map((m) => m.name),
      users: users.length,
      sent: totalSent,
      failed: totalFailed,
    });

    return NextResponse.json({
      sent: totalSent,
      failed: totalFailed,
      majors: upcomingMajors.map((m) => m.name),
      users: users.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ route, method: "POST", status: 500, durationMs: Date.now() - start, error: message });
    return NextResponse.json({ error: "Failed to send major reminders" }, { status: 500 });
  }
}
