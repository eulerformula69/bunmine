import { TranslationKey } from "../core/i18n.js";
import { logger } from "../core/logger.js";
import { t } from "../core/translate.js";
import { showToast } from "./ui.js";

export function reportError(error: unknown, options: {
    key?: TranslationKey;
    duration?: number;
    log?: string;
    status?: (message: string) => void;
} = {}): void {
    const message = error instanceof Error ? error.message : String(error);
    if (options.log) logger.error(options.log, error);
    options.status?.(message);
    showToast(options.key ? t(options.key, {message}) : message, "error", options.duration ?? 6000);
}
