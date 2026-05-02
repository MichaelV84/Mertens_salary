interface ErrorWithFields {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function formatSupabaseError(error: unknown, fallback: string) {
  if (error instanceof Error && isNonEmptyString(error.message)) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const candidate = error as ErrorWithFields;
    const parts = [candidate.message, candidate.details, candidate.hint]
      .filter(isNonEmptyString)
      .map((part) => part.trim());

    const code = isNonEmptyString(candidate.code) ? candidate.code.trim() : "";

    if (parts.length > 0 && code) {
      return `${parts.join(" | ")} (code: ${code})`;
    }

    if (parts.length > 0) {
      return parts.join(" | ");
    }

    if (code) {
      return `${fallback} (code: ${code})`;
    }
  }

  return fallback;
}

export async function measureAsync<T>(label: string, action: () => Promise<T>) {
  const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();

  try {
    const result = await action();
    const finishedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    console.info(`[timing] ${label}: ${Math.round(finishedAt - startedAt)}ms`);
    return result;
  } catch (error) {
    const finishedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    console.error(`[timing] ${label}: failed after ${Math.round(finishedAt - startedAt)}ms`, error);
    throw error;
  }
}
