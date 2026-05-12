import { json } from "@remix-run/node";
import { useLoaderData, useFetcher, useRouteError, isRouteErrorResponse } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Button,
  Badge,
  Text,
  BlockStack,
  InlineStack,
  TextField,
  Select,
  Link,
  Box,
  Banner,
} from "@shopify/polaris";
import { useState, useCallback, useEffect, useMemo } from "react";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  SCRIPT_PLATFORMS,
  SCRIPT_PLATFORM_VALUES,
  DEVICE_OPTIONS,
  PAGE_OPTIONS,
  PLACEMENT_OPTIONS,
  DEVICE_OPTION_VALUES,
  PAGE_OPTION_VALUES,
  PLACEMENT_OPTION_VALUES,
  transformPlatformInput,
  defaultPlacementForPlatform,
  getPlatformById,
} from "../utils/script-platforms";

const shouldLog = typeof process !== "undefined" && process.env.NODE_ENV !== "production";
const debugLog = (...args) => {
  if (shouldLog) {
    console.log(...args);
  }
};

const AUTH_DEBUG_PREFIX = "[auth-debug][app-scripts]";
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

const PLATFORMS = SCRIPT_PLATFORMS;
const DEFAULT_FORM_STATE = Object.freeze({
  code: "",
  placement: "body_end",
  deviceTarget: "all",
  pageTarget: "all_pages",
  customUrlRules: "",
});

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

  if (!shop) {
    logAuthDebug("loader:no-shop", {
      reason: "Missing shop after authentication",
      hostParam: hostParam || null,
    });
    return json({ error: "Unable to resolve shop context" }, headers ? { status: 400, headers } : { status: 400 });
  }

  const shopData = await prisma.shop.findUnique({
    where: { shopifyDomain: shop },
    include: { scripts: true }
  });

  const planLimits = {
    free: 1,
    basic: 5,
    pro: Infinity
  };

  const scripts = shopData?.scripts ?? [];
  const planKey = (shopData?.plan ?? 'free').toLowerCase();
  const currentPlan = ['free', 'basic', 'pro'].includes(planKey) ? planKey : 'free';

  const activeScriptCount = scripts.filter(s => s.status).length;
  const maxScripts = planLimits[currentPlan] ?? planLimits.free;
  const canAddMore = activeScriptCount < maxScripts;

  const themeEditorUrl = process.env.SHOPIFY_API_KEY
    ? `https://${shop}/admin/themes/current/editor?context=apps&activateAppId=${process.env.SHOPIFY_API_KEY}`
    : null;

  let themeExtensionStatus = "Unknown";
  let themeExtensionConnected = false;

  try {
    if (!admin?.rest?.resources?.Extension || !admin?.rest?.resources?.Theme) {
      console.warn("Shopify admin.rest.resources not available, skipping theme extension check");
      themeExtensionStatus = "Unknown";
    } else {
      const extensions = await admin.rest.resources.Extension.all({ session });
      const scriptPilotExtension = extensions.data.find(
        (ext) =>
          ext.title?.toLowerCase().includes("scriptpilot") ||
          ext.type === "theme_app_extension"
      );

      if (scriptPilotExtension) {
        const themes = await admin.rest.resources.Theme.all({ session });
        const mainTheme = themes.data.find((theme) => theme.role === "main");

        if (mainTheme) {
          themeExtensionStatus = "Connected";
          themeExtensionConnected = true;
        } else {
          themeExtensionStatus = "Missing on published theme";
        }
      } else {
        themeExtensionStatus = "Not Installed";
      }
    }
  } catch (error) {
    console.error("Error checking theme extension status:", error);
    themeExtensionStatus = "Detection Failed";
  }

  const installedPlatformIds = new Set(scripts.map((script) => script.scriptType));
  const hasAnalyticsScript = installedPlatformIds.has("google_analytics") || installedPlatformIds.has("google_tag_manager");
  const hasMetaPixel = installedPlatformIds.has("meta_pixel");
  const hasVerification = installedPlatformIds.has("google_search_console");

  if (!shopData) {
    return json({
      scripts,
      currentPlan,
      activeScriptCount,
      maxScripts,
      canAddMore,
      themeEditorUrl,
      themeExtension: {
        status: themeExtensionStatus,
        connected: themeExtensionConnected,
        editorUrl: themeEditorUrl,
      },
      onboarding: {
        hasAnalyticsScript,
        hasMetaPixel,
        hasVerification,
      },
    }, headers ? { headers } : {});
  }

  return json({
    scripts,
    currentPlan,
    activeScriptCount,
    maxScripts,
    canAddMore,
    themeEditorUrl,
    themeExtension: {
      status: themeExtensionStatus,
      connected: themeExtensionConnected,
      editorUrl: themeEditorUrl,
    },
    onboarding: {
      hasAnalyticsScript,
      hasMetaPixel,
      hasVerification,
    },
  }, headers ? { headers } : {});
};

