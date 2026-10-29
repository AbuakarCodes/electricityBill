
import dns from "node:dns/promises";
import net from "node:net";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const log = (...args) => console.log("[LESCO-DIAGNOSTIC]", ...args);

  log("========== DIAGNOSTIC START ==========");
  log("Time:", new Date().toISOString());

  // Protect this diagnostic endpoint.
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !==
      `Bearer ${process.env.CRON_SECRET}`
  ) {
    console.error("[LESCO-DIAGNOSTIC] Unauthorized request");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const host = "www.lesco.gov.pk";
  const targetIP = "116.58.54.125";
  const port = 443;

  // TEST 1: DNS lookup
  log("[DNS] Starting lookup for:", host);

  let dnsResult;
  const dnsStarted = Date.now();

  try {
    dnsResult = await dns.lookup(host, { all: true });

    log("[DNS] SUCCESS");
    log("[DNS] Resolved addresses:", JSON.stringify(dnsResult));
  } catch (error) {
    dnsResult = {
      error: error.code,
      message: error.message,
    };

    console.error("[DNS] FAILED");
    console.error("[DNS] Error code:", error.code);
    console.error("[DNS] Message:", error.message);
  }

  log("[DNS] Duration:", Date.now() - dnsStarted, "ms");

  // TEST 2: TCP connection
  log(`[TCP] Connecting to ${targetIP}:${port}`);

  const tcpStarted = Date.now();

  const connection = await new Promise((resolve) => {
    let finished = false;

    const socket = net.connect({
      host: targetIP,
      port,
    });

    const finish = (result) => {
      if (finished) return;
      finished = true;

      log("[TCP] Result:", JSON.stringify(result));
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(10000);

    socket.once("connect", () => {
      finish({
        connected: true,
        durationMs: Date.now() - tcpStarted,
      });
    });

    socket.once("timeout", () => {
      console.error("[TCP] CONNECTION TIMED OUT");
      finish({
        connected: false,
        error: "SOCKET_TIMEOUT",
        durationMs: Date.now() - tcpStarted,
      });
    });

    socket.once("error", (error) => {
      console.error("[TCP] CONNECTION FAILED");
      console.error("[TCP] Error code:", error.code);
      console.error("[TCP] Message:", error.message);

      finish({
        connected: false,
        error: error.code,
        message: error.message,
        durationMs: Date.now() - tcpStarted,
      });
    });
  });

  log("========== DIAGNOSTIC COMPLETE ==========");

  return Response.json({
    host,
    targetIP,
    port,
    dnsResult,
    dnsDurationMs: Date.now() - dnsStarted,
    connection,
  });
}
