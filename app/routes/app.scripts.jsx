import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  DataTable,
  Button,
  Badge,
  Text,
  BlockStack,
  InlineStack,
  TextField,
  Select,
  FormLayout,
  Link,
  Box,
  Banner,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const shouldLog = typeof process !== "undefined" && process.env.NODE_ENV !== "production";
const debugLog = (...args) => {
  if (shouldLog) {
    console.log(...args);
  }
};

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

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

  if (!shopData) {
    return json({
      scripts,
      currentPlan,
      activeScriptCount,
      maxScripts,
      canAddMore,
      themeEditorUrl,
    });
  }

  return json({
    scripts,
    currentPlan,
    activeScriptCount,
    maxScripts,
    canAddMore,
    themeEditorUrl,
  });
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

    // Sync to metafield
    if (combinedHtml.trim().length > 0) {
      const response = await fetch(`https://${session.shop}/admin/api/2025-01/metafields.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': session.accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          metafield: {
            namespace: 'scriptpilot',
            key: 'body_scripts',
            value: combinedHtml,
            type: 'multi_line_text_field',
            owner_resource: 'shop'
          }
        })
      });
      if (!response.ok) {
        console.error('Failed to sync body_scripts:', await response.text());
      } else {
        debugLog('Scripts synced to body_scripts (length:', combinedHtml.length, ')');
      }
    }

    debugLog('All scripts synced to metafields successfully');
  } catch (error) {
    console.error('Error syncing to metafields:', error);
  }
}

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");
  const scriptId = formData.get("scriptId");

  // Get shop data for billing checks
  const shopData = await prisma.shop.findUnique({
    where: { shopifyDomain: shop },
    include: { scripts: true }
  });

  const currentPlan = shopData?.plan || 'free';
  const planLimits = {
    free: 1,
    basic: 5,
    pro: Infinity
  };
  const maxScripts = planLimits[currentPlan] || 1;
  const activeScriptCount = shopData?.scripts.filter(s => s.status).length || 0;

  if (intent === "save") {
    const platform = formData.get("platform");
    const code = formData.get("code");
    const placement = formData.get("placement");
    const deviceTarget = formData.get("deviceTarget");
    const pageTarget = formData.get("pageTarget");
    const customUrlRules = formData.get("customUrlRules");

    // Check if user can add more scripts
    const existingScript = await prisma.script.findFirst({
      where: { scriptType: platform, shop: { shopifyDomain: shop } }
    });

    if (!existingScript && activeScriptCount >= maxScripts) {
      return json({ 
        error: `Plan limit reached. Your ${currentPlan} plan allows ${maxScripts === Infinity ? 'unlimited' : maxScripts} active scripts. Upgrade to add more.` 
      }, { status: 400 });
    }

    let scriptCode = code;
    const platformData = PLATFORMS.find(p => p.id === platform);
    if (platformData && platformData.template) {
      scriptCode = platformData.template(code);
    }

    // Update shop's last activity
    const shopRecord = await prisma.shop.findUnique({
      where: { shopifyDomain: shop }
    });
    await prisma.shop.update({
      where: { id: shopRecord.id },
      data: { lastActivityAt: new Date() }
    });

    if (existingScript) {
      await prisma.script.update({
        where: { id: existingScript.id },
        data: {
          name: platformData?.name || platform,
          description: platformData?.description,
          code: scriptCode,
          placement,
          scriptType: platform,
          deviceTarget,
          pageTarget,
          customUrlRules,
          status: true
        }
      });
    } else {
      await prisma.script.create({
        data: {
          shopId: shopRecord.id,
          name: platformData?.name || platform,
          description: platformData?.description,
          code: scriptCode,
          placement,
          scriptType: platform,
          deviceTarget,
          pageTarget,
          customUrlRules,
          status: true
        }
      });
    }

    // Sync to metafields
    await syncScriptsToMetafields(shopRecord.id, session);

    // Log activity
    await prisma.activityLog.create({
      data: {
        shopId: shopRecord.id,
        action: existingScript ? 'script_updated' : 'script_created',
        scriptName: platformData?.name || platform,
        details: existingScript ? 'Script updated successfully' : 'Script created successfully'
      }
    });

    return json({ 
      success: true, 
      scriptName: platformData?.name || platform,
      message: existingScript ? 'Script updated successfully' : 'Script created successfully'
    });
  }

  if (intent === "toggle") {
    const script = await prisma.script.findUnique({
      where: { id: scriptId }
    });

    if (script) {
      const newStatus = !script.status;
      
      // Check if enabling would exceed plan limit
      if (newStatus && activeScriptCount >= maxScripts) {
        return json({ 
          error: `Plan limit reached. Your ${currentPlan} plan allows ${maxScripts === Infinity ? 'unlimited' : maxScripts} active scripts. Upgrade to enable more.` 
        }, { status: 400 });
      }

      await prisma.script.update({
        where: { id: scriptId },
        data: { status: newStatus }
      });

      // Sync to metafields
      const shopRecord = await prisma.shop.findUnique({
        where: { shopifyDomain: shop }
      });
      await syncScriptsToMetafields(shopRecord.id, session);

      return json({ success: true });
    }
  }

  if (intent === "delete") {
    await prisma.script.delete({
      where: { id: scriptId }
    });

    // Sync to metafields
    const shopRecord = await prisma.shop.findUnique({
      where: { shopifyDomain: shop }
    });
    await syncScriptsToMetafields(shopRecord.id, session);

    return json({ success: true });
  }

  return json({ error: "Invalid intent" }, { status: 400 });
};

const PLATFORMS = [
  {
    id: 'meta_pixel',
    name: 'Meta Pixel',
    description: 'Install Meta Pixel (Facebook Pixel) to measure Shopify conversions and retarget audiences.',
    icon: '📱',
    category: 'Advertising',
    cta: 'Add Meta Pixel',
    placeholder: 'Enter your Meta Pixel ID',
    helper: 'Find your Meta Pixel ID in Meta Events Manager > Data Sources.',
    helpLink: 'https://www.facebook.com/business/help/952192354843755',
    demoCode: '123456789012345',
    template: (code) => `<!-- Meta Pixel -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${code}');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${code}&ev=PageView&noscript=1"/></noscript>`
  },
  {
    id: 'google_analytics',
    name: 'Google Analytics',
    description: 'Connect Google Analytics to understand traffic, conversion funnels, and ecommerce revenue.',
    icon: '📊',
    category: 'Analytics',
    cta: 'Connect Google Analytics',
    placeholder: 'Enter your Google Measurement ID (G-XXXXXXXXXX)',
    helper: 'Get your Measurement ID from Google Analytics 4 > Admin > Data Streams.',
    helpLink: 'https://support.google.com/analytics/answer/9304153',
    demoCode: 'G-XXXX1234',
    template: (code) => `<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${code}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${code}');
</script>`
  },
  {
    id: 'google_tag_manager',
    name: 'Google Tag Manager',
    description: 'Add Google Tag Manager to manage Shopify pixels, marketing tags, and remarketing scripts in one place.',
    icon: '🏷️',
    category: 'Tracking',
    cta: 'Add Google Tag Manager',
    placeholder: 'Enter your GTM Container ID (GTM-XXXXX)',
    helper: 'Find your container ID in Google Tag Manager > Admin > Container Settings.',
    helpLink: 'https://support.google.com/tagmanager/answer/6103696',
    demoCode: 'GTM-ABC1234',
    template: (code) => `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var
n=window.pintrk={};n.queue=[],n.version="3.0";var
  t=document.createElement("script");t.async=!0;t.src=e;var
  r=document.getElementsByTagName("script")[0];
  r.parentNode.insertBefore(t,r)})(window,document,'script','dataLayer','${code}');</script>
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${code}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`
  },
  {
    id: 'tiktok_pixel',
    name: 'TikTok Pixel',
    description: 'Install TikTok Pixel to attribute TikTok ad spend to Shopify orders.',
    icon: '🎵',
    category: 'Advertising',
    cta: 'Add TikTok Pixel',
    placeholder: 'Enter your TikTok Pixel ID',
    helper: 'Copy your Pixel ID from TikTok Ads Manager > Assets > Events.',
    helpLink: 'https://ads.tiktok.com/help/article?aid=9666',
    demoCode: 'TTP123456789',
    template: (code) => `<!-- TikTok Pixel -->
<script>
!function (w, d, t) {
  w.TiktokAnalyticsObject=t;var taq=w.taq=w.taq||[];taq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],taq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<taq.methods.length;i++)taq.setAndDefer(taq,taq.methods[i]);taq.load=function(t,e){var i=document.createElement("script");i.type="text/javascript",i.async=!0,i.src="https://analytics.tiktok.com/i18n/pixel/events.js",i.addEventListener("load",function(){e()},i.addEventListener("error",function(){e()}),document.head.appendChild(i)};
  taq.load('${code}');
  taq.page();
</script>`
  },
  {
    id: 'snapchat_pixel',
    name: 'Snapchat Pixel',
    description: 'Add Snapchat Pixel to optimise Snapchat ad performance for Shopify conversions.',
    icon: '👻',
    category: 'Advertising',
    cta: 'Add Snapchat Pixel',
    placeholder: 'Enter your Snapchat Pixel ID',
    helper: 'Find your Snap Pixel ID in Snapchat Ads Manager > Events Manager.',
    helpLink: 'https://businesshelp.snapchat.com/s/article/pixel-website-install',
    demoCode: '1234-5678-9012-3456',
    template: (code) => `<!-- Snapchat Pixel -->
<script type='text/javascript'>
(function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};a.queue=[];var s='script';r=t.createElement(s);r.async=!0;r.src=n;r.getAttribute('data-country-code')||(r.setAttribute('data-country-code','us'));s=t.getElementsByTagName(s)[0];s.parentNode.insertBefore(r,s)})(window,document,'https://sc-static.net/scevent.min.js');
snaptr('init','${code}',{'user_email':'__USER_EMAIL__'});
snaptr('init','${id}',{
'user_email': '__INSERT_USER_EMAIL__',
'user_phone_number': '__INSERT_USER_PHONE_NUMBER__'
});
snaptr('track','PAGE_VIEW');
</script>`
  },
  {
    id: 'pinterest_tag',
    name: 'Pinterest Tag',
    description: 'Add Pinterest Tag to measure Pinterest ads and build remarketing audiences.',
    category: 'Advertising',
    cta: 'Add Pinterest Tag',
    placeholder: 'Paste your Pinterest Tag ID',
    helper: 'Find your Tag ID in Pinterest Ads Manager > Ads > Conversions',
    helpLink: 'https://help.pinterest.com/en/business/article/set-up-your-pinterest-tag',
    demoCode: '1234567890123',
    icon: '📌',
    template: (id) => `<!-- Pinterest Tag -->
<script>
!function(e){if(!window.pintrk){window.pintrk = function () {
window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var
  n=window.pintrk;n.queue=[],n.version="3.0";var
  t=document.createElement("script");t.async=!0,t.src=e;var
  r=document.getElementsByTagName("script")[0];
  r.parentNode.insertBefore(t,r)}("https://s.pinimg.com/ct/core.js");
pintrk('load', '${id}');
pintrk('page');
</script>
<noscript>
<img height="1" width="1" style="display:none;"
  alt="" class="pinteres-noscript-img"
  src="https://ct.pinterest.com/v3/?tid=${id}&noscript=1"/>
</noscript>`
  },
  {
    id: 'google_search_console',
    name: 'Google Search Console',
    description: 'Verify your Shopify store with Google Search Console to unlock search insights and indexing.',
    icon: '🔍',
    category: 'Verification',
    cta: 'Verify Google Search Console',
    placeholder: 'Paste your HTML tag verification code (content="...")',
    helper: 'Find your HTML tag in Google Search Console > Settings > Ownership verification',
    helpLink: 'https://support.google.com/webmasters/answer/9000072',
    demoCode: 'TEST123',
    template: (code) => `<meta name="google-site-verification" content="${code}" />`
  },
  {
    id: 'microsoft_clarity',
    name: 'Microsoft Clarity',
    description: 'Install Microsoft Clarity heatmaps and session recordings without editing Shopify theme files.',
    icon: '🪟',
    category: 'Session Insights',
    cta: 'Add Microsoft Clarity',
    placeholder: 'Paste your Clarity tracking code',
    helper: 'Copy the Clarity script from clarity.microsoft.com > Settings > Setup.',
    helpLink: 'https://learn.microsoft.com/en-us/clarity/setup-and-installation',
    template: (code) => code
  },
  {
    id: 'hotjar',
    name: 'Hotjar',
    description: 'Add Hotjar to capture heatmaps, recordings, and on-site feedback for Shopify stores.',
    icon: '🔥',
    category: 'Session Insights',
    cta: 'Install Hotjar',
    placeholder: 'Paste your Hotjar tracking code',
    helper: 'Find your Hotjar script in Hotjar > Sites & Organizations > Tracking.',
    helpLink: 'https://help.hotjar.com/hc/en-us/articles/115009336727-Install-Hotjar-on-Your-Site',
    template: (code) => code
  },
  {
    id: 'custom',
    name: 'Custom Script',
    description: 'Add custom tracking code, partner pixels, verification tags, or analytics snippets with no coding required.',
    icon: '⚡',
    category: 'Custom',
    cta: 'Add Custom Code',
    placeholder: 'Paste your custom script here',
    helper: 'Paste scripts from Shopify partners, analytics tools, verification providers, or custom pixels. Scripts are safely injected and removable anytime.',
    helpLink: 'https://help.shopify.com/en/manual/promoting-marketing/marketing/pixels',
    demoCode: '<script>console.log("Hello from ScriptPilot custom script!");</script>',
    template: (code) => code
  },
];

