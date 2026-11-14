import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return jsonResponse({ error: "Authentication required" }, 401);
    const url = Deno.env.get("SUPABASE_URL");
    const publishableKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
    const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
    if (!url || !publishableKeys || !secretKeys) return jsonResponse({ error: "Server configuration error" }, 500);
    const publicKey = JSON.parse(publishableKeys).default;
    const secretKey = JSON.parse(secretKeys).default;
    if (!publicKey || !secretKey) return jsonResponse({ error: "Supabase API keys unavailable" }, 500);

    const authClient = createClient(url, publicKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: authData, error: authError } = await authClient.auth.getUser(authorization.slice(7));
    if (authError || !authData.user) return jsonResponse({ error: "Invalid or expired session" }, 401);
    if (authData.user.app_metadata?.role !== "admin") return jsonResponse({ error: "Administrator access required" }, 403);

    const admin = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const authUsers = [];
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      authUsers.push(...data.users);
      if (data.users.length < 1000) break;
    }

    const [profilesResult, addressesResult, ordersResult] = await Promise.all([
      admin.from("profiles").select("id,full_name,phone,created_at"),
      admin.from("addresses").select("id,user_id,recipient_name,phone,address_line1,address_line2,landmark,locality,city,district,state,postal_code,is_default"),
      admin.from("orders").select("id,user_id,order_code,status,grand_total,created_at").order("created_at", { ascending: false }),
    ]);
    if (profilesResult.error) throw profilesResult.error;
    if (addressesResult.error) throw addressesResult.error;
    if (ordersResult.error) throw ordersResult.error;

    const profiles = new Map((profilesResult.data || []).map((p) => [p.id, p]));
    const addressMap = new Map<string, typeof addressesResult.data>();
    const orderMap = new Map<string, typeof ordersResult.data>();
    for (const a of addressesResult.data || []) addressMap.set(a.user_id, [...(addressMap.get(a.user_id) || []), a]);
    for (const o of ordersResult.data || []) orderMap.set(o.user_id, [...(orderMap.get(o.user_id) || []), o]);

    const customers = authUsers
      .filter((u) => u.app_metadata?.role !== "admin" && !u.is_anonymous)
      .map((u) => {
        const profile = profiles.get(u.id);
        const customerOrders = orderMap.get(u.id) || [];
        return {
          id: u.id,
          email: u.email || "",
          full_name: profile?.full_name || u.user_metadata?.full_name || "",
          phone: profile?.phone || u.user_metadata?.phone || u.phone || null,
          created_at: u.created_at,
          email_confirmed_at: u.email_confirmed_at || null,
          addresses: addressMap.get(u.id) || [],
          orders: customerOrders,
          total_spent: customerOrders.reduce((sum, order) => sum + Number(order.grand_total || 0), 0),
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return jsonResponse({ success: true, customers });
  } catch (error) {
    console.error("Admin customer list failed:", error);
    return jsonResponse({ error: "Unable to load customer records. Please try again." }, 500);
  }
});
