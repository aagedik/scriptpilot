import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  Badge,
  Button,
  InlineStack,
  Box,
  Divider,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const AUTH_DEBUG_PREFIX = "[auth-debug][app-settings]";
const serializeHeaders = (headers) => {
  if (!headers) return null;
  try {
    return Array.from(headers.entries());
  } catch (error) {
    return `unserializable: ${error instanceof Error ? error.message : String(error)}`;
  }
};

const logAuthDebug = (stage, payload) => {
  const message = `${AUTH_DEBUG_PREFIX}[${stage}]`;
  try {
    console.info(message, JSON.stringify(payload));
  } catch (error) {
    console.info(message, payload);
  }
};

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const hostParam = url.searchParams.get("host");
  const shopParam = url.searchParams.get("shop");
  const authHeader = request.headers.get("Authorization") || request.headers.get("authorization") || null;

  logAuthDebug("loader:start", {
    url: url.toString(),
    pathname: url.pathname,
    search: url.search,
    hostParam: hostParam || null,
    shopParam: shopParam || null,
    hasAuthHeader: Boolean(authHeader),
  });

  let session;
  let headers;
  try {
    const auth = await authenticate.admin(request);
    session = auth?.session;
    headers = auth?.headers;
    const restKeys = auth ? Object.keys(auth).filter((key) => !["session", "headers"].includes(key)) : [];

    logAuthDebug("loader:success", {
      sessionShop: session?.shop ?? null,
      sessionId: session?.id ?? null,
      extraKeys: restKeys,
      returnedHeaders: serializeHeaders(headers),
    });
  } catch (error) {
    if (error instanceof Response) {
      logAuthDebug("loader:redirect", {
        status: error.status,
        statusText: error.statusText,
        location: error.headers.get("Location"),
        headers: serializeHeaders(error.headers),
      });
      throw error;
    }

    logAuthDebug("loader:error", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
    });
    throw error;
  }

  const shop = session?.shop || shopParam;
  
  // Fetch shop data with scripts
  const shopData = await prisma.shop.findUnique({
    where: { shopifyDomain: shop },
    include: { scripts: true }
  });
  
  const currentPlan = shopData?.plan || 'Free';
  const activeScripts = shopData?.scripts.filter(s => s.status).length || 0;
  const billingStatus = shopData?.billingStatus || 'active';
  const trialEndsAt = shopData?.trialEndsAt;
  const subscriptionId = shopData?.subscriptionId;
  
  // Calculate plan limits
  const planLimits = {
    free: 1,
    basic: 5,
    pro: Infinity
  };
  const usageLimit = planLimits[currentPlan] || 1;
  
  // Calculate next billing date (simplified - in production use actual billing cycle)
  const nextBillingDate = new Date();
  nextBillingDate.setDate(nextBillingDate.getDate() + 30);
  
  return json({ 
    currentPlan,
    activeConnections: activeScripts,
    usageLimit,
    billingStatus,
    trialEndsAt,
    subscriptionId,
    nextBillingDate: nextBillingDate.toISOString(),
    shopDomain: shop
  }, headers ? { headers } : {});
};

