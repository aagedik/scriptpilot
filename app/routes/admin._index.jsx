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
  Divider,
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

  // Fetch admin dashboard data
  const totalMerchants = await prisma.shop.count();
  const activeMerchants = await prisma.shop.count({
    where: {
      lastActivityAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
      }
    }
  });
  
  const shops = await prisma.shop.findMany({
    include: {
      scripts: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 10
  });

  const planDistribution = await prisma.shop.groupBy({
    by: ['plan'],
    _count: true
  });

  const totalScripts = await prisma.script.count();
  const activeScripts = await prisma.script.count({
    where: { status: true }
  });

  return json({
    totalMerchants,
    activeMerchants,
    shops,
    planDistribution,
    totalScripts,
    activeScripts
  });
}

export default function AdminDashboard() {
  const { totalMerchants, activeMerchants, shops, planDistribution, totalScripts, activeScripts } = useLoaderData();

  const shopRows = shops.map(shop => [
    shop.shopifyDomain,
    shop.plan,
    shop.billingStatus,
    shop.scripts.filter(s => s.status).length.toString(),
    shop.createdAt.toLocaleDateString(),
    shop.lastActivityAt.toLocaleDateString(),
  ]);

  return (
    <Page>
      <TitleBar title="ScriptPilot Admin" />
      <Box style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <BlockStack gap="800">
          {/* Header */}
          <Card padding="600">
            <BlockStack gap="200">
              <Text as="h1" variant="headingXl" fontWeight="bold">
                Admin Dashboard
              </Text>
              <Text as="p" variant="bodyLg" tone="subdued">
                Monitor your Shopify SaaS platform performance
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
                  <Text as="p" variant="bodyMd" tone="subdued">Total Scripts</Text>
                  <Text as="p" variant="heading2xl" fontWeight="bold">{totalScripts}</Text>
                  <Badge tone="info">All Time</Badge>
                </BlockStack>
              </Card>
              <Card padding="600">
                <BlockStack gap="300">
                  <Text as="p" variant="bodyMd" tone="subdued">Active Scripts</Text>
                  <Text as="p" variant="heading2xl" fontWeight="bold">{activeScripts}</Text>
                  <Badge tone="success">Live</Badge>
                </BlockStack>
              </Card>
            </div>
          </BlockStack>

          {/* Plan Distribution */}
          <Card padding="600">
            <BlockStack gap="400">
              <Text as="h2" variant="headingLg" fontWeight="semibold">
                Plan Distribution
              </Text>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "24px"
              }}>
                {planDistribution.map((item) => (
                  <Card key={item.plan} padding="500" background="bg-surface-secondary">
                    <BlockStack gap="200">
                      <Text as="p" variant="headingLg" fontWeight="bold" style={{ textTransform: "capitalize" }}>
                        {item.plan}
                      </Text>
                      <Text as="p" variant="heading2xl" fontWeight="bold">
                        {item._count}
                      </Text>
                    </BlockStack>
                  </Card>
                ))}
              </div>
            </BlockStack>
          </Card>

          {/* Recent Merchants */}
          <Card padding="600">
            <BlockStack gap="400">
              <Text as="h2" variant="headingLg" fontWeight="semibold">
                Recent Merchants
              </Text>
              <DataTable
                columnContentTypes={[
                  "text",
                  "text",
                  "text",
                  "numeric",
                  "text",
                  "text",
                ]}
                headings={[
                  "Shop Domain",
                  "Plan",
                  "Billing Status",
                  "Active Scripts",
                  "Installed",
                  "Last Active",
                ]}
                rows={shopRows}
              />
            </BlockStack>
          </Card>

          {/* Quick Actions */}
          <Card padding="600">
            <BlockStack gap="400">
              <Text as="h2" variant="headingLg" fontWeight="semibold">
                Quick Actions
              </Text>
              <InlineStack gap="400">
                <Button variant="primary" url="/admin/merchants">
                  Manage Merchants
                </Button>
                <Button variant="secondary" url="/admin/subscriptions">
                  Subscriptions
                </Button>
                <Button variant="secondary" url="/admin/announcements">
                  Announcements
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </BlockStack>
      </Box>
    </Page>
  );
}
