import dns from "node:dns/promises";
import net from "node:net";

export const dynamic = "force-dynamic";

export async function GET(request) {
  // Protect this diagnostic endpoint.
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !==
      `Bearer ${process.env.CRON_SECRET}`
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const host = "www.lesco.gov.pk";

  let dnsResult;

  try {
    dnsResult = await dns.lookup(host, { all: true });
  } catch (error) {
    dnsResult = {
      error: error.code,
      message: error.message,
    };
  }

  const started = Date.now();

  const connection = await new Promise((resolve) => {
    const socket = net.connect({ host: "116.58.54.125", port: 443 });

    socket.setTimeout(10000);

    socket.once("connect", () => {
      resolve({
        connected: true,
        durationMs: Date.now() - started,
      });
      socket.destroy();
    });

    socket.once("timeout", () => {
      resolve({
        connected: false,
        error: "SOCKET_TIMEOUT",
        durationMs: Date.now() - started,
      });
      socket.destroy();
    });

    socket.once("error", (error) => {
      resolve({
        connected: false,
        error: error.code,
        message: error.message,
        durationMs: Date.now() - started,
      });
    });
  });

  return Response.json({ dnsResult, connection });
}