export default function SettingsPage() {
  const { currentPlan, activeConnections, usageLimit, billingStatus, trialEndsAt, nextBillingDate, shopDomain } = useLoaderData();
  
  const formatNextBillingDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const getBillingStatusBadge = () => {
    switch (billingStatus) {
      case 'active': return { tone: 'success', label: 'Active' };
      case 'cancelled': return { tone: 'warning', label: 'Cancelled' };
      case 'frozen': return { tone: 'critical', label: 'Frozen' };
      case 'trial': return { tone: 'info', label: 'Trial' };
      default: return { tone: 'neutral', label: billingStatus };
    }
  };

  const billingBadge = getBillingStatusBadge();
  
  return (
    <Page>
      <TitleBar title="Settings" />
      
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {/* Plan Overview */}
            <Card padding="600">
              <BlockStack gap="400">
                <Text as="h2" variant="headingXl" fontWeight="bold">
                  Plan Overview
                </Text>
                <InlineStack gap="600">
                  <Box style={{ flex: 1 }}>
                    <BlockStack gap="300">
                      <Text as="p" variant="bodyMd" tone="subdued">Current Plan</Text>
                      <Badge tone="info" size="large">{currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}</Badge>
                    </BlockStack>
                  </Box>
                  <Box style={{ flex: 1 }}>
                    <BlockStack gap="300">
                      <Text as="p" variant="bodyMd" tone="subdued">Usage</Text>
                      <Text as="p" variant="bodyLg" fontWeight="semibold">
                        {activeConnections} / {usageLimit === Infinity ? 'Unlimited' : usageLimit}
                      </Text>
                    </BlockStack>
                  </Box>
                  <Box style={{ flex: 1 }}>
                    <BlockStack gap="300">
                      <Text as="p" variant="bodyMd" tone="subdued">Billing Status</Text>
                      <Badge tone={billingBadge.tone}>{billingBadge.label}</Badge>
                    </BlockStack>
                  </Box>
                </InlineStack>
                {currentPlan !== 'free' && (
                  <Box paddingTop="400">
                    <BlockStack gap="300">
                      <Divider />
                      <InlineStack alignment="space-between" blockAlign="center">
                        <Text as="p" variant="bodyMd" tone="subdued">Next Billing Date</Text>
                        <Text as="p" variant="bodyMd" fontWeight="semibold">{formatNextBillingDate(nextBillingDate)}</Text>
                      </InlineStack>
                      <Button variant="secondary" size="slim">
                        Cancel Subscription
                      </Button>
                    </BlockStack>
                  </Box>
                )}
              </BlockStack>
            </Card>

            {/* Current Usage */}
            <Card padding="600">
              <BlockStack gap="400">
                <Text as="h2" variant="headingXl" fontWeight="bold">
                  Current Usage
                </Text>
                <Box>
                  <div style={{
                    width: "100%",
                    height: "8px",
                    background: "#E1E3E5",
                    borderRadius: "4px",
                    overflow: "hidden"
                  }}>
                    <div style={{
                      width: usageLimit === Infinity ? "100%" : `${(activeConnections / usageLimit) * 100}%`,
                      height: "100%",
                      background: activeConnections >= usageLimit ? "#008060" : "#008060",
                      borderRadius: "4px"
                    }} />
                  </div>
                </Box>
                <InlineStack alignment="space-between">
                  <Text as="p" variant="bodyMd" tone="subdued">
                    {activeConnections} of {usageLimit === Infinity ? 'unlimited' : usageLimit} scripts used
                  </Text>
                  <Button variant="plain" url="/app/scripts">
                    Manage Scripts
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>

            {/* Pricing */}
            <BlockStack gap="400">
              <Text as="h2" variant="headingXl" fontWeight="bold">
                Pricing
              </Text>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "24px"
              }}>
                <Card padding="600" background="bg-surface-secondary" style={{ minHeight: "auto", width: "100%" }}>
                  <BlockStack gap="400">
                    <Text as="h3" variant="headingLg" fontWeight="bold">Free</Text>
                    <Text as="p" variant="heading2xl" fontWeight="bold">$0</Text>
                    <Divider />
                    <BlockStack gap="300">
                      <Text as="p" variant="bodyMd">1 active connection</Text>
                      <Text as="p" variant="bodyMd">Basic tracking</Text>
                      <Badge tone="info">Current Plan</Badge>
                    </BlockStack>
                  </BlockStack>
                </Card>
                <Card padding="600" style={{ minHeight: "auto", width: "100%" }}>
                  <BlockStack gap="400">
                    <Text as="h3" variant="headingLg" fontWeight="bold">Basic</Text>
                    <Text as="p" variant="heading2xl" fontWeight="bold">$4.99</Text>
                    <Divider />
                    <BlockStack gap="300">
                      <Text as="p" variant="bodyMd">5 active scripts</Text>
                      <Text as="p" variant="bodyMd">All platforms</Text>
                      <Button variant="primary" fullWidth>Upgrade</Button>
                    </BlockStack>
                  </BlockStack>
                </Card>
                <Card padding="600" style={{ minHeight: "auto", width: "100%", border: "2px solid #008060" }}>
                  <BlockStack gap="400">
                    <InlineStack alignment="space-between" blockAlign="center">
                      <Text as="h3" variant="headingLg" fontWeight="bold">Pro</Text>
                      <Badge tone="success">Most Popular</Badge>
                    </InlineStack>
                    <Text as="p" variant="heading2xl" fontWeight="bold">$12.99</Text>
                    <Divider />
                    <BlockStack gap="300">
                      <Text as="p" variant="bodyMd">Unlimited scripts</Text>
                      <Text as="p" variant="bodyMd">Advanced features</Text>
                      <Button variant="primary" fullWidth>Upgrade</Button>
                    </BlockStack>
                  </BlockStack>
                </Card>
              </div>
            </BlockStack>

            {/* Support */}
            <BlockStack gap="400">
              <Text as="h2" variant="headingXl" fontWeight="bold">
                Support
              </Text>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "24px"
              }}>
                <Card padding="600">
                  <BlockStack gap="300">
                    <Text as="h3" variant="headingLg" fontWeight="semibold">Email Support</Text>
                    <Text as="p" variant="bodyMd" tone="subdued">Average response time: 24 hours</Text>
                    <Button variant="primary" url="mailto:support@scriptpilot.com">Contact Us</Button>
                  </BlockStack>
                </Card>
                <Card padding="600">
                  <BlockStack gap="300">
                    <Text as="h3" variant="headingLg" fontWeight="semibold">Documentation</Text>
                    <Text as="p" variant="bodyMd" tone="subdued">Setup guides and troubleshooting</Text>
                    <Button variant="primary" url="#" external>View Docs</Button>
                  </BlockStack>
                </Card>
                <Card padding="600">
                  <BlockStack gap="300">
                    <Text as="h3" variant="headingLg" fontWeight="semibold">Setup Help</Text>
                    <Text as="p" variant="bodyMd" tone="subdued">Step-by-step installation guide</Text>
                    <Button variant="primary" url="/app">Get Started</Button>
                  </BlockStack>
                </Card>
              </div>
            </BlockStack>

            {/* Permissions */}
            <BlockStack gap="400">
              <Text as="h2" variant="headingXl" fontWeight="bold">
                Why permissions are needed
              </Text>
              <Card padding="600">
                <BlockStack gap="400">
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingLg" fontWeight="semibold">Theme access</Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Required for storefront script injection. Scripts are loaded safely without modifying theme files.
                    </Text>
                  </BlockStack>
                  <Divider />
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingLg" fontWeight="semibold">Metafields</Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Used to store your script configurations securely. No customer data is collected.
                    </Text>
                  </BlockStack>
                  <Divider />
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingLg" fontWeight="semibold">Webhooks</Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Enables uninstall cleanup and synchronization to keep your store data clean and up-to-date.
                    </Text>
                  </BlockStack>
                </BlockStack>
              </Card>
            </BlockStack>

            {/* Data & Privacy */}
            <BlockStack gap="400">
              <Text as="h2" variant="headingXl" fontWeight="bold">
                Data & Privacy
              </Text>
              <Card padding="600">
                <BlockStack gap="400">
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingLg" fontWeight="semibold">Your data is safe</Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Scripts are loaded safely without modifying theme files. All scripts are automatically removed after uninstall.
                    </Text>
                  </BlockStack>
                  <Divider />
                  <BlockStack gap="300">
                    <InlineStack gap="200" blockAlign="start">
                      <Text as="p" variant="bodyMd">✓</Text>
                      <Text as="p" variant="bodyMd">No customer data collected</Text>
                    </InlineStack>
                    <InlineStack gap="200" blockAlign="start">
                      <Text as="p" variant="bodyMd">✓</Text>
                      <Text as="p" variant="bodyMd">Clean uninstall support</Text>
                    </InlineStack>
                    <InlineStack gap="200" blockAlign="start">
                      <Text as="p" variant="bodyMd">✓</Text>
                      <Text as="p" variant="bodyMd">Shopify Theme App Extension compatible</Text>
                    </InlineStack>
                    <InlineStack gap="200" blockAlign="start">
                      <Text as="p" variant="bodyMd">✓</Text>
                      <Text as="p" variant="bodyMd">GDPR compliant</Text>
                    </InlineStack>
                    <InlineStack gap="200" blockAlign="start">
                      <Text as="p" variant="bodyMd">✓</Text>
                      <Text as="p" variant="bodyMd">No coding required</Text>
                    </InlineStack>
                    <InlineStack gap="200" blockAlign="start">
                      <Text as="p" variant="bodyMd">✓</Text>
                      <Text as="p" variant="bodyMd">Shopify-compatible installation</Text>
                    </InlineStack>
                  </BlockStack>
                  <Divider />
                  <InlineStack gap="400">
                    <Button variant="plain" url="#" external>
                      Privacy Policy
                    </Button>
                    <Button variant="plain" url="#" external>
                      Terms of Service
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            </BlockStack>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
