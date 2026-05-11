import { createCookieSessionStorage } from "@remix-run/node";

// Secure cookie session storage for admin authentication
// Uses HTTP-only, secure cookies with proper expiration

const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-change-in-production";

if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("SESSION_SECRET environment variable is required in production");
}

export const adminSessionStorage = createCookieSessionStorage({
  cookie: {
    name: "scriptpilot_admin",
    httpOnly: true,
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
    sameSite: "lax",
    secrets: [SESSION_SECRET],
    secure: process.env.NODE_ENV === "production",
  },
});

export async function getAdminSession(request) {
  const session = await adminSessionStorage.getSession(request.headers.get("Cookie"));
  return session.get("admin") || null;
}

export async function createAdminSession(email, redirectUrl) {
  const session = await adminSessionStorage.getSession();
  session.set("admin", email);
  session.set("createdAt", new Date().toISOString());
  
  return adminSessionStorage.commitSession(session, {
    headers: {
      "Set-Cookie": await adminSessionStorage.commitSession(session),
    },
  });
}

export async function destroyAdminSession(request) {
  const session = await adminSessionStorage.getSession(request.headers.get("Cookie"));
  return adminSessionStorage.destroySession(session);
}

export async function requireAdminSession(request) {
  const admin = await getAdminSession(request);
  if (!admin) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return admin;
}

export async function createAdminHeaders(email) {
  const session = await adminSessionStorage.getSession();
  session.set("admin", email);
  session.set("createdAt", new Date().toISOString());
  
  const cookie = await adminSessionStorage.commitSession(session);
  
  return {
    "Set-Cookie": cookie,
  };
}
