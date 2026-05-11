import { json, redirect } from "@remix-run/node";
import { Form } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  TextField,
  Button,
  InlineStack,
  Box,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

export async function action({ request }) {
  const {
    verifyAdminCredentials,
    recordFailedLogin,
    isAccountLocked,
    resetFailedLoginAttempts,
  } = await import("../services/admin.auth.server");
  const { createAdminHeaders } = await import("../services/admin.session.server");
  const { logAdminLogin, logFailedLogin } = await import("../services/audit.server");

  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  
  const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  // Check if account is locked
  if (isAccountLocked(email)) {
    await logFailedLogin({ email, ipAddress, userAgent });
    return json({ error: "Account locked due to too many failed attempts. Try again later." }, { status: 429 });
  }

  // Verify credentials with bcrypt
  const isValid = await verifyAdminCredentials(email, password);

  if (isValid) {
    // Reset failed login attempts on successful login
    resetFailedLoginAttempts(email);
    
    // Log successful login
    await logAdminLogin({ adminEmail: email, ipAddress, userAgent });
    
    // Create secure cookie session
    const headers = await createAdminHeaders(email);
    
    return redirect("/admin", { headers });
  }

  // Record failed login attempt
  recordFailedLogin(email);
  
  // Log failed login
  await logFailedLogin({ email, ipAddress, userAgent });

  return json({ error: "Invalid credentials" }, { status: 401 });
}

export default function AdminLogin() {
  return (
    <Page>
      <TitleBar title="Admin Login" />
      <Box style={{ maxWidth: "400px", margin: "100px auto" }}>
        <Card padding="600">
          <BlockStack gap="500">
            <Text as="h1" variant="headingXl" fontWeight="bold" alignment="center">
              Admin Login
            </Text>
            <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
              Access ScriptPilot admin panel
            </Text>
            <Divider />
            <Form method="post">
              <BlockStack gap="400">
                <TextField
                  label="Email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@scriptpilot.com"
                />
                <TextField
                  label="Password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
                <Button variant="primary" submit fullWidth>
                  Login
                </Button>
              </BlockStack>
            </Form>
          </BlockStack>
        </Card>
      </Box>
    </Page>
  );
}
