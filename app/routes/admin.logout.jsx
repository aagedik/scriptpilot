import { redirect } from "@remix-run/node";
import { destroyAdminSession } from "../services/admin.session.server";

export async function loader({ request }) {
  const headers = await destroyAdminSession(request);
  return redirect("/admin/login", { headers });
}

export default function AdminLogout() {
  return null;
}
