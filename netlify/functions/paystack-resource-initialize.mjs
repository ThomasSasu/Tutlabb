import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const reply = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export default async (request) => {
  if (request.method !== "POST") return reply({ error: "Method not allowed." }, 405);
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  const appUrl = (process.env.APP_URL || "https://tutlabb.netlify.app").replace(/\/$/, "");
  if (!url || !secret || !paystackSecret) return reply({ error: "The payment service is not configured." }, 503);
  const db = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return reply({ error: "Please sign in before purchasing this resource." }, 401);
  const { data: auth, error: authError } = await db.auth.getUser(token);
  const user = auth?.user;
  if (authError || !user?.id || !user.email) return reply({ error: "Your sign-in session has expired." }, 401);
  const input = await request.json().catch(() => ({}));
  const resourceId = String(input.resourceId || "").trim();
  const { data: resource } = await db
    .from("paid_resources")
    .select("id,title,course,price,currency,status")
    .eq("id", resourceId)
    .eq("status", "published")
    .maybeSingle();
  if (!resource) return reply({ error: "This resource is not available." }, 404);

  const { data: owned } = await db
    .from("resource_purchases")
    .select("id")
    .eq("resource_id", resource.id)
    .eq("buyer_id", user.id)
    .eq("payment_status", "paid")
    .maybeSingle();
  if (owned) return reply({ alreadyPurchased: true, resourceId: resource.id });

  const amountSubunit = Math.round(Number(resource.price) * 100);
  if (!Number.isSafeInteger(amountSubunit) || amountSubunit < 100)
    return reply({ error: "This resource does not have a valid price." }, 409);
  const amount = amountSubunit / 100;
  const creatorPayout = Math.round(amount * 0.8 * 100) / 100;
  const reference = `tutlab_resource_${Date.now()}_${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
  const { data: purchase, error: purchaseError } = await db
    .from("resource_purchases")
    .insert({ resource_id: resource.id, buyer_id: user.id, amount, amount_subunit: amountSubunit, currency: "GHS", payment_reference: reference, payment_status: "pending", creator_payout: creatorPayout, platform_share: Math.round((amount - creatorPayout) * 100) / 100 })
    .select("id")
    .single();
  if (purchaseError) return reply({ error: "The purchase could not be created." }, 500);

  const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${paystackSecret}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: user.email,
      amount: amountSubunit,
      currency: "GHS",
      reference,
      callback_url: `${appUrl}/resource-payment/callback`,
      metadata: { purchase_type: "past_question", purchase_id: purchase.id, resource_id: resource.id, buyer_id: user.id, custom_fields: [{ display_name: "Resource", variable_name: "resource", value: resource.title }, { display_name: "Course", variable_name: "course", value: resource.course }] },
    }),
  });
  const paystack = await paystackResponse.json().catch(() => null);
  if (!paystackResponse.ok || !paystack?.status || !paystack?.data?.authorization_url) {
    await db.from("resource_purchases").update({ payment_status: "initialization_failed", paystack_status: "initialize_failed" }).eq("id", purchase.id);
    return reply({ error: paystack?.message || "Paystack could not start this payment." }, 502);
  }
  return reply({ authorizationUrl: paystack.data.authorization_url, reference, resourceId: resource.id });
};
