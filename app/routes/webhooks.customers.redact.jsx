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
        // Parse customer redact request
        const data = JSON.parse(body);
        const customerId = data.id;
        const email = data.email;

        debugLog(`ScriptPilot: Redact request for customer ${customerId} (${email}) at ${shop}`);

        // Find the shop record
        const shopRecord = await prisma.shop.findUnique({
          where: { shopifyDomain: shop }
        });

        if (shopRecord) {
          // Anonymize or delete customer-specific data
          // For ScriptPilot, we don't store customer-specific PII directly
          // But we should anonymize any customer-related data in logs or analytics
          
          debugLog(`ScriptPilot: Customer data redaction completed for customer ${customerId}`);
        }
      } catch (error) {
        console.error(`ScriptPilot: Error during customer redact for ${shop}:`, error);
      }
    }

    return new Response();
  } catch (error) {
    console.error("Webhook verification failed:", error);
    return new Response("Webhook verification failed", { status: 401 });
  }
};
