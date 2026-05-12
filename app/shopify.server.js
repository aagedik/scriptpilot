import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

// Diagnostic wrapper around PrismaSessionStorage to track session operations
class DiagnosticsSessionStorage {
  constructor(sessionStorage) {
    this.sessionStorage = sessionStorage;
  }

  async storeSession(session) {
    console.log("[SESSION-DIAGNOSTICS][storeSession]", {
      shop: session.shop,
      isOnline: session.isOnline,
      hasAccessToken: !!session.accessToken,
      hasOfflineToken: !session.isOnline,
      sessionId: session.id,
      scope: session.scope,
      expires: session.expires,
    });
    try {
      const result = await this.sessionStorage.storeSession(session);
      console.log("[SESSION-DIAGNOSTICS][storeSession][success]", {
        shop: session.shop,
        isOnline: session.isOnline,
      });
      return result;
    } catch (error) {
      console.error("[SESSION-DIAGNOSTICS][storeSession][error]", {
        shop: session.shop,
        isOnline: session.isOnline,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
      });
      throw error;
    }
  }

  async loadSession(id) {
    console.log("[SESSION-DIAGNOSTICS][loadSession]", {
      sessionId: id,
    });
    try {
      const session = await this.sessionStorage.loadSession(id);
      console.log("[SESSION-DIAGNOSTICS][loadSession][result]", {
        sessionId: id,
        found: !!session,
        shop: session?.shop,
        isOnline: session?.isOnline,
      });
      return session;
    } catch (error) {
      console.error("[SESSION-DIAGNOSTICS][loadSession][error]", {
        sessionId: id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
      });
      throw error;
    }
  }

  async deleteSession(id) {
    console.log("[SESSION-DIAGNOSTICS][deleteSession]", {
      sessionId: id,
    });
    try {
      const result = await this.sessionStorage.deleteSession(id);
      console.log("[SESSION-DIAGNOSTICS][deleteSession][success]", {
        sessionId: id,
      });
      return result;
    } catch (error) {
      console.error("[SESSION-DIAGNOSTICS][deleteSession][error]", {
        sessionId: id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
      });
      throw error;
    }
  }

  async findSessionsByShop(shop) {
    console.log("[SESSION-DIAGNOSTICS][findSessionsByShop]", {
      shop,
    });
    try {
      const sessions = await this.sessionStorage.findSessionsByShop(shop);
      console.log("[SESSION-DIAGNOSTICS][findSessionsByShop][result]", {
        shop,
        count: sessions?.length || 0,
        sessions: sessions?.map(s => ({ id: s.id, isOnline: s.isOnline })),
      });
      return sessions;
    } catch (error) {
      console.error("[SESSION-DIAGNOSTICS][findSessionsByShop][error]", {
        shop,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
      });
      throw error;
    }
  }

  async deleteSessions(shop) {
    console.log("[SESSION-DIAGNOSTICS][deleteSessions]", {
      shop,
    });
    try {
      const result = await this.sessionStorage.deleteSessions(shop);
      console.log("[SESSION-DIAGNOSTICS][deleteSessions][success]", {
        shop,
      });
      return result;
    } catch (error) {
      console.error("[SESSION-DIAGNOSTICS][deleteSessions][error]", {
        shop,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
      });
      throw error;
    }
  }
}

const prismaSessionStorage = new PrismaSessionStorage(prisma);
const diagnosticsSessionStorage = new DiagnosticsSessionStorage(prismaSessionStorage);

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: diagnosticsSessionStorage,
  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.January25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
