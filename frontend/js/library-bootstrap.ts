import { initializeMachineSettings } from "./core/machine-settings.js";
initializeMachineSettings().then(() => import("./library/library-bindings.js")).catch(console.error);
