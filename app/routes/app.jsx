import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";
import { resolveShopifyHost } from "../utils/host.server";
import AppBridgeDiagnostics from "../components/AppBridgeDiagnostics";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {
  const auth = await authenticate.admin(request);
  const { session, headers, admin } = auth;
  const url = new URL(request.url);

  const { host: resolvedHost, setCookie, source: hostSource } = await resolveShopifyHost(
    request,
    session?.host ?? null,
  );

  const data = {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    host: resolvedHost,
    shop: session?.shop ?? url.searchParams.get("shop") ?? null,
  };

  const responseHeaders = headers ? new Headers(headers) : new Headers();
  if (setCookie) {
    responseHeaders.append("Set-Cookie", setCookie);
  }

  return json(data, responseHeaders.size ? { headers: responseHeaders } : {});
};

export default function App() {
  const { apiKey, host, shop } = useLoaderData();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <AppBridgeDiagnostics apiKey={apiKey} host={host} shop={shop} />
      <NavMenu>
        <Link to="/app" rel="home" aria-label="Dashboard">
          Dashboard
        </Link>
        <Link to="/app/scripts" aria-label="Scripts">
          Scripts
        </Link>
        <Link to="/app/settings" aria-label="Settings">
          Settings
        </Link>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
