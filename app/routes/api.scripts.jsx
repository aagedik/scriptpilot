import { json } from "@remix-run/node";
import prisma from "../db.server";

const shouldLog = process.env.NODE_ENV !== "production";
const debugLog = (...args) => {
  if (shouldLog) {
    console.log(...args);
  }
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const loader = async ({ request }) => {
  // Handle OPTIONS preflight request
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  return json({ scripts: [] }, { headers: corsHeaders });
};

export const action = async ({ request }) => {
  debugLog('ScriptPilot API: Request received');

  // Handle OPTIONS preflight request
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const { shopDomain, device, path, pageType } = body;

    debugLog('ScriptPilot API: Incoming shopDomain:', shopDomain);
    debugLog('ScriptPilot API: Context:', { device, path, pageType });

    // Find shop by domain
    const shop = await prisma.shop.findFirst({
      where: { shopifyDomain: { contains: shopDomain } }
    });

    if (!shop) {
      debugLog('ScriptPilot API: Shop not found');
      return new Response('', { headers: corsHeaders });
    }

    debugLog('ScriptPilot API: Shop found:', shop.id);

    // Get active scripts for this shop
    const scripts = await prisma.script.findMany({
      where: {
        shopId: shop.id,
        status: true
      },
      orderBy: { priority: 'asc' }
    });

    debugLog('ScriptPilot API: Loaded', scripts.length, 'active scripts');

    // Filter scripts based on targeting rules
    const filteredScripts = scripts.filter(script => {
      // Device targeting
      if (script.deviceTarget && script.deviceTarget !== 'all') {
        if (script.deviceTarget !== device) return false;
      }

      // Page targeting
      if (script.pageTarget && script.pageTarget !== 'all') {
        switch (script.pageTarget) {
          case 'homepage':
            if (pageType !== 'index') return false;
            break;
          case 'product_pages':
            if (pageType !== 'product') return false;
            break;
          case 'collection_pages':
            if (pageType !== 'collection') return false;
            break;
          case 'cart':
            if (pageType !== 'cart') return false;
            break;
          case 'blog':
            if (!['blog', 'article'].includes(pageType)) return false;
            break;
          case 'search':
            if (pageType !== 'search') return false;
            break;
          case 'custom_urls':
            if (script.customUrlRules) {
              const rules = script.customUrlRules.split(',');
              const matches = rules.some(rule => {
                const cleanRule = rule.trim();
                if (cleanRule.includes('*')) {
                  const pattern = cleanRule.replace(/\*/g, '.*');
                  return new RegExp(pattern).test(path);
                }
                return path === cleanRule;
              });
              if (!matches) return false;
            }
            break;
          default:
            return true;
        }
      }

      return true;
    });

    debugLog('ScriptPilot API: Filtered to', filteredScripts.length, 'scripts');

    // Combine filtered script codes into one HTML string
    let combinedHtml = '';
    filteredScripts.forEach(script => {
      if (script.code) {
        combinedHtml += script.code + '\n';
      }
    });

    debugLog('ScriptPilot API: Returning HTML string (length:', combinedHtml.length, ')');

    // Return HTML string
    return new Response(combinedHtml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8'
      }
    });

  } catch (error) {
    console.error('ScriptPilot API Error:', error);
    return new Response('', { status: 500, headers: corsHeaders });
  }
};
