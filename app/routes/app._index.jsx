import { json } from "@remix-run/node";
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
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const AUTH_DEBUG_PREFIX = "[auth-debug][app-index]";
const serializeHeaders = (headers) => {
  if (!headers) return null;
  try {
    const result = {};
    for (const [key, value] of headers) {
      result[key] = value;
    }
    return result;
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
  let admin;
  let headers;
  try {
    const auth = await authenticate.admin(request);
    session = auth?.session;
    admin = auth?.admin;
    headers = auth?.headers;
    const restKeys = auth ? Object.keys(auth).filter((key) => !["session", "admin", "headers"].includes(key)) : [];

    logAuthDebug("loader:success", {
      sessionShop: session?.shop ?? null,
      sessionId: session?.id ?? null,
      sessionIsOnline: session?.isOnline ?? null,
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

  // Fetch shop data with script counts
  const shopData = await prisma.shop.findUnique({
    where: { shopifyDomain: shop },
    include: { 
      scripts: true,
      activityLogs: {
        orderBy: { createdAt: 'desc' },
        take: 5
      }
    }
  });

  // Calculate real statistics
  const activeScripts = shopData?.scripts.filter(s => s.status).length || 0;
  const disabledScripts = shopData?.scripts.filter(s => !s.status).length || 0;
  const connectedPlatforms = activeScripts;
  const currentPlan = shopData?.plan || 'Free';

  // Try to detect theme extension status via Shopify API
  let themeExtensionStatus = 'Not Enabled';
  let themeExtensionDetails = null;
  let themeEditorUrl = null;
  try {
    // Add null guard for admin.rest
    if (!admin?.rest?.resources?.Extension || !admin?.rest?.resources?.Theme) {
      console.warn('Shopify admin.rest.resources not available, skipping theme extension check');
      themeExtensionStatus = 'Unknown';
    } else {
      // Check if extension is installed in the theme
      const extensions = await admin.rest.resources.Extension.all({ session });
      const scriptPilotExtension = extensions.data.find(ext =>
        ext.title?.toLowerCase().includes('scriptpilot') ||
        ext.type === 'theme_app_extension'
      );

      if (scriptPilotExtension) {
        // Check if extension is enabled on main theme
        const themes = await admin.rest.resources.Theme.all({ session });
        const mainTheme = themes.data.find(t => t.role === 'main');

        if (mainTheme) {
          // Check if extension is in the theme's enabled extensions
          // This is a simplified check - in production you'd verify the extension is actually active
          themeExtensionStatus = 'Connected';
          themeExtensionDetails = {
            themeId: mainTheme.id,
            themeName: mainTheme.name
          };
        } else {
          themeExtensionStatus = 'Not Enabled';
        }
      } else {
        themeExtensionStatus = 'Not Installed';
      }
    }
  } catch (error) {
    console.error('Error checking theme extension status:', error);
    themeExtensionStatus = 'Error';
  }

  if (process.env.SHOPIFY_API_KEY) {
    themeEditorUrl = `https://${shop}/admin/themes/current/editor?context=apps&activateAppId=${process.env.SHOPIFY_API_KEY}`;
  }

  const hasVerificationTag = shopData?.scripts?.some(script => script.scriptType === 'google_search_console') || false;
  const hasSessionInsights = shopData?.scripts?.some(script => ['microsoft_clarity', 'hotjar'].includes(script.scriptType)) || false;

  return json({
    activeScripts,
    disabledScripts,
    connectedPlatforms,
    themeExtensionStatus,
    themeExtensionDetails,
    currentPlan,
    lastActivity: shopData?.lastActivityAt || shopData?.createdAt,
    shopDomain: shop,
    recentActivity: shopData?.activityLogs || [],
    themeEditorUrl,
    hasVerificationTag,
    hasSessionInsights,
  }, headers ? { headers } : {});
};

export default function Index() {
  const {
    activeScripts,
    disabledScripts,
    connectedPlatforms,
    themeExtensionStatus,
    themeExtensionDetails,
    currentPlan,
    lastActivity,
    shopDomain,
    recentActivity,
    themeEditorUrl,
    hasVerificationTag,
    hasSessionInsights,
  } = useLoaderData();

  const getThemeExtensionBadgeTone = () => {
    switch (themeExtensionStatus) {
      case 'Connected': return 'success';
      case 'Not Enabled': return 'warning';
      case 'Detection Failed': return 'critical';
      default: return 'neutral';
    }
  };

  const getThemeExtensionBadgeLabel = () => {
    switch (themeExtensionStatus) {
      case 'Connected': return 'Active';
      case 'Not Enabled': return 'Setup Required';
      case 'Detection Failed': return 'Error';
      default: return 'Unknown';
    }
  };

  const formatLastActivity = (date) => {
    if (!date) return 'Never';
    const now = new Date();
    const activityDate = new Date(date);
    const diffMs = now - activityDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return activityDate.toLocaleDateString();
  };

  const getActivityLabel = (action) => {
    switch (action) {
      case 'script_created': return 'Tracking code installed';
      case 'script_updated': return 'Tracking code updated';
      case 'script_deleted': return 'Tracking code removed';
      case 'script_enabled': return 'Tracking code enabled';
      case 'script_disabled': return 'Tracking code paused';
      case 'theme_extension_enabled': return 'Theme app extension enabled';
      default: return action;
    }
  };

  return (
    <Page>
      <TitleBar title="ScriptPilot" />
      <Box style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <BlockStack gap="800">
          {/* Hero Section */}
          <Card padding="600">
            <BlockStack gap="400">
              <BlockStack gap="300">
                <Text as="h1" variant="headingXl" fontWeight="bold">
                  Add pixels and analytics to Shopify without touching theme code
                </Text>
                <Text as="p" variant="bodyLg" tone="subdued">
                  Install Meta Pixel, Facebook Pixel, Google Analytics, Google Tag Manager, TikTok Pixel, verification tags, Microsoft Clarity, Hotjar, and custom tracking scripts in minutes.
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  ✓ No theme editing required • ✓ Safe Shopify Theme App Extension • ✓ Automatically removed after uninstall • ✓ Works with modern Shopify themes
                </Text>
              </BlockStack>
              <InlineStack gap="300">
                <Button variant="primary" size="large" url="/app/scripts">
                  Add Meta Pixel
                </Button>
                <Button variant="secondary" size="large" url="/app/scripts">
                  Connect Google Analytics
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>

          {/* Live Stats */}
          <BlockStack gap="400">
            <Text as="h2" variant="headingLg" fontWeight="semibold">
              Live Stats
            </Text>
            {activeScripts === 0 && disabledScripts === 0 ? (
              <Card padding="600" background="bg-surface-secondary">
                <BlockStack gap="400">
                  <Text as="p" variant="bodyLg" fontWeight="semibold">
                    Start tracking your conversions
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Add your first Meta Pixel, Google Analytics tag, Google Tag Manager snippet, TikTok Pixel, Microsoft Clarity, Hotjar, or custom verification code in seconds.
                  </Text>
                  <InlineStack gap="300">
                    <Button variant="primary" url="/app/scripts">
                      Install Tracking Code
                    </Button>
                    {themeExtensionStatus !== 'Connected' && (
                      <Button 
                        variant="secondary" 
                        url={themeEditorUrl || `https://${shopDomain}/admin/themes/current/editor`}
                        target="_blank"
                      >
                        Enable Theme Extension
                      </Button>
                    )}
                  </InlineStack>
                </BlockStack>
              </Card>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "24px"
              }}>
                <Card padding="600">
                  <BlockStack gap="300">
                    <Text as="p" variant="bodyMd" tone="subdued">Active Scripts</Text>
                    <Text as="p" variant="heading2xl" fontWeight="bold">{activeScripts}</Text>
                    <Badge tone="success">Live</Badge>
                  </BlockStack>
                </Card>
                <Card padding="600">
                  <BlockStack gap="300">
                    <Text as="p" variant="bodyMd" tone="subdued">Disabled Scripts</Text>
                    <Text as="p" variant="heading2xl" fontWeight="bold">{disabledScripts}</Text>
                    <Badge tone="neutral">Inactive</Badge>
                  </BlockStack>
                </Card>
                <Card padding="600">
                  <BlockStack gap="300">
                    <Text as="p" variant="bodyMd" tone="subdued">Connected Platforms</Text>
                    <Text as="p" variant="heading2xl" fontWeight="bold">{connectedPlatforms}</Text>
                    <Badge tone="info">Active</Badge>
                  </BlockStack>
                </Card>
                <Card padding="600">
                  <BlockStack gap="300">
                    <Text as="p" variant="bodyMd" tone="subdued">Theme Extension</Text>
                    <Text as="p" variant="heading2xl" fontWeight="bold">{themeExtensionStatus}</Text>
                    <Badge tone={getThemeExtensionBadgeTone()}>
                      {getThemeExtensionBadgeLabel()}
                    </Badge>
                  </BlockStack>
                  {themeExtensionStatus !== 'Connected' && (
                    <Box paddingTop="300">
                      <Button 
                        variant="primary" 
                        size="slim" 
                        url={themeEditorUrl || `https://${shopDomain}/admin/themes/current/editor`}
                        target="_blank"
                      >
                        Fix Now
                      </Button>
                    </Box>
                  )}
                </Card>
                <Card padding="600">
                  <BlockStack gap="300">
                    <Text as="p" variant="bodyMd" tone="subdued">Current Plan</Text>
                    <Text as="p" variant="heading2xl" fontWeight="bold">{currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}</Text>
                    <Badge tone="info">Active</Badge>
                  </BlockStack>
                </Card>
                <Card padding="600">
                  <BlockStack gap="300">
                    <Text as="p" variant="bodyMd" tone="subdued">Last Activity</Text>
                    <Text as="p" variant="heading2xl" fontWeight="bold">{formatLastActivity(lastActivity)}</Text>
                    <Badge tone="subdued">Updated</Badge>
                  </BlockStack>
                </Card>
              </div>
            )}
          </BlockStack>

          {/* Quick Start Progress */}
          <Card padding="600">
            <BlockStack gap="400">
              <InlineStack alignment="space-between" blockAlign="center">
                <Text as="h2" variant="headingLg" fontWeight="semibold">
                  Setup Progress
                </Text>
                <Badge tone={themeExtensionStatus === 'Connected' && activeScripts > 0 ? 'success' : 'info'}>
                  {themeExtensionStatus === 'Connected' && activeScripts > 0 ? '75% Complete' : '25% Complete'}
                </Badge>
              </InlineStack>
              <Box>
                <div style={{
                  width: "100%",
                  height: "8px",
                  background: "#E1E3E5",
                  borderRadius: "4px",
                  overflow: "hidden"
                }}>
                  <div style={{
                    width: themeExtensionStatus === 'Connected' && activeScripts > 0 ? "75%" : "25%",
                    height: "100%",
                    background: "#008060",
                    borderRadius: "4px",
                    transition: "width 0.3s ease"
                  }} />
                </div>
              </Box>
              <BlockStack gap="300">
                <InlineStack alignment="start" blockAlign="center" gap="400">
                  <Box style={{ 
                    width: "24px", 
                    height: "24px", 
                    borderRadius: "50%", 
                    background: themeExtensionStatus === 'Connected' ? "#008060" : "#E1E3E5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <Text as="p" variant="bodyMd" tone={themeExtensionStatus === 'Connected' ? "white" : "subdued"} style={{ fontSize: "14px" }}>
                      {themeExtensionStatus === 'Connected' ? '\u2713' : '1'}
                    </Text>
                  </Box>
                  <Text as="p" variant="bodyMd" fontWeight={themeExtensionStatus === 'Connected' ? "semibold" : "regular"}>
                    Enable the ScriptPilot theme app extension
                  </Text>
                  {themeExtensionStatus !== 'Connected' && (
                    <Button 
                      variant="plain" 
                      size="slim" 
                      url={themeEditorUrl || `https://${shopDomain}/admin/themes/current/editor`}
                      target="_blank"
                    >
                      Enable
                    </Button>
                  )}
                </InlineStack>
                <InlineStack alignment="start" blockAlign="center" gap="400">
                  <Box style={{ 
                    width: "24px", 
                    height: "24px", 
                    borderRadius: "50%", 
                    background: activeScripts > 0 ? "#008060" : "#E1E3E5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <Text as="p" variant="bodyMd" tone={activeScripts > 0 ? "white" : "subdued"} style={{ fontSize: "14px" }}>
                      {activeScripts > 0 ? '\u2713' : '2'}
                    </Text>
                  </Box>
                  <Text as="p" variant="bodyMd" fontWeight={activeScripts > 0 ? "semibold" : "regular"}>
                    Install Meta Pixel, Google Analytics, or Google Tag Manager
                  </Text>
                  {activeScripts === 0 && (
                    <Button 
                      variant="plain" 
                      size="slim" 
                      url="/app/scripts"
                    >
                      Add Tracking Code
                    </Button>
                  )}
                </InlineStack>
                <InlineStack alignment="start" blockAlign="center" gap="400">
                  <Box style={{ 
                    width: "24px", 
                    height: "24px", 
                    borderRadius: "50%", 
                    background: hasVerificationTag ? "#008060" : "#E1E3E5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <Text as="p" variant="bodyMd" tone={hasVerificationTag ? "white" : "subdued"} style={{ fontSize: "14px" }}>
                      {hasVerificationTag ? '\u2713' : '3'}
                    </Text>
                  </Box>
                  <Text as="p" variant="bodyMd" fontWeight={hasVerificationTag ? "semibold" : "regular"}>
                    Verify Google Search Console or other storefront tags
                  </Text>
                  {!hasVerificationTag && (
                    <Button 
                      variant="plain" 
                      size="slim" 
                      url="/app/scripts"
                    >
                      Verify Store
                    </Button>
                  )}
                </InlineStack>
                <InlineStack alignment="start" blockAlign="center" gap="400">
                  <Box style={{ 
                    width: "24px", 
                    height: "24px", 
                    borderRadius: "50%", 
                    background: hasSessionInsights ? "#008060" : "#E1E3E5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <Text as="p" variant="bodyMd" tone={hasSessionInsights ? "white" : "subdued"} style={{ fontSize: "14px" }}>
                      {hasSessionInsights ? '\u2713' : '4'}
                    </Text>
                  </Box>
                  <Text as="p" variant="bodyMd" fontWeight={hasSessionInsights ? "semibold" : "regular"}>
                    Add Microsoft Clarity or Hotjar and test conversion tracking
                  </Text>
                  {!hasSessionInsights && (
                    <Button 
                      variant="plain" 
                      size="slim" 
                      url="/app/scripts"
                    >
                      Install Session Insights
                    </Button>
                  )}
                </InlineStack>
              </BlockStack>
            </BlockStack>
          </Card>

          {/* Recent Activity */}
          <Card padding="600">
            <BlockStack gap="400">
              <Text as="h2" variant="headingLg" fontWeight="semibold">
                Recent Activity
              </Text>
              {recentActivity.length > 0 ? (
                <BlockStack gap="300">
                  {recentActivity.map((activity) => (
                    <InlineStack key={activity.id} alignment="start" blockAlign="center" gap="400">
                      <Box style={{ 
                        width: "8px", 
                        height: "8px", 
                        borderRadius: "50%", 
                        background: "#008060"
                      }} />
                      <Box style={{ flex: 1 }}>
                        <InlineStack alignment="space-between" blockAlign="center">
                          <Text as="p" variant="bodyMd">
                            {activity.scriptName ? `${activity.scriptName}: ` : ''}{getActivityLabel(activity.action)}
                          </Text>
                          <Text as="p" variant="bodySm" tone="subdued">
                            {formatLastActivity(activity.createdAt)}
                          </Text>
                        </InlineStack>
                      </Box>
                    </InlineStack>
                  ))}
                </BlockStack>
              ) : (
                <BlockStack gap="300">
                  <Text as="p" variant="bodyMd" tone="subdued">
                    No recent activity yet. Add Meta Pixel, Google Analytics, TikTok Pixel, Google Tag Manager, Microsoft Clarity, or a verification tag to start tracking conversions.
                  </Text>
                  <Button variant="primary" url="/app/scripts">
                    Install Tracking Code
                  </Button>
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </BlockStack>
      </Box>
    </Page>
  );
}
