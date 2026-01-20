export async function shareSafe(payload: { title?: string; text?: string; url?: string }) {
  const url = payload.url ?? (typeof window !== "undefined" ? window.location.href : "");
  try {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      // @ts-ignore
      await navigator.share({ title: payload.title, text: payload.text, url });
      return { ok: true, mode: "share" as const };
    }
    throw new Error("share_unavailable");
  } catch {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        return { ok: true, mode: "clipboard" as const };
      }
    } catch {}
    return { ok: false, mode: "none" as const };
  }
}