const DEVICE_OPTIONS = [
  { label: 'All Devices', value: 'all' },
  { label: 'Desktop Only', value: 'desktop' },
  { label: 'Mobile Only', value: 'mobile' }
];

const PAGE_OPTIONS = [
  { label: 'All Pages', value: 'all_pages' },
  { label: 'Homepage Only', value: 'homepage' },
  { label: 'Product Pages', value: 'product_pages' },
  { label: 'Collection Pages', value: 'collection_pages' },
  { label: 'Specific URLs', value: 'custom_urls' }
];

const PLACEMENT_OPTIONS = [
  { label: "Head", value: "head" },
  { label: "Body Start", value: "body_start" },
  { label: "Body End", value: "body_end" }
];

export default function ScriptsPage() {
  const { scripts, currentPlan, activeScriptCount, maxScripts, canAddMore, themeEditorUrl } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [expandedPlatform, setExpandedPlatform] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState({});
  const [formData, setFormData] = useState({
    code: '',
    placement: 'body',
    deviceTarget: 'all',
    pageTarget: 'all_pages',
    customUrlRules: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Toast notifications
  if (fetcher.data?.success) {
    if (!showSuccessBanner) {
      setSuccessMessage(`${fetcher.data.scriptName || 'Script'} is now live on your storefront`);
      setShowSuccessBanner(true);
      setTimeout(() => setShowSuccessBanner(false), 5000);
    }
    shopify.toast.show("Script saved successfully");
    fetcher.data = null;
  }
  if (fetcher.data?.error) {
    shopify.toast.show(fetcher.data.error, { isError: true });
    fetcher.data = null;
  }

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
      placement: script?.placement || (platform?.id === 'google_search_console' ? 'head' : 'body_end'),
      status: script?.status !== undefined ? script.status : true
    });
  }, [scripts]);

  const handleCollapse = useCallback(() => {
    setExpandedPlatform(null);
    setFormData({});
  }, []);

  const handleSubmit = useCallback((platform) => {
    const script = getScriptByPlatform(platform.id);
    
    // Detect if code is already the full meta tag/script (user pasted complete code)
    const isCompleteCode = formData.code.includes('<') && formData.code.includes('>');
    const finalCode = platform.id === 'custom' || isCompleteCode
      ? formData.code
      : platform.template(formData.code);

    if (script) {
      // Update existing
      fetcher.submit(
        { 
          ...formData,
          code: finalCode,
          name: platform.name,
          scriptType: platform.id,
          scriptId: script.id,
          intent: "update_script" 
        },
        { method: "post" }
      );
    } else {
      // Create new
      fetcher.submit(
        { 
          ...formData,
          code: finalCode,
          name: platform.name,
          scriptType: platform.id,
          intent: "create_script" 
        },
        { method: "post" }
      );
    }
    
    handleCollapse();
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

              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "24px"
              }}>
                {PLATFORMS.filter((platform) => {
                  const matchesSearch = platform.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                       platform.description.toLowerCase().includes(searchQuery.toLowerCase());
                  const matchesCategory = selectedCategory === 'all' || platform.category === selectedCategory;
                  return matchesSearch && matchesCategory;
                }).map((platform) => {
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
