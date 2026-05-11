const MAX_SCRIPT_LENGTH = 12000;

const escapeForSingleQuotes = (value) =>
  value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

const escapeForDoubleQuotes = (value) => value.replace(/"/g, "&quot;");

const isSnippet = (value) => /<\s*(script|meta|iframe|noscript)/i.test(value);

const enforceLength = (value, limit = MAX_SCRIPT_LENGTH) => {
  if (value.length > limit) {
    return {
      ok: false,
      error: `The snippet is too long. Limit your code to ${limit.toLocaleString()} characters.`,
    };
  }

  return { ok: true };
};

export const PLACEMENT_OPTIONS = [
  { label: "Head", value: "head" },
  { label: "Body Start", value: "body_start" },
  { label: "Body End", value: "body_end" },
];

export const DEVICE_OPTIONS = [
  { label: "All Devices", value: "all" },
  { label: "Desktop Only", value: "desktop" },
  { label: "Mobile Only", value: "mobile" },
];

export const PAGE_OPTIONS = [
  { label: "All Pages", value: "all_pages" },
  { label: "Homepage Only", value: "homepage" },
  { label: "Product Pages", value: "product_pages" },
  { label: "Collection Pages", value: "collection_pages" },
  { label: "Specific URLs", value: "custom_urls" },
];

const buildMetaPixelSnippet = (id) => {
  const safeIdJs = escapeForSingleQuotes(id);
  const safeIdUrl = encodeURIComponent(id);

  return `<!-- Meta Pixel -->\n<script>\n  !function(f,b,e,v,n,t,s)\n  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?\n  n.callMethod.apply(n,arguments):n.queue.push(arguments)};\n  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';\n  n.queue=[];t=b.createElement(e);t.async=!0;\n  t.src=v;s=b.getElementsByTagName(e)[0];\n  s.parentNode.insertBefore(t,s)}(window, document,'script',\n  'https://connect.facebook.net/en_US/fbevents.js');\n  fbq('init', '${safeIdJs}');\n  fbq('track', 'PageView');\n</script>\n<noscript><img height="1" width="1" style="display:none"\n  src="https://www.facebook.com/tr?id=${safeIdUrl}&ev=PageView&noscript=1"\n/></noscript>`;
};

const buildGaSnippet = (id) => {
  const safeId = escapeForSingleQuotes(id);
  return `<!-- Google Analytics -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=${safeId}"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag('js', new Date());\n  gtag('config', '${safeId}');\n</script>`;
};

const buildGtmSnippet = (id) => {
  const safeIdJs = escapeForSingleQuotes(id);
  const safeIdUrl = encodeURIComponent(id);
  return `<!-- Google Tag Manager -->\n<script>\n  (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':\n  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],\n  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=\n  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);\n  })(window,document,'script','dataLayer','${safeIdJs}');\n</script>\n<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${safeIdUrl}"\nheight="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`;
};

const buildTikTokSnippet = (id) => {
  const safeId = escapeForSingleQuotes(id);
  return `<!-- TikTok Pixel -->\n<script>\n  !function (w, d, t) {\n    w.TiktokAnalyticsObject=t;var taq=w.taq=w.taq||[];taq.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie'];\n    taq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};\n    for(var i=0;i<taq.methods.length;i++)taq.setAndDefer(taq,taq.methods[i]);\n    taq.load=function(t){\n      var s=d.createElement('script');\n      s.async=!0;\n      s.src='https://analytics.tiktok.com/i18n/pixel/events.js';\n      var e=d.getElementsByTagName('script')[0];\n      e.parentNode.insertBefore(s,e);\n    };\n    taq.load('${safeId}');\n    taq.page();\n  }(window, document, 'script');\n</script>`;
};

const buildSnapSnippet = (id) => {
  const safeId = escapeForSingleQuotes(id);
  return `<!-- Snapchat Pixel -->\n<script type="text/javascript">\n  (function(w,d){\n    if(w.snaptr)return;var s=w.snaptr=function(){s.handleRequest?s.handleRequest.apply(s,arguments):s.queue.push(arguments)};\n    s.queue=[];var t=d.createElement('script');t.async=!0;t.src='https://sc-static.net/scevent.min.js';\n    var f=d.getElementsByTagName('script')[0];f.parentNode.insertBefore(t,f);\n  })(window,document);\n  snaptr('init', '${safeId}');\n  snaptr('track', 'PAGE_VIEW');\n</script>`;
};

const buildPinterestSnippet = (id) => {
  const safeId = escapeForSingleQuotes(id);
  const safeIdUrl = encodeURIComponent(id);
  return `<!-- Pinterest Tag -->\n<script>\n  !function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var\n  n=window.pintrk;n.queue=[],n.version='3.0';var t=document.createElement('script');t.async=!0;t.src=e;\n  var r=document.getElementsByTagName('script')[0];r.parentNode.insertBefore(t,r)}}('https://s.pinimg.com/ct/core.js');\n  pintrk('load', '${safeId}');\n  pintrk('page');\n</script>\n<noscript><img height="1" width="1" style="display:none"\n  src="https://ct.pinterest.com/v3/?tid=${safeIdUrl}&noscript=1" alt="" /></noscript>`;
};

const buildGoogleSearchConsoleMeta = (content) => {
  const safeContent = escapeForDoubleQuotes(content);
  return `<meta name="google-site-verification" content="${safeContent}" />`;
};

const PLATFORM_DEFINITIONS = [
  {
    id: "meta_pixel",
    name: "Meta Pixel",
    description: "Install Meta Pixel (Facebook Pixel) to measure Shopify conversions and retarget audiences.",
    icon: "📱",
    category: "Advertising",
    cta: "Add Meta Pixel",
    placeholder: "Enter your Meta Pixel ID",
    helper: "Find your Meta Pixel ID in Meta Events Manager > Data Sources.",
    helpLink: "https://www.facebook.com/business/help/952192354843755",
    demoCode: "123456789012345",
    defaultPlacement: "head",
    pattern: /^\d{5,20}$/,
    patternMessage: "Meta Pixel IDs contain 5–20 digits (example: 123456789012345).",
    buildFromId: buildMetaPixelSnippet,
    acceptSnippetPassthrough: true,
  },
  {
    id: "google_analytics",
    name: "Google Analytics",
    description: "Connect Google Analytics to understand traffic, conversion funnels, and ecommerce revenue.",
    icon: "📊",
    category: "Analytics",
    cta: "Connect Google Analytics",
    placeholder: "Enter your Google Measurement ID (G-XXXXXXXXXX)",
    helper: "Get your Measurement ID from Google Analytics 4 > Admin > Data Streams.",
    helpLink: "https://support.google.com/analytics/answer/9304153",
    demoCode: "G-XXXX1234",
    defaultPlacement: "head",
    pattern: /^G-[A-Z0-9]{4,16}$/i,
    patternMessage: "Google Measurement IDs look like G-XXXX1234.",
    normalize: (value) => value.toUpperCase(),
    buildFromId: buildGaSnippet,
    acceptSnippetPassthrough: true,
  },
  {
    id: "google_tag_manager",
    name: "Google Tag Manager",
    description: "Add Google Tag Manager to manage Shopify pixels, marketing tags, and remarketing scripts in one place.",
    icon: "🏷️",
    category: "Tracking",
    cta: "Add Google Tag Manager",
    placeholder: "Enter your GTM Container ID (GTM-XXXXX)",
    helper: "Find your container ID in Google Tag Manager > Admin > Container Settings.",
    helpLink: "https://support.google.com/tagmanager/answer/6103696",
    demoCode: "GTM-ABC1234",
    defaultPlacement: "head",
    pattern: /^GTM-[A-Z0-9]{3,16}$/i,
    patternMessage: "GTM container IDs look like GTM-ABC1234.",
    normalize: (value) => value.toUpperCase(),
    buildFromId: buildGtmSnippet,
    acceptSnippetPassthrough: true,
  },
  {
    id: "tiktok_pixel",
    name: "TikTok Pixel",
    description: "Install TikTok Pixel to attribute TikTok ad spend to Shopify orders.",
    icon: "🎵",
    category: "Advertising",
    cta: "Add TikTok Pixel",
    placeholder: "Enter your TikTok Pixel ID",
    helper: "Copy your Pixel ID from TikTok Ads Manager > Assets > Events.",
    helpLink: "https://ads.tiktok.com/help/article?aid=9666",
    demoCode: "TTP123456789",
    defaultPlacement: "head",
    pattern: /^TTP[a-zA-Z0-9]{5,}$/,
    patternMessage: "TikTok Pixel IDs start with TTP followed by letters or numbers.",
    normalize: (value) => value.toUpperCase(),
    buildFromId: buildTikTokSnippet,
    acceptSnippetPassthrough: true,
  },
  {
    id: "snapchat_pixel",
    name: "Snapchat Pixel",
    description: "Add Snapchat Pixel to optimise Snapchat ad performance for Shopify conversions.",
    icon: "👻",
    category: "Advertising",
    cta: "Add Snapchat Pixel",
    placeholder: "Enter your Snapchat Pixel ID",
    helper: "Find your Snap Pixel ID in Snapchat Ads Manager > Events Manager.",
    helpLink: "https://businesshelp.snapchat.com/s/article/pixel-website-install",
    demoCode: "1234-5678-9012-3456",
    defaultPlacement: "head",
    pattern: /^[a-zA-Z0-9-]{10,}$/,
    patternMessage: "Snap Pixel IDs contain letters, numbers, or dashes (example: 1234-5678-9012-3456).",
    normalize: (value) => value.toUpperCase(),
    buildFromId: buildSnapSnippet,
    acceptSnippetPassthrough: true,
  },
  {
    id: "pinterest_tag",
    name: "Pinterest Tag",
    description: "Add Pinterest Tag to measure Pinterest ads and build remarketing audiences.",
    icon: "📌",
    category: "Advertising",
    cta: "Add Pinterest Tag",
    placeholder: "Paste your Pinterest Tag ID",
    helper: "Find your Tag ID in Pinterest Ads Manager > Ads > Conversions.",
    helpLink: "https://help.pinterest.com/en/business/article/set-up-your-pinterest-tag",
    demoCode: "1234567890123",
    defaultPlacement: "head",
    pattern: /^\d{7,20}$/,
    patternMessage: "Pinterest Tag IDs contain digits only (example: 1234567890123).",
    buildFromId: buildPinterestSnippet,
    acceptSnippetPassthrough: true,
  },
  {
    id: "google_search_console",
    name: "Google Search Console",
    description: "Verify your Shopify store with Google Search Console to unlock search insights and indexing.",
    icon: "🔍",
    category: "Verification",
    cta: "Verify Google Search Console",
    placeholder: "Paste your HTML tag verification code (content=\"...\")",
    helper: "Find your HTML tag in Google Search Console > Settings > Ownership verification.",
    helpLink: "https://support.google.com/webmasters/answer/9000072",
    demoCode: "TEST1234567890",
    defaultPlacement: "head",
    pattern: /^[A-Za-z0-9_-]{10,90}$/,
    patternMessage: "Paste the verification token from Google (letters, numbers, dashes, or underscores).",
    buildFromId: buildGoogleSearchConsoleMeta,
    acceptSnippetPassthrough: true,
  },
  {
    id: "microsoft_clarity",
    name: "Microsoft Clarity",
    description: "Install Microsoft Clarity heatmaps and session recordings without editing Shopify theme files.",
    icon: "🪟",
    category: "Session Insights",
    cta: "Add Microsoft Clarity",
    placeholder: "Paste your Clarity tracking code",
    helper: "Copy the Clarity script from clarity.microsoft.com > Settings > Setup.",
    helpLink: "https://learn.microsoft.com/en-us/clarity/setup-and-installation",
    defaultPlacement: "body_end",
    requireSnippet: true,
    maxLength: 8000,
  },
  {
    id: "hotjar",
    name: "Hotjar",
    description: "Add Hotjar to capture heatmaps, recordings, and on-site feedback for Shopify stores.",
    icon: "🔥",
    category: "Session Insights",
    cta: "Install Hotjar",
    placeholder: "Paste your Hotjar tracking code",
    helper: "Find your Hotjar script in Hotjar > Sites & Organizations > Tracking.",
    helpLink: "https://help.hotjar.com/hc/en-us/articles/115009336727-Install-Hotjar-on-Your-Site",
    defaultPlacement: "body_end",
    requireSnippet: true,
    maxLength: 8000,
  },
  {
    id: "custom",
    name: "Custom Script",
    description: "Add custom tracking code, partner pixels, verification tags, or analytics snippets with no coding required.",
    icon: "⚡",
    category: "Custom",
    cta: "Add Custom Code",
    placeholder: "Paste your custom script here",
    helper: "Paste scripts from Shopify partners, analytics tools, verification providers, or custom pixels. Scripts are safely injected and removable anytime.",
    helpLink: "https://help.shopify.com/en/manual/promoting-marketing/marketing/pixels",
    defaultPlacement: "body_end",
    requireSnippet: true,
    maxLength: MAX_SCRIPT_LENGTH,
  },
];

export const SCRIPT_PLATFORMS = PLATFORM_DEFINITIONS;

export const SCRIPT_PLATFORM_VALUES = new Set(
  PLATFORM_DEFINITIONS.map((platform) => platform.id)
);

export const DEVICE_OPTION_VALUES = new Set(
  DEVICE_OPTIONS.map((option) => option.value)
);

export const PAGE_OPTION_VALUES = new Set(
  PAGE_OPTIONS.map((option) => option.value)
);

export const PLACEMENT_OPTION_VALUES = new Set(
  PLACEMENT_OPTIONS.map((option) => option.value)
);

export const getPlatformById = (id) =>
  PLATFORM_DEFINITIONS.find((platform) => platform.id === id);

export function transformPlatformInput(platformId, rawInput) {
  const platform = getPlatformById(platformId);

  if (!platform) {
    return { ok: false, error: "Unsupported script platform." };
  }

  const value = (rawInput ?? "").toString().trim();

  if (!value) {
    return {
      ok: false,
      error: `Enter your ${platform.name} code before saving.`,
    };
  }

  const lengthCheck = enforceLength(value, platform.maxLength ?? MAX_SCRIPT_LENGTH);
  if (!lengthCheck.ok) {
    return lengthCheck;
  }

  const snippetDetected = isSnippet(value);

  if (snippetDetected) {
    if (platform.requireSnippet === false) {
      // fall through to ID-based template handling
    } else {
      return { ok: true, code: value };
    }
  }

  if (platform.requireSnippet && !snippetDetected) {
    return {
      ok: false,
      error: `Paste the full ${platform.name} snippet from the provider.`,
    };
  }

  if (!snippetDetected && platform.pattern && !platform.pattern.test(value)) {
    return {
      ok: false,
      error: platform.patternMessage || `The ${platform.name} identifier you entered is not recognized.`,
    };
  }

  if (!platform.buildFromId) {
    return { ok: true, code: value };
  }

  const normalizedValue = platform.normalize ? platform.normalize(value) : value;
  const code = platform.buildFromId(normalizedValue);

  return { ok: true, code };
}

export function defaultPlacementForPlatform(platformId) {
  const platform = getPlatformById(platformId);
  return platform?.defaultPlacement || "body_end";
}

export const MAX_SNIPPET_LENGTH = MAX_SCRIPT_LENGTH;