// Metafields sync function - all scripts to single body_scripts for stability
async function syncScriptsToMetafields(shopId, session) {
  try {
    const scripts = await prisma.script.findMany({
      where: { shopId },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        placement: true,
        deviceTarget: true,
        pageTarget: true,
        customUrlRules: true,
        priority: true
      },
      orderBy: { priority: 'asc' }
    });

    // Combine all active scripts into single HTML string (all placements map to body)
    let combinedHtml = '';
    scripts.forEach(script => {
      if (script.status && script.code) {
        combinedHtml += script.code + '\n';
      }
    });

    const baseUrl = `https://${session.shop}/admin/api/2025-01`;
    const headers = {
      'X-Shopify-Access-Token': session.accessToken,
      'Content-Type': 'application/json',
    };

    const existingResponse = await fetch(`${baseUrl}/metafields.json?namespace=scriptpilot&key=body_scripts`, {
      method: 'GET',
      headers,
    });

    let existingMetafield = null;
    if (existingResponse.ok) {
      const existingJson = await existingResponse.json();
      existingMetafield = existingJson?.metafields?.[0] ?? null;
    } else {
      console.error('Failed to read existing body_scripts metafield:', await existingResponse.text());
    }

    const trimmedHtml = combinedHtml.trim();

    if (trimmedHtml.length === 0) {
      if (existingMetafield) {
        const deleteResponse = await fetch(`${baseUrl}/metafields/${existingMetafield.id}.json`, {
          method: 'DELETE',
          headers,
        });
        if (!deleteResponse.ok) {
          console.error('Failed to delete body_scripts metafield:', await deleteResponse.text());
        } else {
          debugLog('body_scripts metafield removed (no active scripts)');
        }
      }
      return;
    }

    if (existingMetafield) {
      const updateResponse = await fetch(`${baseUrl}/metafields/${existingMetafield.id}.json`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          metafield: {
            id: existingMetafield.id,
            value: trimmedHtml,
            type: 'multi_line_text_field',
          },
        }),
      });
      if (!updateResponse.ok) {
        console.error('Failed to update body_scripts metafield:', await updateResponse.text());
      } else {
        debugLog('body_scripts metafield updated (length:', trimmedHtml.length, ')');
      }
    } else {
      const createResponse = await fetch(`${baseUrl}/metafields.json`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          metafield: {
            namespace: 'scriptpilot',
            key: 'body_scripts',
            value: trimmedHtml,
            type: 'multi_line_text_field',
            owner_resource: 'shop',
          },
        }),
      });
      if (!createResponse.ok) {
        console.error('Failed to create body_scripts metafield:', await createResponse.text());
      } else {
        debugLog('body_scripts metafield created (length:', trimmedHtml.length, ')');
      }
    }
  } catch (error) {
    console.error('Error syncing to metafields:', error);
  }
}
export const action = async ({ request }) => {
  const url = new URL(request.url);
  const hostParam = url.searchParams.get("host");
  const shopParam = url.searchParams.get("shop");
  const authHeader = request.headers.get("Authorization") || request.headers.get("authorization") || null;

  logAuthDebug("action:start", {
    url: url.toString(),
    pathname: url.pathname,
    search: url.search,
    hostParam: hostParam || null,
    shopParam: shopParam || null,
    method: request.method,
    hasAuthHeader: Boolean(authHeader),
  });

  let session;
  let headers;
  try {
    const auth = await authenticate.admin(request);
    session = auth?.session;
    headers = auth?.headers;
    const restKeys = auth ? Object.keys(auth).filter((key) => !["session", "headers"].includes(key)) : [];

    logAuthDebug("action:success", {
      sessionShop: session?.shop ?? null,
      sessionId: session?.id ?? null,
      extraKeys: restKeys,
      returnedHeaders: serializeHeaders(headers),
    });
  } catch (error) {
    if (error instanceof Response) {
      logAuthDebug("action:redirect", {
        status: error.status,
        statusText: error.statusText,
        location: error.headers.get("Location"),
        headers: serializeHeaders(error.headers),
      });
      throw error;
    }

    logAuthDebug("action:error", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
    });
    throw error;
  }

  const respond = (payload, init = {}) =>
    headers ? json(payload, { ...init, headers }) : json(payload, init);

  const sessionShop = session?.shop || shopParam;
  if (!sessionShop) {
    logAuthDebug("action:no-shop", {
      reason: "Missing shop after authentication",
      hostParam: hostParam || null,
    });
    return respond({ error: "Unable to resolve shop context" }, { status: 400 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");
  const scriptId = formData.get("scriptId");

  logAuthDebug("action:form", {
    intent: intent || null,
    scriptId: scriptId || null,
    formHasHost: formData.has("host"),
    formHasShop: formData.has("shop"),
  });

  const shopData = await prisma.shop.findUnique({
    where: { shopifyDomain: sessionShop },
    include: { scripts: true },
  });

  const currentPlan = shopData?.plan || "free";
  const planLimits = {
    free: 1,
    basic: 5,
    pro: Infinity,
  };
  const maxScripts = planLimits[currentPlan] || 1;
  const activeScriptCount = shopData?.scripts.filter((s) => s.status).length || 0;

  const normalizePlacement = (value, platformId) => {
    if (!PLACEMENT_OPTION_VALUES.has(value)) {
      return defaultPlacementForPlatform(platformId);
    }
    return value;
  };

  const normalizeDeviceTarget = (value) => (DEVICE_OPTION_VALUES.has(value) ? value : "all");
  const normalizePageTarget = (value) => (PAGE_OPTION_VALUES.has(value) ? value : "all_pages");

  const commitScript = async ({
    platformId,
    code,
    placement,
    deviceTarget,
    pageTarget,
    customUrlRules,
  }) => {
    const existingScript = await prisma.script.findFirst({
      where: { scriptType: platformId, shop: { shopifyDomain: sessionShop } },
    });

    const nextActiveCount = existingScript?.status
      ? activeScriptCount
      : activeScriptCount + 1;

    if (!existingScript && nextActiveCount > maxScripts) {
      return respond(
        {
          error: `Plan limit reached. Your ${currentPlan} plan allows ${
            maxScripts === Infinity ? "unlimited" : maxScripts
          } active scripts. Upgrade to add more.`,
        },
        { status: 400 }
      );
    }

    const platform = getPlatformById(platformId);
    const shopRecord = await prisma.shop.findUnique({
      where: { shopifyDomain: sessionShop },
    });

    if (!shopRecord) {
      throw new Response("Shop record not found", { status: 404 });
    }

    const baseData = {
      name: platform?.name || platformId,
      description: platform?.description,
      code,
      placement,
      scriptType: platformId,
      deviceTarget,
      pageTarget,
      customUrlRules,
      status: true,
    };

    if (existingScript) {
      await prisma.script.update({
        where: { id: existingScript.id },
        data: baseData,
      });
    } else {
      await prisma.script.create({
        data: {
          ...baseData,
          shopId: shopRecord.id,
        },
      });
    }

    await prisma.shop.update({
      where: { id: shopRecord.id },
      data: { lastActivityAt: new Date() },
    });

    await prisma.activityLog.create({
      data: {
        shopId: shopRecord.id,
        action: existingScript ? "script_updated" : "script_created",
        scriptName: platform?.name || platformId,
        details: existingScript ? "Script updated successfully" : "Script created successfully",
      },
    });

    await syncScriptsToMetafields(shopRecord.id, session);

    return respond({
      success: true,
      scriptName: platform?.name || platformId,
    });
  };

  switch (intent) {
    case "create_script": {
      const platformId = formData.get("platform");
      if (!SCRIPT_PLATFORM_VALUES.has(platformId)) {
        return respond({ error: "Choose a supported script platform." }, { status: 400 });
      }

      const rawCode = formData.get("code") || "";
      const placement = normalizePlacement(formData.get("placement"), platformId);
      const deviceTarget = normalizeDeviceTarget(formData.get("deviceTarget"));
      const pageTarget = normalizePageTarget(formData.get("pageTarget"));
      const customUrlRules = formData.get("customUrlRules") || "";

      const transformed = transformPlatformInput(platformId, rawCode);
      if (!transformed.ok) {
        return respond({ error: transformed.error }, { status: 400 });
      }

      return commitScript({
        platformId,
        code: transformed.data,
        placement,
        deviceTarget,
        pageTarget,
        customUrlRules,
      });
    }
    case "update_script": {
      const platformId = formData.get("scriptType") || formData.get("platform");
      if (!SCRIPT_PLATFORM_VALUES.has(platformId)) {
        return respond({ error: "Choose a supported script platform." }, { status: 400 });
      }

      const rawCode = formData.get("code") || "";
      const placement = normalizePlacement(formData.get("placement"), platformId);
      const deviceTarget = normalizeDeviceTarget(formData.get("deviceTarget"));
      const pageTarget = normalizePageTarget(formData.get("pageTarget"));
      const customUrlRules = formData.get("customUrlRules") || "";

      const transformed = transformPlatformInput(platformId, rawCode);
      if (!transformed.ok) {
        return respond({ error: transformed.error }, { status: 400 });
      }

      return commitScript({
        platformId,
        code: transformed.data,
        placement,
        deviceTarget,
        pageTarget,
        customUrlRules,
      });
    }
    case "toggle_script": {
      const script = await prisma.script.findUnique({
        where: { id: scriptId },
      });

      if (!script) {
        return respond({ error: "Script not found" }, { status: 404 });
      }

      const newStatus = !script.status;
      if (newStatus) {
        const nextActive = activeScriptCount + (script.status ? 0 : 1);
        if (nextActive > maxScripts) {
          return respond(
            {
              error: `Plan limit reached. Your ${currentPlan} plan allows ${
                maxScripts === Infinity ? "unlimited" : maxScripts
              } active scripts. Upgrade to enable more.`,
            },
            { status: 400 }
          );
        }
      }

      await prisma.script.update({
        where: { id: scriptId },
        data: { status: newStatus },
      });

      const shopRecord = await prisma.shop.findUnique({
        where: { shopifyDomain: sessionShop },
      });

      if (!shopRecord) {
        throw new Response("Shop record not found", { status: 404 });
      }

      await prisma.activityLog.create({
        data: {
          shopId: shopRecord.id,
          action: newStatus ? "script_enabled" : "script_disabled",
          scriptName: script.name,
          details: newStatus ? "Script enabled" : "Script disabled",
        },
      });

      await prisma.shop.update({
        where: { id: shopRecord.id },
        data: { lastActivityAt: new Date() },
      });

      if (newStatus || script.status) {
        await syncScriptsToMetafields(shopRecord.id, session);
      }

      return respond({ success: true });
    }
    case "delete_script": {
      if (!scriptId) {
        return respond({ error: "Missing script identifier." }, { status: 400 });
      }

      await prisma.script.delete({
        where: { id: scriptId },
      });

      const shopRecord = await prisma.shop.findUnique({
        where: { shopifyDomain: sessionShop },
      });

      if (shopRecord) {
        await prisma.activityLog.create({
          data: {
            shopId: shopRecord.id,
            action: "script_deleted",
            scriptName: scriptId,
            details: "Script deleted by merchant",
          },
        });
        await syncScriptsToMetafields(shopRecord.id, session);
      }

      return respond({ success: true });
    }
    default:
      return respond({ error: "Unsupported action." }, { status: 400 });
  }
};

export default function ScriptsPage() {
  const { scripts, currentPlan, activeScriptCount, maxScripts, canAddMore, themeEditorUrl, themeExtension, onboarding = {} } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [expandedPlatform, setExpandedPlatform] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState({});
  const [formData, setFormData] = useState(() => ({ ...DEFAULT_FORM_STATE }));
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [formError, setFormError] = useState('');

  const actionResult = fetcher.data;

  useEffect(() => {
    if (!actionResult) return;

    let timeoutId;

    if (actionResult.success) {
      setFormError('');
      setSuccessMessage(`${actionResult.scriptName || 'Script'} is now live on your storefront.`);
      setShowSuccessBanner(true);
      timeoutId = window.setTimeout(() => setShowSuccessBanner(false), 5000);
      shopify.toast.show("Script saved successfully");
      handleCollapse();
    } else if (actionResult.error) {
      setFormError(actionResult.error);
      shopify.toast.show(actionResult.error, { isError: true });
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [actionResult, shopify, handleCollapse]);

  // Get connected scripts by platform
  const getScriptByPlatform = (platformId) => {
    return scripts.find(s => s.scriptType === platformId);
  };

  const getPlatformStatus = useCallback((platformId) => {
    const script = getScriptByPlatform(platformId);
    if (script && script.status) {
      return { label: 'Live', tone: 'success' };
    }
    if (script) {
      return { label: 'Configured', tone: 'info' };
    }
    return { label: 'Needs Attention', tone: 'warning' };
  }, [scripts]);

  const handleExpand = useCallback((platformId) => {
    const script = getScriptByPlatform(platformId);
    const platform = PLATFORMS.find(p => p.id === platformId);
    setExpandedPlatform(platformId);
    setFormData({
      code: script?.code || "",
      deviceTarget: script?.deviceTarget || "all",
      pageTarget: script?.pageTarget || "all_pages",
      customUrlRules: script?.customUrlRules || "",
      placement: script?.placement || defaultPlacementForPlatform(platformId),
      status: script?.status !== undefined ? script.status : true
    });
    setFormError('');
  }, [scripts]);

  const handleCollapse = useCallback(() => {
    setExpandedPlatform(null);
    setFormData({ ...DEFAULT_FORM_STATE });
    setFormError('');
    setShowAdvanced({});
  }, []);

  const handleSubmit = useCallback((platform) => {
    const script = getScriptByPlatform(platform.id);

    const validation = transformPlatformInput(platform.id, formData.code);
    if (!validation.ok) {
      setFormError(validation.error);
      shopify.toast.show(validation.error, { isError: true });
      return;
    }

    if (script) {
      fetcher.submit(
        {
          ...formData,
          code: validation.code,
          name: platform.name,
          scriptType: platform.id,
          scriptId: script.id,
          intent: "update_script",
        },
        { method: "post" }
      );
    } else {
      fetcher.submit(
        {
          ...formData,
          code: validation.code,
          name: platform.name,
          scriptType: platform.id,
          intent: "create_script",
        },
        { method: "post" }
      );
    }
  }, [formData, scripts, fetcher, handleCollapse]);

  const handleDelete = useCallback((scriptId) => {
    fetcher.submit(
      { scriptId, intent: "delete_script" },
      { method: "post" }
    );
  }, [fetcher]);

  const handleToggle = useCallback((script) => {
    fetcher.submit(
      { scriptId: script.id, currentStatus: script.status, intent: "toggle_script" },
      { method: "post" }
    );
  }, [fetcher]);

  const toggleAdvanced = useCallback((platformId) => {
    setShowAdvanced(prev => ({ ...prev, [platformId]: !prev[platformId] }));
  }, []);

  const filteredPlatforms = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return PLATFORMS.filter((platform) => {
      const matchesSearch =
        platform.name.toLowerCase().includes(query) ||
        platform.description.toLowerCase().includes(query);
      const matchesCategory = selectedCategory === 'all' || platform.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const setupSteps = [
    {
      id: "theme-extension",
      label: "Enable the ScriptPilot theme app extension",
      complete: Boolean(themeExtension?.connected),
      ctaUrl: themeExtension?.editorUrl,
      status: themeExtension?.status,
    },
    {
      id: "meta-pixel",
      label: "Connect Meta Pixel or TikTok Pixel",
      complete: Boolean(onboarding.hasMetaPixel),
      ctaUrl: "/app/scripts",
    },
    {
      id: "analytics",
      label: "Install Google Analytics or Google Tag Manager",
      complete: Boolean(onboarding.hasAnalyticsScript),
      ctaUrl: "/app/scripts",
    },
    {
      id: "verification",
      label: "Verify Google Search Console",
      complete: Boolean(onboarding.hasVerification),
      ctaUrl: "/app/scripts",
    },
  ];

  const outstandingSteps = setupSteps.filter((step) => !step.complete);

  return (
    <Page>
      <TitleBar title="Scripts" />
      {showSuccessBanner && (
        <Box paddingBlockEnd="400">
          <Banner status="success" onDismiss={() => setShowSuccessBanner(false)}>
            <Text as="p" variant="bodyMd">
              ✅ {successMessage}
            </Text>
          </Banner>
        </Box>
      )}

      {themeExtension && !themeExtension.connected && (
        <Box paddingBlockEnd="400">
          <Banner
            status={themeExtension.status === "Detection Failed" ? "critical" : "warning"}
            title="Enable the ScriptPilot theme app extension"
            action={themeExtension.editorUrl ? {
              content: "Open theme editor",
              url: themeExtension.editorUrl,
              external: true,
            } : undefined}
          >
            <Text as="p" variant="bodyMd">
              Shopify requires the theme app extension to be active before storefront scripts can render. Enable the
              extension on your published theme from the Shopify theme editor.
            </Text>
          </Banner>
        </Box>
      )}

      <Layout>
        <Layout.Section>
          <Box style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <BlockStack gap="800">
              <BlockStack gap="400">
                <Text as="h1" variant="headingXl" fontWeight="bold">
                  Add Shopify pixels, analytics, and verification tags in minutes
                </Text>
                <Text as="p" variant="bodyLg" tone="subdued">
                  Install Meta Pixel, Facebook Pixel, Google Analytics, Google Tag Manager, TikTok Pixel, Microsoft Clarity, Hotjar, Google Search Console, and custom tracking scripts without touching theme files.
                </Text>
              </BlockStack>

              {/* Plan Limit Indicator */}
              <Card padding="500" background={canAddMore ? "bg-surface-secondary" : "bg-surface-critical"}>
                <InlineStack alignment="space-between" blockAlign="center">
                  <Box>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} Plan
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      {activeScriptCount} / {maxScripts === Infinity ? 'Unlimited' : maxScripts} active scripts
                    </Text>
                  </Box>
                  {!canAddMore && (
                    <Badge tone="critical">Limit Reached</Badge>
                  )}
                  {canAddMore && (
                    <Badge tone="success">Active</Badge>
                  )}
                </InlineStack>
              </Card>

              {/* Search and Filter Bar */}
              <Card padding="400">
                <InlineStack gap="400" blockAlign="center">
                  <Box style={{ flex: 1 }}>
                    <TextField
                      placeholder="Search integrations..."
                      value={searchQuery}
                      onChange={setSearchQuery}
                      clearButton
                      autoComplete="off"
                    />
                  </Box>
                  <Select
                    label="Category"
                    labelInline
                    options={[
                      { label: 'All', value: 'all' },
                      { label: 'Advertising', value: 'Advertising' },
                      { label: 'Analytics', value: 'Analytics' },
                      { label: 'Tracking', value: 'Tracking' },
                      { label: 'Verification', value: 'Verification' },
                      { label: 'Session Insights', value: 'Session Insights' },
                      { label: 'Custom', value: 'Custom' },
                    ]}
                    value={selectedCategory}
                    onChange={setSelectedCategory}
                  />
                </InlineStack>
              </Card>

              <Card padding="500" background="bg-surface-secondary">
                <BlockStack gap="300">
                  <InlineStack alignment="space-between" blockAlign="center">
                    <Text as="h2" variant="headingLg" fontWeight="semibold">
                      Launch checklist
                    </Text>
                    <Badge tone={outstandingSteps.length === 0 ? "success" : "info"}>
                      {outstandingSteps.length === 0 ? "Ready" : `${outstandingSteps.length} steps remaining`}
                    </Badge>
                  </InlineStack>
                  <BlockStack gap="200">
                    {setupSteps.map((step) => (
                      <InlineStack
                        key={step.id}
                        alignment="space-between"
                        blockAlign="center"
                        gap="300"
                        wrap
                      >
                        <InlineStack gap="200" blockAlign="center">
                          <Badge tone={step.complete ? "success" : "warning"}>
                            {step.complete ? "Done" : "Pending"}
                          </Badge>
                          <Text as="p" variant="bodyMd" fontWeight={step.complete ? "regular" : "semibold"}>
                            {step.label}
                          </Text>
                          {step.id === "theme-extension" && step.status && (
                            <Text as="span" tone="subdued" variant="bodySm">
                              Status: {step.status}
                            </Text>
                          )}
                        </InlineStack>
                        {!step.complete && step.ctaUrl && (
                          <Button
                            size="slim"
                            url={step.ctaUrl}
                            target={step.id === "theme-extension" ? "_blank" : undefined}
                            rel={step.id === "theme-extension" ? "noreferrer" : undefined}
                          >
                            {step.id === "theme-extension" ? "Enable extension" : "Complete step"}
                          </Button>
                        )}
                      </InlineStack>
                    ))}
                  </BlockStack>
                </BlockStack>
              </Card>

              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "24px"
              }}>
                {filteredPlatforms.map((platform) => {
                  const script = getScriptByPlatform(platform.id);
                  const isExpanded = expandedPlatform === platform.id;
                  const status = getPlatformStatus(platform.id);
                  const isConnected = status.label === 'Live';

                  return (
                    <Card 
                      key={platform.id} 
                      padding="600"
                      background={status.label === 'Live' ? "bg-surface-success-subdued" : status.label === 'Configured' ? "bg-surface-secondary" : undefined}
                    >
                      <BlockStack gap="400">
                        <InlineStack alignment="space-between" blockAlign="center">
                          <InlineStack gap="300" blockAlign="center">
                            <Text as="p" variant="heading2xl">{platform.icon}</Text>
                            <BlockStack gap="100">
                              <Text as="p" variant="headingLg" fontWeight="semibold">
                                {platform.name}
                              </Text>
                              <Badge size="small">{platform.category}</Badge>
                            </BlockStack>
                          </InlineStack>
                          <Badge tone={status.tone}>
                            {status.label}
                          </Badge>
                        </InlineStack>

                        <Button
                          variant={isConnected ? "secondary" : "primary"}
                          onClick={() => {
                            if (!isConnected && !canAddMore) {
                              shopify.toast.show(`Plan limit reached. Upgrade to add more scripts.`, { isError: true });
                              return;
                            }
                            isExpanded ? handleCollapse() : handleExpand(platform.id);
                          }}
                          fullWidth
                          disabled={!isConnected && !canAddMore}
                        >
                          {isExpanded ? "Cancel" : !canAddMore ? "Upgrade Required" : platform.cta || "Install Tracking Code"}
                        </Button>

                        {isExpanded && (
                          <Box padding="500" background="bg-surface-secondary" borderRadius="300">
                            <BlockStack gap="400">
                              <Text as="p" variant="bodyMd" tone="subdued">
                                {platform.helper}
                                {platform.helpLink && (
                                  <Text as="span" tone="subdued">
                                    {" "}
                                    <Link url={platform.helpLink} target="_blank" removeUnderline>
                                      How to get code
                                    </Link>
                                  </Text>
                                )}
                              </Text>

                              <TextField
                                label={platform.placeholder}
                                value={formData.code}
                                onChange={(value) => setFormData(prev => ({ ...prev, code: value }))}
                                placeholder={platform.placeholder}
                                multiline={platform.id === 'custom' ? 8 : 4}
                                autoComplete="off"
                              />

                              {platform.demoCode && (
                                <Button
                                  onClick={() => setFormData(prev => ({ ...prev, code: platform.demoCode }))}
                                  variant="tertiary"
                                  size="slim"
                                >
                                  Use Demo Code
                                </Button>
                              )}

                              <InlineStack gap="200">
                                <Button
                                  onClick={() => handleSubmit(platform)}
                                  disabled={!formData.code}
                                  loading={fetcher.state === "submitting"}
                                  variant="primary"
                                >
                                  Save & Install
                                </Button>
                                {script && (
                                  <>
                                    <Button
                                      onClick={() => handleToggle(script)}
                                      tone={script.status ? "critical" : "success"}
                                    >
                                      {script.status ? "Disable" : "Enable"}
                                    </Button>
                                    <Button
                                      onClick={() => handleDelete(script.id)}
                                      tone="critical"
                                    >
                                      Remove
                                    </Button>
                                  </>
                                )}
                              </InlineStack>

                              <div>
                                <Button
                                  size="slim"
                                  onClick={() => toggleAdvanced(platform.id)}
                                  disclosure={showAdvanced[platform.id] ? "up" : "down"}
                                >
                                  Advanced Settings
                                </Button>

                                {showAdvanced[platform.id] && (
                                  <BlockStack gap="300" style={{ marginTop: "16px" }}>
                                    <Select
                                      label="Where to load"
                                      options={PLACEMENT_OPTIONS}
                                      value={formData.placement}
                                      onChange={(value) => setFormData(prev => ({ ...prev, placement: value }))}
                                    />
                                    <Select
                                      label="Device targeting"
                                      options={DEVICE_OPTIONS}
                                      value={formData.deviceTarget}
                                      onChange={(value) => setFormData(prev => ({ ...prev, deviceTarget: value }))}
                                    />
                                    <Select
                                      label="Page targeting"
                                      options={PAGE_OPTIONS}
                                      value={formData.pageTarget}
                                      onChange={(value) => setFormData(prev => ({ ...prev, pageTarget: value }))}
                                    />
                                    {formData.pageTarget === "custom_urls" && (
                                      <TextField
                                        label="Specific URLs (comma-separated)"
                                        value={formData.customUrlRules}
                                        onChange={(value) => setFormData(prev => ({ ...prev, customUrlRules: value }))}
                                        placeholder="/products/*,/collections/special"
                                      />
                                    )}
                                  </BlockStack>
                                )}
                              </div>
                              {formError && (
                                <Banner status="critical" onDismiss={() => setFormError('')}>
                                  <Text as="p" variant="bodyMd">{formError}</Text>
                                </Banner>
                              )}
                            </BlockStack>
                          </Box>
                        )}
                      </BlockStack>
                    </Card>
                  );
                })}
              </div>
            </BlockStack>
          </Box>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
