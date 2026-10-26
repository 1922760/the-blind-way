const { randomUUID } = require("crypto");

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  };

  const reply = (statusCode, data) => ({
    statusCode,
    headers,
    body: JSON.stringify(data)
  });

  if (event.httpMethod !== "POST") {
    return reply(405, { error: "Method not allowed" });
  }

  try {
    const appId = process.env.CASHFREE_APP_ID;
    const secret = process.env.CASHFREE_SECRET_KEY;

    if (!appId || !secret) {
      return reply(500, { error: "Payment configuration missing" });
    }

    const input = JSON.parse(event.body || "{}");
    const phone = String(input.phone || "").replace(/\D/g, "");
    const email = String(input.email || "").trim();

    if (!/^\d{10}$/.test(phone)) {
      return reply(400, { error: "Enter a valid 10-digit phone number" });
    }

    const orderId = "blindway_" + randomUUID().replace(/-/g, "");

    const payload = {
      order_id: orderId,
      order_amount: 49,
      order_currency: "INR",
      customer_details: {
        customer_id: "bw_" + phone,
        customer_phone: phone,
        ...(email ? { customer_email: email } : {})
      },
      order_meta: {
        return_url: "https://stupendous-sunshine-592b2e.netlify.app/?order_id={order_id}"
      }
    };

    const cfResponse = await fetch(
      "https://api.cashfree.com/pg/orders",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-version": "2023-08-01",
          "x-client-id": appId,
          "x-client-secret": secret,
          "x-idempotency-key": randomUUID()
        },
        body: JSON.stringify(payload)
      }
    );

    const result = await cfResponse.json();

    if (!cfResponse.ok) {
      console.error("Cashfree order creation failed:", cfResponse.status);
      return reply(502, { error: "Could not create payment order. Please try later." });
    }

    return reply(200, {
      order_id: result.order_id,
      payment_session_id: result.payment_session_id
    });
  } catch (error) {
    console.error("Create order error:", error.message);
    return reply(500, { error: "Unable to prepare payment" });
  }
};
