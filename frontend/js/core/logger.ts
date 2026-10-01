export const logger = {
    info: (...values: unknown[]): void => console.info(...values),
    warn: (...values: unknown[]): void => console.warn(...values),
    error: (...values: unknown[]): void => console.error(...values),
};
