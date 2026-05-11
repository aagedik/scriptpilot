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
        // Parse customer data request
        const data = JSON.parse(body);
        const customerId = data.id;
        const email = data.email;

        debugLog(`ScriptPilot: Data request for customer ${customerId} (${email}) at ${shop}`);

        // Collect all data associated with this customer's shop
        const shopRecord = await prisma.shop.findUnique({
          where: { shopifyDomain: shop },
          include: { scripts: true }
        });

        if (shopRecord) {
          // Return customer data (scripts, shop info, etc.)
          const customerData = {
            shop: {
              shopifyDomain: shopRecord.shopifyDomain,
              plan: shopRecord.plan,
              billingStatus: shopRecord.billingStatus,
              createdAt: shopRecord.createdAt,
              lastActivityAt: shopRecord.lastActivityAt
            },
            scripts: shopRecord.scripts.map(script => ({
              name: script.name,
              description: script.description,
              scriptType: script.scriptType,
              status: script.status,
              createdAt: script.createdAt,
              updatedAt: script.updatedAt
            }))
          };

          debugLog(`ScriptPilot: Data request completed for customer ${customerId}`);
          
          // In production, this should be sent to the customer via email or secure download
          // For now, we log the data collection
        }
      } catch (error) {
        console.error(`ScriptPilot: Error during data request for ${shop}:`, error);
      }
    }

    return new Response();
  } catch (error) {
    console.error("Webhook verification failed:", error);
    return new Response("Webhook verification failed", { status: 401 });
  }
};
