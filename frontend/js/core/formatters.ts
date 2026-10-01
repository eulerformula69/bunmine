export function formatTime(seconds: unknown, style: "timestamp" | "duration" = "timestamp"): string {
    let value = Number(seconds || 0);
    if (style === "duration") {
        if (value <= 0) return "0m";
        const hours = Math.floor(value / 3600);
        const minutes = Math.floor((value % 3600) / 60);
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }
    if (!Number.isFinite(value) || value < 0) value = 0;
    const minutes = Math.floor(value / 60);
    const wholeSeconds = Math.floor(value % 60);
    const milliseconds = Math.floor((value % 1) * 1000);
    return `${minutes}:${String(wholeSeconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

export function formatBytes(bytes: unknown): string {
    const value = Number(bytes || 0);
    if (value <= 0) return "";
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function escapeHtml(value: unknown): string {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
