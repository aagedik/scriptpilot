import { createCookie } from "@remix-run/node";

const HOST_COOKIE_NAME = "__shopify_app_host";

const hostCookie = createCookie(HOST_COOKIE_NAME, {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/app",
  maxAge: 60 * 60 * 24 * 7, // 7 days
});

export async function resolveShopifyHost(request, fallbackHost) {
  const url = new URL(request.url);
  const hostParam = url.searchParams.get("host");
  const cookieHeader = request.headers.get("Cookie");
  const storedHost = cookieHeader ? await hostCookie.parse(cookieHeader) : null;
  const host = hostParam || fallbackHost || storedHost || null;

  let setCookieHeader = null;

  if (hostParam && hostParam !== storedHost) {
    setCookieHeader = await hostCookie.serialize(hostParam);
  } else if (!hostParam && fallbackHost && fallbackHost !== storedHost) {
    setCookieHeader = await hostCookie.serialize(fallbackHost);
  }

  return {
    host,
    setCookie: setCookieHeader,
    source: hostParam ? "query" : fallbackHost ? "session" : storedHost ? "cookie" : "none",
  };
}

export async function clearShopifyHostCookie() {
  return hostCookie.serialize("", { maxAge: 0 });
}
