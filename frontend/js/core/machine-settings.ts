let settings: Record<string, any> = {};
let pending = Promise.resolve();
export function readMachineSettings(): Record<string, any> { return settings; }
export async function initializeMachineSettings(): Promise<void> {
    const response = await fetch("/player-settings");
    if (!response.ok) throw new Error("Cannot load player settings");
    settings = (await response.json()).settings;
}
export function writeMachineSettings(patch: Record<string, any>): void {
    settings = { ...settings, ...patch };
    pending = pending.catch(() => {}).then(async () => {
        const response = await fetch("/player-settings", {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch)
        });
        if (!response.ok) throw new Error("Cannot save player settings");
    });
    pending.catch((error) => { console.error(error); window.alert("Не удалось сохранить настройки на машине. Повторите изменение."); });
}
