import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { validateWebhookRequest, getShopifyWebhookSecret } from "../services/webhook.server";

const shouldLog = process.env.NODE_ENV !== "production";
const debugLog = (...args) => {
  if (shouldLog) {
    console.log(...args);
  }
};

export const action = async ({ request }) => {
  try {
    // Verify webhook signature for security
    const body = await validateWebhookRequest(request, getShopifyWebhookSecret());
    const { shop, session, topic } = await authenticate.webhook(request);

    debugLog(`ScriptPilot: Received ${topic} webhook for ${shop}`);

    if (session) {
      try {
        // Update shop's last activity
        await prisma.shop.update({
          where: { shopifyDomain: shop },
          data: { lastActivityAt: new Date() }
        });

        debugLog(`ScriptPilot: Updated shop activity for ${shop}`);
      } catch (error) {
        console.error(`ScriptPilot: Error during shop update for ${shop}:`, error);
      }
    }

    return new Response();
  } catch (error) {
    console.error("Webhook verification failed:", error);
    return new Response("Webhook verification failed", { status: 401 });
  }
};
