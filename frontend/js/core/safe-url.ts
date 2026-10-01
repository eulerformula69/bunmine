export function safeWebUrl(value: unknown): string {
    if (typeof value !== "string" || !value.trim()) return "";
    try {
        const url = new URL(value, window.location.origin);
        return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : "";
    } catch {
        return "";
    }
}
