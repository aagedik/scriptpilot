import crypto from "crypto";

// Shopify Webhook HMAC Signature Verification
// Critical for production security and compliance

export function verifyWebhookHMAC(body, hmac, shopifyWebhookSecret) {
  const calculatedHmac = crypto
    .createHmac("sha256", shopifyWebhookSecret)
    .update(body, "utf8")
    .digest("base64");

  return crypto.timingSafeEqual(
    Buffer.from(calculatedHmac),
    Buffer.from(hmac)
  );
}

export async function validateWebhookRequest(request, shopifyWebhookSecret) {
  const hmac = request.headers.get("x-shopify-hmac-sha256");
  const body = await request.text();

  if (!hmac) {
    throw new Error("Missing HMAC header");
  }

  const isValid = verifyWebhookHMAC(body, hmac, shopifyWebhookSecret);

  if (!isValid) {
    throw new Error("Invalid webhook signature");
  }

  return body;
}

export function getShopifyWebhookSecret() {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) {
    throw new Error("SHOPIFY_API_SECRET environment variable is required");
  }
  return secret;
}
