import { authenticate } from "../shopify.server";

const AUTH_DEBUG_PREFIX = "[auth-debug][auth.$]";
const logAuthDebug = (stage, payload) => {
  try {
    console.info(`${AUTH_DEBUG_PREFIX}[${stage}]`, JSON.stringify(payload));
  } catch (error) {
    console.info(`${AUTH_DEBUG_PREFIX}[${stage}]`, payload);
  }
};

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  logAuthDebug("loader:start", {
    url: url.toString(),
    pathname: url.pathname,
    search: url.search,
    method: request.method,
  });

  try {
    const response = await authenticate.admin(request);
    logAuthDebug("loader:success", {
      hasHeaders: Boolean(response?.headers),
      responseType: response ? typeof response : "null",
    });
    return response;
  } catch (error) {
    if (error instanceof Response) {
      logAuthDebug("loader:redirect", {
        status: error.status,
        statusText: error.statusText,
        location: error.headers.get("Location"),
      });
      throw error;
    }

    logAuthDebug("loader:error", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
    });
    throw error;
  }
};
