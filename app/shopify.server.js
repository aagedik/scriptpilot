import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

class TracingPrismaSessionStorage extends PrismaSessionStorage {
  async storeSession(session) {
    console.log("[SESSION-TRACE][storeSession] called", {
      sessionId: session.id,
      shop: session.shop,
      isOnline: session.isOnline,
      hasAccessToken: !!session.accessToken,
    });
    try {
      const result = await super.storeSession(session);
      console.log("[SESSION-TRACE][storeSession] success", {
        sessionId: session.id,
        shop: session.shop,
        isOnline: session.isOnline,
      });
      return result;
    } catch (error) {
      console.error("[SESSION-TRACE][storeSession] error", {
        sessionId: session.id,
        shop: session.shop,
        isOnline: session.isOnline,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new TracingPrismaSessionStorage(prisma),
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    expiringOfflineAccessTokens: true,
  },
});

export default shopify;
export const apiVersion = ApiVersion.January25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
