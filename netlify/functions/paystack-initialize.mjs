import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const reply = (body, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

function configuration() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  if (!supabaseUrl || !supabaseSecret || !paystackSecret) return null;
  return {
    paystackSecret,
    appUrl: (process.env.APP_URL || "https://tutlabb.netlify.app").replace(/\/$/, ""),
    db: createClient(supabaseUrl, supabaseSecret, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
}

export default async (request) => {
  if (request.method !== "POST") return reply({ error: "Method not allowed." }, 405);

  const config = configuration();
  if (!config) return reply({ error: "The payment service is not configured." }, 503);

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return reply({ error: "Please sign in before making a payment." }, 401);
  const { data: auth, error: authError } = await config.db.auth.getUser(token);
  const user = auth?.user;
  if (authError || !user?.id || !user.email)
    return reply({ error: "Your sign-in session has expired. Please sign in again." }, 401);

  let input;
  try {
    input = await request.json();
  } catch {
    return reply({ error: "Invalid checkout request." }, 400);
  }

  const tutorId = String(input.tutorId || "").trim();
  const mode = String(input.mode || "").trim();
  const duration = Number(input.duration);
  const scheduledAt = new Date(input.scheduledAt);
  const allowedDurations = [0.5, 1, 1.5, 2];
  if (!tutorId || !["online", "in-person"].includes(mode) || !allowedDurations.includes(duration))
    return reply({ error: "Choose a valid tutor, lesson mode, and duration." }, 422);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() + 15 * 60 * 1000)
    return reply({ error: "Choose a lesson time at least 15 minutes from now." }, 422);
  if (scheduledAt.getTime() > Date.now() + 180 * 24 * 60 * 60 * 1000)
    return reply({ error: "Bookings can be made up to six months ahead." }, 422);

  const { data: tutor, error: tutorError } = await config.db
    .from("tutors")
    .select("id,user_id,name,course,price,modes,published")
    .eq("id", tutorId)
    .eq("published", true)
    .single();
  if (tutorError || !tutor) return reply({ error: "This tutor is not available for booking." }, 404);
  if (Array.isArray(tutor.modes) && tutor.modes.length && !tutor.modes.includes(mode))
    return reply({ error: `This tutor does not offer ${mode} lessons.` }, 422);

  const hourlyRate = Number(tutor.price);
  if (!Number.isFinite(hourlyRate) || hourlyRate <= 0)
    return reply({ error: "This tutor does not have a valid booking rate." }, 409);

  const modeMultiplier = mode === "in-person" ? 1.15 : 1;
  const amountSubunit = Math.round(hourlyRate * duration * modeMultiplier * 100);
  const amount = amountSubunit / 100;
  const tutorPayout = Math.round(amount * 0.8 * 100) / 100;
  const platformShare = Math.round((amount - tutorPayout) * 100) / 100;
  const reference = `tutlab_${Date.now()}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const details = {
    tutorName: tutor.name,
    tutorUserId: tutor.user_id,
    course: tutor.course,
    mode,
    duration,
    scheduledAt: scheduledAt.toISOString(),
  };

  const { data: booking, error: bookingError } = await config.db
    .from("bookings")
    .insert({
      user_id: user.id,
      tutor_id: tutor.id,
      details,
      price: amount,
      people: 1,
      payment_account: "paystack",
      payment_status: "pending",
      payment_reference: reference,
      tutor_payout: tutorPayout,
      platform_share: platformShare,
      status: "pending_payment",
      currency: "GHS",
      amount_subunit: amountSubunit,
      scheduled_at: scheduledAt.toISOString(),
    })
    .select("id")
    .single();
  if (bookingError)
    return reply({ error: "The booking could not be created. Run the Paystack database upgrade first." }, 500);

  const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.paystackSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: user.email,
      amount: amountSubunit,
      currency: "GHS",
      reference,
      callback_url: `${config.appUrl}/payment/callback`,
      metadata: {
        booking_id: booking.id,
        tutor_id: tutor.id,
        student_id: user.id,
        custom_fields: [
          { display_name: "Tutor", variable_name: "tutor", value: tutor.name },
          { display_name: "Course", variable_name: "course", value: tutor.course },
        ],
      },
    }),
  });
  const paystack = await paystackResponse.json().catch(() => null);
  if (!paystackResponse.ok || !paystack?.status || !paystack?.data?.authorization_url) {
    await config.db
      .from("bookings")
      .update({ payment_status: "initialization_failed", paystack_status: "initialize_failed" })
      .eq("id", booking.id);
    return reply({ error: paystack?.message || "Paystack could not start this payment." }, 502);
  }

  return reply({
    bookingId: booking.id,
    reference,
    authorizationUrl: paystack.data.authorization_url,
    amount,
    currency: "GHS",
  });
};
