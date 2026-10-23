export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Store runs on India time: server-rendered order times, the admin "today"
    // stats and invoice numbering all read the server's local zone, which is
    // UTC on Azure and Vercel (STG-55). Node picks up a TZ change at runtime.
    process.env.TZ = "Asia/Kolkata";
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export async function onRequestError(...args: Parameters<NonNullable<Awaited<ReturnType<typeof getOnRequestError>>>>) {
  const onRequestError = await getOnRequestError();
  if (onRequestError) await onRequestError(...args);
}

async function getOnRequestError() {
  if (!process.env.SENTRY_DSN) return null;
  const Sentry = await import("@sentry/nextjs");
  return Sentry.captureRequestError;
}
