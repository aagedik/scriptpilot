// REMOVED: Custom auth.session-token implementation to restore Shopify default embedded auth flow
// The custom bounce page was bypassing App Bridge authenticated fetch, preventing Authorization header propagation
// Shopify's default embedded auth strategy (unstable_newEmbeddedAuthStrategy: true) handles token propagation correctly
