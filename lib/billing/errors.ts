export function getPlanLimitMessage(error: unknown): string | null {
  const message =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
      ? error.message
      : error instanceof Error
        ? error.message
        : "";

  const prefix = "FREE_PLAN_LIMIT_REACHED: ";
  if (!message.startsWith(prefix)) return null;

  return message.slice(prefix.length);
}
