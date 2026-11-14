
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Authentication required" }, 401);
    }

    const token = authHeader.substring(7);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const publishableKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
    const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");

    if (!supabaseUrl || !publishableKeys || !secretKeys) {
      console.error("Required Supabase environment variables are missing");
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    const publicKey = JSON.parse(publishableKeys).default;
    const secretKey = JSON.parse(secretKeys).default;

    if (!publicKey || !secretKey) {
      return jsonResponse({ error: "Supabase API keys are unavailable" }, 500);
    }

    // Verify the customer's actual Supabase session.
    const authClient = createClient(supabaseUrl, publicKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse({ error: "Invalid or expired session" }, 401);
    }

    // The secret client stays inside this Edge Function.
    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const body = await req.json();

    const addressId = body.address_id;
    const items = body.items;
    const customerNote = body.customer_note ?? null;

    if (
      typeof addressId !== "string" ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return jsonResponse({ error: "Invalid checkout information" }, 400);
    }

    const cleanItems = items.map((item: { product_id?: string; quantity?: number }) => ({
      product_id: item.product_id,
      quantity: item.quantity,
    }));

    if (
      cleanItems.some(
        (item: { product_id?: string; quantity?: number }) =>
          typeof item.product_id !== "string" ||
          !Number.isInteger(item.quantity) ||
          item.quantity! < 1 ||
          item.quantity! > 20
      )
    ) {
      return jsonResponse({ error: "Invalid product or quantity" }, 400);
    }

    // User ID comes from the verified session, never from the browser.
    const { data: order, error: orderError } = await adminClient.rpc(
      "create_cod_order",
      {
        p_user_id: user.id,
        p_address_id: addressId,
        p_items: cleanItems,
        p_customer_note: customerNote,
      }
    );

    if (orderError) {
      console.error("Order creation failed:", orderError.message);
      return jsonResponse(
        { error: orderError.message || "Unable to place order" },
        400
      );
    }

    return jsonResponse({
      success: true,
      message: "Your COD order has been placed successfully",
      order,
    });
  } catch (error) {
    console.error("Unexpected checkout error:", error);
    return jsonResponse({ error: "Something went wrong" }, 500);
  }
});
