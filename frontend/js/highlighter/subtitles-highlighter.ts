type SubtitleHighlightStatus = "new" | "learning" | "young" | "mature" | "suspended" | "unknown";

interface SubtitleHighlightStatusSetting {
    enabled: boolean;
    color: string;
}

interface SubtitleHighlightSettings {
    enabled: boolean;
    statusSettings: Record<SubtitleHighlightStatus, SubtitleHighlightStatusSetting>;
}

function getSubtitleHighlightSettings(): SubtitleHighlightSettings {
    return {
        enabled: (document.getElementById("subtitleHighlightEnabled") as HTMLInputElement | null)?.checked === true,

        statusSettings: {
            new: {
                enabled: true,
                color: (document.getElementById("highlightColorNew") as HTMLInputElement | null)?.value || "#77b7d8"
            },
            learning: {
                enabled: true,
                color: (document.getElementById("highlightColorLearning") as HTMLInputElement | null)?.value || "#ff8a3d"
            },
            young: {
                enabled: true,
                color: (document.getElementById("highlightColorYoung") as HTMLInputElement | null)?.value || "#7ec77a"
            },
            mature: {
                enabled: true,
                color: (document.getElementById("highlightColorMature") as HTMLInputElement | null)?.value || "#2f9d4f"
            },
            suspended: {
                enabled: true,
                color: (document.getElementById("highlightColorSuspended") as HTMLInputElement | null)?.value || "#ffde4a"
            },
            unknown: {
                enabled: false,
                color: (document.getElementById("highlightColorUnknown") as HTMLInputElement | null)?.value || "#ffffff"
            }
        }
    };
}
