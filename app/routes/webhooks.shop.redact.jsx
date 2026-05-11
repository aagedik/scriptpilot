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
        // Parse shop redact request
        const data = JSON.parse(body);
        const shopDomain = data.myshopify_domain;

        debugLog(`ScriptPilot: Shop redact request for ${shopDomain}`);

        // Find the shop record
        const shopRecord = await prisma.shop.findUnique({
          where: { shopifyDomain: shop }
        });

        if (shopRecord) {
          // Permanently delete all shop data for GDPR compliance
          // This is more aggressive than app/uninstalled - it's for shop deletion/redaction
          
          // Delete all scripts for this shop
          await prisma.script.deleteMany({
            where: { shopId: shopRecord.id }
          });
          
          // Delete the shop record
          await prisma.shop.delete({
            where: { id: shopRecord.id }
          });
          
          // Delete session
          await prisma.session.deleteMany({ where: { shop } });
          
          debugLog(`ScriptPilot: Shop redaction completed for ${shop}`);
        }
      } catch (error) {
        console.error(`ScriptPilot: Error during shop redact for ${shop}:`, error);
      }
    }

    return new Response();
  } catch (error) {
    console.error("Webhook verification failed:", error);
    return new Response("Webhook verification failed", { status: 401 });
  }
};
