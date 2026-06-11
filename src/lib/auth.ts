import { NextRequest } from "next/server";

const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

interface DecodedToken {
  uid: string;
  email?: string;
}

/**
 * Verify a Firebase ID token by calling Google's tokeninfo endpoint.
 * Returns the decoded UID and email, or null if invalid.
 *
 * This avoids pulling in the full firebase-admin SDK.
 */
export async function verifyIdToken(idToken: string): Promise<DecodedToken | null> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const user = data.users?.[0];
    if (!user?.localId) return null;
    return { uid: user.localId, email: user.email };
  } catch {
    return null;
  }
}

/**
 * Extract and verify the Firebase ID token from a request's Authorization header.
 * Expects: `Authorization: Bearer <idToken>`
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<DecodedToken | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  return verifyIdToken(token);
}
