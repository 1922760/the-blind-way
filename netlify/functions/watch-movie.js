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
    const cashfreeSecret = process.env.CASHFREE_SECRET_KEY;
    const vdocipherSecret = process.env.VDOCIPHER_API_SECRET;

    if (!appId || !cashfreeSecret || !vdocipherSecret) {
      return reply(500, { error: "Server configuration missing" });
    }

    const input = JSON.parse(event.body || "{}");
    const orderId = String(input.order_id || "");

    if (!/^blindway_[a-f0-9]{32}$/i.test(orderId)) {
      return reply(400, { error: "Invalid order ID" });
    }

    const paymentResponse = await fetch(
      "https://api.cashfree.com/pg/orders/" + encodeURIComponent(orderId),
      {
        headers: {
          "x-api-version": "2023-08-01",
          "x-client-id": appId,
          "x-client-secret": cashfreeSecret
        }
      }
    );

    if (!paymentResponse.ok) {
      return reply(502, { error: "Could not verify payment" });
    }

    const order = await paymentResponse.json();

    if (
      order.order_status !== "PAID" ||
      Number(order.order_amount) !== 49 ||
      order.order_currency !== "INR"
    ) {
      return reply(402, { error: "Payment not confirmed" });
    }

    const videoId = "1d10f56da6094ca0a6614be358009b8f";

    const videoResponse = await fetch(
      "https://dev.vdocipher.com/api/videos/" +
        encodeURIComponent(videoId) +
        "/otp",
      {
        method: "POST",
        headers: {
          "Authorization": "Apisecret " + vdocipherSecret,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ ttl: 300 })
      }
    );

    if (!videoResponse.ok) {
      return reply(502, { error: "Could not start secure playback" });
    }

    const video = await videoResponse.json();

    if (!video.otp || !video.playbackInfo) {
      return reply(502, { error: "Video playback details missing" });
    }

    return reply(200, {
      otp: video.otp,
      playbackInfo: video.playbackInfo
    });
  } catch (error) {
    console.error("Watch movie error:", error.message);
    return reply(500, { error: "Unable to unlock movie" });
  }
};
