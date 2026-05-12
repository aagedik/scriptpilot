import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  return await authenticate.admin(request);
};
