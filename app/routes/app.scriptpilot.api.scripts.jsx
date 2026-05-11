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

    debugLog('ScriptPilot API: Fetching scripts for', shopDomain);

    // Find shop by domain
    const shop = await prisma.shop.findFirst({
      where: { shopifyDomain: { contains: shopDomain } }
    });

    if (!shop) {
      debugLog('ScriptPilot API: Shop not found');
      return json({ scripts: [] }, { headers: corsHeaders });
    }

    // Get active scripts for this shop
    const scripts = await prisma.script.findMany({
      where: {
        shopId: shop.id,
        status: true
      },
      orderBy: { priority: 'asc' }
    });

    debugLog('ScriptPilot API: Loaded', scripts.length, 'scripts');

    // Filter scripts based on targeting rules
    const filteredScripts = scripts.filter(script => {
      // Device targeting
      if (script.deviceTarget && script.deviceTarget !== 'all') {
        if (script.deviceTarget !== device) return false;
      }

      // Page targeting
      if (script.pageTarget && script.pageTarget !== 'all') {
        switch (script.pageTarget) {
          case 'all_pages':
            return true;
          case 'homepage':
            if (pageType !== 'index') return false;
            break;
          case 'product_pages':
            if (pageType !== 'product') return false;
            break;
          case 'collection_pages':
            if (pageType !== 'collection') return false;
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

    debugLog('ScriptPilot API: Returning', filteredScripts.length, 'filtered scripts');
    return json({ scripts: filteredScripts }, { headers: corsHeaders });

  } catch (error) {
    console.error('ScriptPilot API Error:', error);
    return json({ error: 'Failed to load scripts' }, { status: 500, headers: corsHeaders });
  }
};
