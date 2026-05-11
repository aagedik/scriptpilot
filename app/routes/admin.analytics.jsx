import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Badge,
  Button,
  InlineStack,
  Box,
  DataTable,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import prisma from "../db.server";
import { requireAdminSession } from "../services/admin.session.server";

export async function loader({ request }) {
  try {
    await requireAdminSession(request);
  } catch (error) {
    return redirect("/admin/login");
  }

  const totalMerchants = await prisma.shop.count();
  const activeMerchants = await prisma.shop.count({
    where: {
      lastActivityAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      }
    }
  });

  const shops = await prisma.shop.findMany({
    include: {
      scripts: true
    }
  });

  const activeSubscriptions = shops.filter(s => s.billingStatus === 'active').length;
  const freeUsers = shops.filter(s => s.plan === 'free').length;
  
  // Calculate MRR (Monthly Recurring Revenue)
  const basicPrice = 4.99;
  const proPrice = 12.99;
  const mrr = (shops.filter(s => s.plan === 'basic').length * basicPrice) + 
              (shops.filter(s => s.plan === 'pro').length * proPrice);

  // Churn risk (inactive for 60+ days)
  const churnRisk = shops.filter(s => {
    const lastActive = new Date(s.lastActivityAt);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    return lastActive < sixtyDaysAgo;
  }).length;

  // Most used integrations
  const integrationUsage = {};
  shops.forEach(shop => {
    shop.scripts.forEach(script => {
      if (script.status) {
        const type = script.scriptType || 'custom';
        integrationUsage[type] = (integrationUsage[type] || 0) + 1;
      }
    });
  });

  const topIntegrations = Object.entries(integrationUsage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return json({
    totalMerchants,
    activeMerchants,
    activeSubscriptions,
    freeUsers,
    mrr: mrr.toFixed(2),
    churnRisk,
    topIntegrations
  });
}

export default function AdminAnalytics() {
  const { totalMerchants, activeMerchants, activeSubscriptions, freeUsers, mrr, churnRisk, topIntegrations } = useLoaderData();

  const integrationRows = topIntegrations.map(([type, count]) => [
    type.charAt(0).toUpperCase() + type.slice(1),
    count.toString(),
    ((count / totalMerchants) * 100).toFixed(1) + '%'
  ]);

  return (
    <Page>
      <TitleBar title="Admin Analytics" />
      <Box style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <BlockStack gap="800">
          {/* Header */}
          <Card padding="600">
            <BlockStack gap="200">
              <InlineStack alignment="space-between" blockAlign="center">
                <Text as="h1" variant="headingXl" fontWeight="bold">
                  Admin Analytics
                </Text>
                <Button variant="primary" url="/admin">
                  Back to Dashboard
                </Button>
              </InlineStack>
              <Text as="p" variant="bodyLg" tone="subdued">
                Deep insights into your SaaS platform performance
              </Text>
            </BlockStack>
          </Card>

          {/* Key Metrics */}
          <BlockStack gap="400">
            <Text as="h2" variant="headingLg" fontWeight="semibold">
              Key Metrics
            </Text>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "24px"
            }}>
              <Card padding="600">
                <BlockStack gap="300">
                  <Text as="p" variant="bodyMd" tone="subdued">Total Merchants</Text>
                  <Text as="p" variant="heading2xl" fontWeight="bold">{totalMerchants}</Text>
                  <Badge tone="info">All Time</Badge>
                </BlockStack>
              </Card>
              <Card padding="600">
                <BlockStack gap="300">
                  <Text as="p" variant="bodyMd" tone="subdued">Active Merchants</Text>
                  <Text as="p" variant="heading2xl" fontWeight="bold">{activeMerchants}</Text>
                  <Badge tone="success">Last 30 Days</Badge>
                </BlockStack>
              </Card>
              <Card padding="600">
                <BlockStack gap="300">
                  <Text as="p" variant="bodyMd" tone="subdued">MRR</Text>
                  <Text as="p" variant="heading2xl" fontWeight="bold">${mrr}</Text>
                  <Badge tone="success">Monthly</Badge>
                </BlockStack>
              </Card>
              <Card padding="600">
                <BlockStack gap="300">
                  <Text as="p" variant="bodyMd" tone="subdued">Active Subscriptions</Text>
                  <Text as="p" variant="heading2xl" fontWeight="bold">{activeSubscriptions}</Text>
                  <Badge tone="success">Paying</Badge>
                </BlockStack>
              </Card>
            </div>
          </BlockStack>

          {/* Risk Metrics */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "24px"
          }}>
            <Card padding="600">
              <BlockStack gap="300">
                <Text as="p" variant="bodyMd" tone="subdued">Free Users</Text>
                <Text as="p" variant="heading2xl" fontWeight="bold">{freeUsers}</Text>
                <Badge tone="neutral">No Revenue</Badge>
              </BlockStack>
            </Card>
            <Card padding="600">
              <BlockStack gap="300">
                <Text as="p" variant="bodyMd" tone="subdued">Churn Risk</Text>
                <Text as="p" variant="heading2xl" fontWeight="bold">{churnRisk}</Text>
                <Badge tone={churnRisk > 0 ? "critical" : "success"}>
                  {churnRisk > 0 ? "At Risk" : "Healthy"}
                </Badge>
              </BlockStack>
            </Card>
          </div>

          {/* Top Integrations */}
          <Card padding="600">
            <BlockStack gap="400">
              <Text as="h2" variant="headingLg" fontWeight="semibold">
                Most Used Integrations
              </Text>
              <DataTable
                columnContentTypes={[
                  "text",
                  "numeric",
                  "text",
                ]}
                headings={[
                  "Integration",
                  "Active Count",
                  "Usage %"
                ]}
                rows={integrationRows}
              />
            </BlockStack>
          </Card>

          {/* Growth Insights */}
          <Card padding="600">
            <BlockStack gap="400">
              <Text as="h2" variant="headingLg" fontWeight="semibold">
                Growth Insights
              </Text>
              <BlockStack gap="300">
                <InlineStack gap="200" blockAlign="start">
                  <Text as="p" variant="bodyMd">•</Text>
                  <Text as="p" variant="bodyMd">
                    <strong>Conversion Rate:</strong> {((activeSubscriptions / totalMerchants) * 100).toFixed(1)}% of merchants are paying
                  </Text>
                </InlineStack>
                <InlineStack gap="200" blockAlign="start">
                  <Text as="p" variant="bodyMd">•</Text>
                  <Text as="p" variant="bodyMd">
                    <strong>Active Rate:</strong> {((activeMerchants / totalMerchants) * 100).toFixed(1)}% of merchants are active
                  </Text>
                </InlineStack>
                <InlineStack gap="200" blockAlign="start">
                  <Text as="p" variant="bodyMd">•</Text>
                  <Text as="p" variant="bodyMd">
                    <strong>ARPU:</strong> ${(parseFloat(mrr) / activeSubscriptions).toFixed(2)} average revenue per user
                  </Text>
                </InlineStack>
              </BlockStack>
            </BlockStack>
          </Card>
        </BlockStack>
      </Box>
    </Page>
  );
}
