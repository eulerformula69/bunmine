import { ToastType } from "../types/runtime-types.js";

export interface ToastActionButton {
  label: string;
  onClick?: () => void | Promise<void>;
}

export function showToast(message: string, type: ToastType = "info", timeout = 3000): void {
  let container = document.getElementById("mpToastContainer");

  if (!container) {
    container = document.createElement("div");
    container.id = "mpToastContainer";
    container.className = "mp-toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `mp-toast mp-toast-${type}`;
  toast.textContent = message;
  toast.setAttribute("role", type === "error" ? "alert" : "status");

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("mp-toast-removing");

    setTimeout(() => {
      toast.remove();
    }, 180);
  }, timeout);
}

export function showActionToast(message: string, actions: ToastActionButton[] = [], type: ToastType = "info", timeout = 0): HTMLDivElement {
  let container = document.getElementById("mpToastContainer");

  if (!container) {
    container = document.createElement("div");
    container.id = "mpToastContainer";
    container.className = "mp-toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `mp-toast mp-toast-${type} mp-toast-action`;

  const messageEl = document.createElement("div");
  messageEl.className = "mp-toast-action-message";
  messageEl.textContent = message;
  toast.setAttribute("role", "alertdialog");
  toast.setAttribute("aria-label", message);

  const actionsEl = document.createElement("div");
  actionsEl.className = "mp-toast-action-buttons";

  actions.forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mp-toast-action-button";
    button.textContent = action.label;

    button.addEventListener("click", () => {
      try {
        action.onClick?.();
      } finally {
        toast.classList.add("mp-toast-removing");

        setTimeout(() => {
          toast.remove();
        }, 180);
      }
    });

    actionsEl.appendChild(button);
  });

  toast.appendChild(messageEl);
  toast.appendChild(actionsEl);
  container.appendChild(toast);

  if (timeout > 0) {
    setTimeout(() => {
      toast.classList.add("mp-toast-removing");

      setTimeout(() => {
        toast.remove();
      }, 180);
    }, timeout);
  }

  return toast;
}

export function confirmToast(message: string, confirmLabel: string, cancelLabel: string): Promise<boolean> {
    return new Promise(resolve => {
        showActionToast(message, [
            {label: confirmLabel, onClick: () => resolve(true)},
            {label: cancelLabel, onClick: () => resolve(false)},
        ]);
    });
}
