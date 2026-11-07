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

  const prefixes = [
    "FREE_PLAN_LIMIT_REACHED: ",
    "PAID_PLAN_LIMIT_REACHED: ",
  ];
  const prefix = prefixes.find((candidate) => message.startsWith(candidate));
  if (!prefix) return null;

  return message.slice(prefix.length);
}
