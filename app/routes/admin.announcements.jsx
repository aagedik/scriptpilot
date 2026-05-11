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

  const announcements = await prisma.announcement.findMany({
    orderBy: {
      createdAt: 'desc'
    }
  });

  return json({ announcements });
}

export default function AdminAnnouncements() {
  const { announcements } = useLoaderData();
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredAnnouncements = announcements.filter(announcement => {
    if (statusFilter === "all") return true;
    if (statusFilter === "active") return announcement.active;
    if (statusFilter === "inactive") return !announcement.active;
    return true;
  });

  const announcementRows = filteredAnnouncements.map(announcement => [
    announcement.title,
    announcement.target,
    announcement.active ? "Active" : "Inactive",
    announcement.createdAt.toLocaleDateString(),
  ]);

  return (
    <Page>
      <TitleBar title="Announcement Management" />
      <Box style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <BlockStack gap="800">
          {/* Header */}
          <Card padding="600">
            <BlockStack gap="200">
              <InlineStack alignment="space-between" blockAlign="center">
                <Text as="h1" variant="headingXl" fontWeight="bold">
                  Announcement Management
                </Text>
                <Button variant="primary" url="/admin">
                  Back to Dashboard
                </Button>
              </InlineStack>
              <Text as="p" variant="bodyLg" tone="subdued">
                Create and manage announcements for merchants
              </Text>
            </BlockStack>
          </Card>

          {/* Stats */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "24px"
          }}>
            <Card padding="600">
              <BlockStack gap="300">
                <Text as="p" variant="bodyMd" tone="subdued">Total Announcements</Text>
                <Text as="p" variant="heading2xl" fontWeight="bold">{announcements.length}</Text>
                <Badge tone="info">All Time</Badge>
              </BlockStack>
            </Card>
            <Card padding="600">
              <BlockStack gap="300">
                <Text as="p" variant="bodyMd" tone="subdued">Active Announcements</Text>
                <Text as="p" variant="heading2xl" fontWeight="bold">{announcements.filter(a => a.active).length}</Text>
                <Badge tone="success">Live</Badge>
              </BlockStack>
            </Card>
            <Card padding="600">
              <BlockStack gap="300">
                <Text as="p" variant="bodyMd" tone="subdued">Target: All Users</Text>
                <Text as="p" variant="heading2xl" fontWeight="bold">{announcements.filter(a => a.target === 'all').length}</Text>
                <Badge tone="neutral">Universal</Badge>
              </BlockStack>
            </Card>
            <Card padding="600">
              <BlockStack gap="300">
                <Text as="p" variant="bodyMd" tone="subdued">Target: Paid Users</Text>
                <Text as="p" variant="heading2xl" fontWeight="bold">{announcements.filter(a => a.target === 'paid').length}</Text>
                <Badge tone="success">Premium</Badge>
              </BlockStack>
            </Card>
          </div>

          {/* Filter */}
          <Card padding="600">
            <Select
              label="Status"
              options={[
                { label: 'All', value: 'all' },
                { label: 'Active', value: 'active' },
                { label: 'Inactive', value: 'inactive' },
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </Card>

          {/* Announcements Table */}
          <Card padding="600">
            <BlockStack gap="400">
              <InlineStack alignment="space-between" blockAlign="center">
                <Text as="h2" variant="headingLg" fontWeight="semibold">
                  Announcements ({filteredAnnouncements.length})
                </Text>
                <Button variant="primary">
                  Create Announcement
                </Button>
              </InlineStack>
              <DataTable
                columnContentTypes={[
                  "text",
                  "text",
                  "text",
                  "text",
                ]}
                headings={[
                  "Title",
                  "Target",
                  "Status",
                  "Created",
                ]}
                rows={announcementRows}
              />
            </BlockStack>
          </Card>
        </BlockStack>
      </Box>
    </Page>
  );
}
