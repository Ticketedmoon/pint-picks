import { NextRequest, NextResponse } from "next/server";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { getResend, getFromEmail } from "@/lib/resend";
import { buildMajorReminderEmail } from "@/lib/emailTemplates";
import { fetchCurrentTournaments } from "@/lib/sports/golf/espn";
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

    // Filter out majors we've already notified about (one email per major per season)
    const db = getFirebaseDb();
    const majorsToNotify = [];
    for (const major of upcomingMajors) {
      const notifDoc = await getDoc(doc(db, "major_notifications", major.id));
      if (!notifDoc.exists()) {
        majorsToNotify.push(major);
      }
    }

    if (majorsToNotify.length === 0) {
      logger.info({ route, method: "POST", status: 200, durationMs: Date.now() - start, message: "All upcoming majors already notified" });
      return NextResponse.json({ sent: 0, message: "Already sent notifications for these majors" });
    }

    // Get all registered users from the users collection
    const usersSnap = await getDocs(collection(db, "users"));
    const users = usersSnap.docs
      .map((d) => ({ uid: d.id, email: d.data().email as string | null, displayName: d.data().displayName as string | null, emailOptOut: d.data().emailOptOut as boolean | undefined }))
      .filter((u) => u.email && !u.emailOptOut);

    if (users.length === 0) {
      logger.info({ route, method: "POST", status: 200, durationMs: Date.now() - start, message: "No users to notify" });
      return NextResponse.json({ sent: 0, message: "No users with emails found" });
    }

    const resend = getResend();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin") || "http://localhost:3000";
    let totalSent = 0;
    let totalFailed = 0;

    for (const major of majorsToNotify) {
      const results = await Promise.allSettled(
        users.map((user) => {
          const template = buildMajorReminderEmail({
            displayName: user.displayName || "Golfer",
            tournamentName: major.name,
            courseName: major.courseName,
            startDate: major.startDate,
            createPartyUrl: `${baseUrl}/party/create`,
            unsubscribeUrl: `${baseUrl}/unsubscribe?uid=${user.uid}`,
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

      // Record that we've notified for this major (prevents duplicate sends)
      await setDoc(doc(db, "major_notifications", major.id), {
        tournamentName: major.name,
        notifiedAt: new Date().toISOString(),
        userCount: users.length,
        sent: results.filter((r) => r.status === "fulfilled").length,
      });
    }

    logger.info({
      route,
      method: "POST",
      status: 200,
      durationMs: Date.now() - start,
      majors: majorsToNotify.map((m) => m.name),
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
