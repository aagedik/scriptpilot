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
  TextField,
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

  return json({ shops });
}

export default function AdminMerchants() {
  const { shops } = useLoaderData();
  const [searchQuery, setSearchQuery] = useState("");
  const [planFilter, setPlanFilter] = useState("all");

  const filteredShops = shops.filter(shop => {
    const matchesSearch = shop.shopifyDomain.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlan = planFilter === "all" || shop.plan === planFilter;
    return matchesSearch && matchesPlan;
  });

  const shopRows = filteredShops.map(shop => [
    shop.shopifyDomain,
    shop.plan,
    shop.billingStatus,
    shop.scripts.filter(s => s.status).length.toString(),
    shop.scripts.length.toString(),
    shop.createdAt.toLocaleDateString(),
    shop.lastActivityAt.toLocaleDateString(),
  ]);

  return (
    <Page>
      <TitleBar title="Merchant Management" />
      <Box style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <BlockStack gap="800">
          {/* Header */}
          <Card padding="600">
            <BlockStack gap="200">
              <InlineStack alignment="space-between" blockAlign="center">
                <Text as="h1" variant="headingXl" fontWeight="bold">
                  Merchant Management
                </Text>
                <Button variant="primary" url="/admin">
                  Back to Dashboard
                </Button>
              </InlineStack>
              <Text as="p" variant="bodyLg" tone="subdued">
                Manage all ScriptPilot merchants
              </Text>
            </BlockStack>
          </Card>

          {/* Filters */}
          <Card padding="600">
            <InlineStack gap="400" blockAlign="center">
              <Box style={{ flex: 1 }}>
                <TextField
                  placeholder="Search by shop domain..."
                  value={searchQuery}
                  onChange={setSearchQuery}
                  clearButton
                  autoComplete="off"
                />
              </Box>
              <Select
                label="Plan"
                labelInline
                options={[
                  { label: 'All Plans', value: 'all' },
                  { label: 'Free', value: 'free' },
                  { label: 'Basic', value: 'basic' },
                  { label: 'Pro', value: 'pro' },
                ]}
                value={planFilter}
                onChange={setPlanFilter}
              />
            </InlineStack>
          </Card>

          {/* Merchants Table */}
          <Card padding="600">
            <BlockStack gap="400">
              <Text as="h2" variant="headingLg" fontWeight="semibold">
                All Merchants ({filteredShops.length})
              </Text>
              <DataTable
                columnContentTypes={[
                  "text",
                  "text",
                  "text",
                  "numeric",
                  "numeric",
                  "text",
                  "text",
                ]}
                headings={[
                  "Shop Domain",
                  "Plan",
                  "Billing Status",
                  "Active Scripts",
                  "Total Scripts",
                  "Installed",
                  "Last Active",
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
