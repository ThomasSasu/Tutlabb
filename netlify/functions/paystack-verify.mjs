import { createClient } from "@supabase/supabase-js";

const reply = (body, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export default async (request) => {
  if (request.method !== "GET" && request.method !== "POST")
    return reply({ error: "Method not allowed." }, 405);
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://tmfwkaqtssicezuwgzch.supabase.co";
  const supabaseSecret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET;
  if (!supabaseUrl || !supabaseSecret || !paystackSecret)
    return reply({ error: "The payment service is not configured." }, 503);

  const db = createClient(supabaseUrl, supabaseSecret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return reply({ error: "Please sign in to verify this payment." }, 401);
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth?.user?.id)
    return reply({ error: "Your sign-in session has expired. Please sign in again." }, 401);

  const requestUrl = new URL(request.url);
  const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
  const reference = String(requestUrl.searchParams.get("reference") || body.reference || "").trim();
  if (!reference) return reply({ error: "The payment reference is missing." }, 422);

  const { data: booking, error: bookingError } = await db
    .from("bookings")
    .select("*")
    .eq("payment_reference", reference)
    .eq("user_id", auth.user.id)
    .single();
  if (bookingError || !booking) return reply({ error: "Booking not found." }, 404);

  const verificationResponse = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${paystackSecret}` } },
  );
  const verification = await verificationResponse.json().catch(() => null);
  if (!verificationResponse.ok || !verification?.status || !verification?.data)
    return reply({ error: verification?.message || "Paystack could not verify this payment." }, 502);

  const transaction = verification.data;
  const amountMatches = Number(transaction.amount) === Number(booking.amount_subunit);
  const currencyMatches = String(transaction.currency || "").toUpperCase() === String(booking.currency || "GHS").toUpperCase();
  const referenceMatches = transaction.reference === booking.payment_reference;
  const metadataBooking = transaction.metadata?.booking_id;
  const metadataMatches = !metadataBooking || metadataBooking === booking.id;
  if (!amountMatches || !currencyMatches || !referenceMatches || !metadataMatches)
    return reply({ error: "The payment details do not match this booking. No booking was confirmed." }, 409);

  if (transaction.status !== "success") {
    const safeStatus = ["abandoned", "failed", "ongoing", "pending", "processing", "queued", "reversed"].includes(transaction.status)
      ? transaction.status
      : "pending";
    await db.from("bookings").update({ paystack_status: safeStatus, payment_status: safeStatus === "failed" ? "failed" : "pending" }).eq("id", booking.id).neq("payment_status", "paid");
    return reply({ paid: false, status: safeStatus, booking: { id: booking.id, details: booking.details } }, 202);
  }

  const paidAt = transaction.paid_at || new Date().toISOString();
  const { data: updated, error: updateError } = await db
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
    .eq("id", booking.id)
    .select("id,details,price,currency,payment_status,status,scheduled_at")
    .single();
  if (updateError) return reply({ error: "Payment succeeded, but the booking record could not be updated." }, 500);
  return reply({ paid: true, status: "success", booking: updated });
};
