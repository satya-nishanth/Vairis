export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
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
