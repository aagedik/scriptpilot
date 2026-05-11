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
  Select,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useState } from "react";
import prisma from "../db.server";
import { requireAdminSession } from "../services/admin.session.server";

export async function loader({ request }) {
  try {
    await requireAdminSession(request);
  } catch (error) {
    return redirect("/admin/login");
  }

  const shops = await prisma.shop.findMany({
    include: {
      scripts: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  const planStats = {
    free: shops.filter(s => s.plan === 'free').length,
    basic: shops.filter(s => s.plan === 'basic').length,
    pro: shops.filter(s => s.plan === 'pro').length,
  };

  const billingStats = {
    active: shops.filter(s => s.billingStatus === 'active').length,
    cancelled: shops.filter(s => s.billingStatus === 'cancelled').length,
    frozen: shops.filter(s => s.billingStatus === 'frozen').length,
  };

  return json({ shops, planStats, billingStats });
}

export default function AdminSubscriptions() {
  const { shops, planStats, billingStats } = useLoaderData();
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredShops = shops.filter(shop => {
    if (statusFilter === "all") return true;
    return shop.billingStatus === statusFilter;
  });

  const shopRows = filteredShops.map(shop => [
    shop.shopifyDomain,
    shop.plan,
    shop.billingStatus,
    shop.scripts.filter(s => s.status).length.toString(),
    shop.trialEndsAt ? shop.trialEndsAt.toLocaleDateString() : "N/A",
    shop.createdAt.toLocaleDateString(),
  ]);

  return (
    <Page>
      <TitleBar title="Subscription Management" />
      <Box style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <BlockStack gap="800">
          {/* Header */}
          <Card padding="600">
            <BlockStack gap="200">
              <InlineStack alignment="space-between" blockAlign="center">
                <Text as="h1" variant="headingXl" fontWeight="bold">
                  Subscription Management
                </Text>
                <Button variant="primary" url="/admin">
                  Back to Dashboard
                </Button>
              </InlineStack>
              <Text as="p" variant="bodyLg" tone="subdued">
                Monitor and manage merchant subscriptions
              </Text>
            </BlockStack>
          </Card>

          {/* Statistics */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "24px"
          }}>
            <Card padding="600">
              <BlockStack gap="300">
                <Text as="p" variant="bodyMd" tone="subdued">Free Plans</Text>
                <Text as="p" variant="heading2xl" fontWeight="bold">{planStats.free}</Text>
                <Badge tone="neutral">1 Integration</Badge>
              </BlockStack>
            </Card>
            <Card padding="600">
              <BlockStack gap="300">
                <Text as="p" variant="bodyMd" tone="subdued">Basic Plans</Text>
                <Text as="p" variant="heading2xl" fontWeight="bold">{planStats.basic}</Text>
                <Badge tone="info">5 Integrations</Badge>
              </BlockStack>
            </Card>
            <Card padding="600">
              <BlockStack gap="300">
                <Text as="p" variant="bodyMd" tone="subdued">Pro Plans</Text>
                <Text as="p" variant="heading2xl" fontWeight="bold">{planStats.pro}</Text>
                <Badge tone="success">Unlimited</Badge>
              </BlockStack>
            </Card>
            <Card padding="600">
              <BlockStack gap="300">
                <Text as="p" variant="bodyMd" tone="subdued">Active Subscriptions</Text>
                <Text as="p" variant="heading2xl" fontWeight="bold">{billingStats.active}</Text>
                <Badge tone="success">Paying</Badge>
              </BlockStack>
            </Card>
          </div>

          {/* Billing Status Stats */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "24px"
          }}>
            <Card padding="600">
              <BlockStack gap="300">
                <Text as="p" variant="bodyMd" tone="subdued">Cancelled</Text>
                <Text as="p" variant="heading2xl" fontWeight="bold">{billingStats.cancelled}</Text>
                <Badge tone="critical">Lost</Badge>
              </BlockStack>
            </Card>
            <Card padding="600">
              <BlockStack gap="300">
                <Text as="p" variant="bodyMd" tone="subdued">Frozen</Text>
                <Text as="p" variant="heading2xl" fontWeight="bold">{billingStats.frozen}</Text>
                <Badge tone="warning">At Risk</Badge>
              </BlockStack>
            </Card>
          </div>

          {/* Filter */}
          <Card padding="600">
            <Select
              label="Billing Status"
              options={[
                { label: 'All Statuses', value: 'all' },
                { label: 'Active', value: 'active' },
                { label: 'Cancelled', value: 'cancelled' },
                { label: 'Frozen', value: 'frozen' },
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </Card>

          {/* Subscriptions Table */}
          <Card padding="600">
            <BlockStack gap="400">
              <Text as="h2" variant="headingLg" fontWeight="semibold">
                Subscriptions ({filteredShops.length})
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
                  "Trial Ends",
                  "Installed",
                ]}
                rows={shopRows}
              />
            </BlockStack>
          </Card>
        </BlockStack>
      </Box>
    </Page>
  );
}
