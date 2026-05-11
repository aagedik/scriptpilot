// Email Service - Resend Integration
// Prepare infrastructure for welcome emails, upgrade reminders, payment failed emails, announcements

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_API_URL = "https://api.resend.com/emails";

export async function sendEmail({ to, subject, html, from = "noreply@scriptpilot.com" }) {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured. Email not sent.");
    return { success: false, error: "Email service not configured" };
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to send email");
    }

    return { success: true, data };
  } catch (error) {
    console.error("Email send error:", error);
    return { success: false, error: error.message };
  }
}

export async function sendWelcomeEmail({ shopDomain, merchantEmail }) {
  const subject = "Welcome to ScriptPilot!";
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #008060; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .button { display: inline-block; background: #008060; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to ScriptPilot</h1>
        </div>
        <div class="content">
          <p>Hi there!</p>
          <p>Welcome to ScriptPilot! We're excited to help you manage tracking scripts for your Shopify store.</p>
          <p>With ScriptPilot, you can:</p>
          <ul>
            <li>Add Meta Pixel, Google Analytics, and more without editing theme files</li>
            <li>Manage all your tracking codes in one place</li>
            <li>Target scripts by device and page</li>
          </ul>
          <a href="https://${shopDomain}/admin/apps/script-pilot" class="button">Get Started</a>
          <p>If you have any questions, feel free to reach out to our support team.</p>
          <p>Happy tracking!</p>
        </div>
        <div class="footer">
          <p>&copy; 2024 ScriptPilot. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to: merchantEmail, subject, html });
}

export async function sendUpgradeReminder({ shopDomain, merchantEmail, currentPlan }) {
  const subject = "Upgrade your ScriptPilot plan";
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #008060; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .button { display: inline-block; background: #008060; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Unlock More Power</h1>
        </div>
        <div class="content">
          <p>Hi there!</p>
          <p>You're currently on the <strong>${currentPlan}</strong> plan. Upgrade to unlock more features:</p>
          <ul>
            <li><strong>Basic ($4.99/mo):</strong> 5 active scripts, all platforms</li>
            <li><strong>Pro ($12.99/mo):</strong> Unlimited scripts, advanced features</li>
          </ul>
          <a href="https://${shopDomain}/admin/apps/script-pilot/settings" class="button">Upgrade Now</a>
          <p>Questions? Our support team is here to help.</p>
        </div>
        <div class="footer">
          <p>&copy; 2024 ScriptPilot. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to: merchantEmail, subject, html });
}

export async function sendPaymentFailedEmail({ shopDomain, merchantEmail }) {
  const subject = "Payment Failed - ScriptPilot Subscription";
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .button { display: inline-block; background: #008060; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Payment Failed</h1>
        </div>
        <div class="content">
          <p>Hi there!</p>
          <p>We were unable to process your payment for ScriptPilot. This may be due to an expired card or insufficient funds.</p>
          <p><strong>Please update your payment method to avoid service interruption.</strong></p>
          <a href="https://${shopDomain}/admin/apps/script-pilot/settings" class="button">Update Payment</a>
          <p>If you believe this is an error, please contact our support team.</p>
        </div>
        <div class="footer">
          <p>&copy; 2024 ScriptPilot. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to: merchantEmail, subject, html });
}

export async function sendAnnouncementEmail({ shopDomain, merchantEmail, title, content }) {
  const subject = `ScriptPilot Announcement: ${title}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #008060; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>ScriptPilot Update</h1>
        </div>
        <div class="content">
          <h2>${title}</h2>
          <p>${content}</p>
          <a href="https://${shopDomain}/admin/apps/script-pilot" class="button">View in App</a>
        </div>
        <div class="footer">
          <p>&copy; 2024 ScriptPilot. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to: merchantEmail, subject, html });
}
