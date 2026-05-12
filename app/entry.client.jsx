import { RemixBrowser } from "@remix-run/react";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";

console.log("[bridge-debug][entry.client]", {
  phase: "before-hydration",
  shopifyGlobal: !!window.shopify,
  appBridgeGlobal: !!window.appBridge,
  topEqualsSelf: window.top === window.self,
});

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RemixBrowser />
    </StrictMode>
  );
});

console.log("[bridge-debug][entry.client]", {
  phase: "after-hydration",
  shopifyGlobal: !!window.shopify,
  appBridgeGlobal: !!window.appBridge,
  topEqualsSelf: window.top === window.self,
});

setTimeout(() => {
  console.log("[bridge-debug][entry.client]", {
    phase: "500ms-after-hydration",
    shopifyGlobal: !!window.shopify,
    appBridgeGlobal: !!window.appBridge,
    topEqualsSelf: window.top === window.self,
  });
}, 500);
