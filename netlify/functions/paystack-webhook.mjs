import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const response = (body, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export default async (request) => {
  if (request.method !== "POST") return response({ error: "Method not allowed." }, 405);
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  if (!supabaseUrl || !supabaseSecret || !paystackSecret)
    return response({ error: "Payment webhook is not configured." }, 503);

  const rawBody = await request.text();
  const suppliedSignature = request.headers.get("x-paystack-signature") || "";
  const expectedSignature = crypto.createHmac("sha512", paystackSecret).update(rawBody).digest("hex");
  const supplied = Buffer.from(suppliedSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected))
    return response({ error: "Invalid webhook signature." }, 401);

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return response({ error: "Invalid webhook payload." }, 400);
  }
  if (event.event !== "charge.success") return response({ received: true });

  const transaction = event.data || {};
  const reference = String(transaction.reference || "");
  if (!reference) return response({ received: true });
  const db = createClient(supabaseUrl, supabaseSecret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: booking } = await db
    .from("bookings")
    .select("id,amount_subunit,currency,payment_reference,payment_status")
    .eq("payment_reference", reference)
    .maybeSingle();
  if (!booking) return response({ received: true });

  const valid =
    transaction.status === "success" &&
    transaction.reference === booking.payment_reference &&
    Number(transaction.amount) === Number(booking.amount_subunit) &&
    String(transaction.currency || "").toUpperCase() === String(booking.currency || "GHS").toUpperCase() &&
    (!transaction.metadata?.booking_id || transaction.metadata.booking_id === booking.id);
  if (!valid) return response({ received: true });

  const paidAt = transaction.paid_at || new Date().toISOString();
  const { error } = await db
    .from("bookings")
    .update({
      payment_status: "paid",
      paystack_status: "success",
      payment_channel: transaction.channel || null,
      gateway_response: transaction.gateway_response || null,
      paid_at: paidAt,
      confirmed_at: paidAt,
      status: "confirmed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id);
  if (error) return response({ error: "Booking update failed." }, 500);
  return response({ received: true });
};
