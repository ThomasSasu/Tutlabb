import { createClient } from "@supabase/supabase-js";

const reply = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export default async (request) => {
  if (request.method !== "GET") return reply({ error: "Method not allowed." }, 405);
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  if (!url || !secret || !paystackSecret) return reply({ error: "The payment service is not configured." }, 503);
  const db = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return reply({ error: "Please sign in to verify this purchase." }, 401);
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth?.user?.id) return reply({ error: "Your sign-in session has expired." }, 401);
  const reference = new URL(request.url).searchParams.get("reference") || "";
  const { data: purchase } = await db.from("resource_purchases").select("*").eq("payment_reference", reference).eq("buyer_id", auth.user.id).maybeSingle();
  if (!purchase) return reply({ error: "Purchase not found." }, 404);
  const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${paystackSecret}` } });
  const verification = await paystackResponse.json().catch(() => null);
  if (!paystackResponse.ok || !verification?.status || !verification?.data) return reply({ error: verification?.message || "Paystack could not verify this purchase." }, 502);
  const transaction = verification.data;
  const valid = transaction.reference === purchase.payment_reference && Number(transaction.amount) === Number(purchase.amount_subunit) && String(transaction.currency || "").toUpperCase() === String(purchase.currency).toUpperCase() && (!transaction.metadata?.purchase_id || transaction.metadata.purchase_id === purchase.id);
  if (!valid) return reply({ error: "The payment does not match this purchase." }, 409);
  if (transaction.status !== "success") {
    await db.from("resource_purchases").update({ paystack_status: transaction.status || "pending" }).eq("id", purchase.id).neq("payment_status", "paid");
    return reply({ paid: false, status: transaction.status || "pending", resourceId: purchase.resource_id }, 202);
  }
  const paidAt = transaction.paid_at || new Date().toISOString();
  const { error: updateError } = await db.from("resource_purchases").update({ payment_status: "paid", paystack_status: "success", payment_channel: transaction.channel || null, gateway_response: transaction.gateway_response || null, paid_at: paidAt, updated_at: new Date().toISOString() }).eq("id", purchase.id);
  if (updateError && updateError.code !== "23505") return reply({ error: "Payment succeeded, but access could not be recorded." }, 500);
  return reply({ paid: true, status: "success", resourceId: purchase.resource_id });
};
