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

    // Webhook requests can trigger multiple times and after an app has already been uninstalled.
    // If this webhook already ran, the session may have been deleted previously.
    if (session) {
      try {
        // Find the shop record
        const shopRecord = await prisma.shop.findUnique({
          where: { shopifyDomain: shop }
        });
        
        if (shopRecord) {
          // Deactivate all scripts for this shop (before deletion for cleanup)
          await prisma.script.updateMany({
            where: { shopId: shopRecord.id },
            data: { status: false }
          });
          
          // Delete all scripts for this shop
          await prisma.script.deleteMany({
            where: { shopId: shopRecord.id }
          });
          
          // Delete the shop record
          await prisma.shop.delete({
            where: { id: shopRecord.id }
          });
          
          debugLog(`ScriptPilot: Deactivated and deleted shop and scripts for ${shop}`);
        }
        
        // Delete session
        await prisma.session.deleteMany({ where: { shop } });
        
        debugLog(`ScriptPilot: Cleanup completed for ${shop}`);
      } catch (error) {
        console.error(`ScriptPilot: Error during cleanup for ${shop}:`, error);
      }
    }

    return new Response();
  } catch (error) {
    console.error("Webhook verification failed:", error);
    return new Response("Webhook verification failed", { status: 401 });
  }
};
