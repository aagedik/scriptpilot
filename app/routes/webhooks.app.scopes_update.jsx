import { authenticate } from "../shopify.server";
import db from "../db.server";

const shouldLog = process.env.NODE_ENV !== "production";
const debugLog = (...args) => {
  if (shouldLog) {
    console.log(...args);
  }
};

export const action = async ({ request }) => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);

  debugLog(`Received ${topic} webhook for ${shop}`);
  const current = payload.current;

  if (session) {
    await db.session.update({
      where: {
        id: session.id,
      },
      data: {
        scope: current.toString(),
      },
    });
  }

  return new Response();
};
