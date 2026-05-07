const testSubtitleHighlighter = {
    get enabled() {
        return getSubtitleHighlightSettings().enabled;
    },

    get statusSettings() {
        return getSubtitleHighlightSettings().statusSettings;
    },

    getStatusForTextToken(token) {
        const clean = String(token || "")
            .trim()
            .replace(/[.,!?;:()[\]'"「」『』。、！？]/g, "");

        if (clean === "まるで") return "new";
        if (clean === "達人") return "mature";
        if (clean === "所作") return "learning";

        return "unknown";
    },

    findMatchesInText(text) {
        const known = [
            { text: "まるで", status: "new" },
            { text: "達人", status: "mature" },
            { text: "所作", status: "learning" }
        ];

        const source = String(text || "");
        const matches = [];

        for (const item of known) {
            let index = source.indexOf(item.text);

            while (index !== -1) {
                matches.push({
                    start: index,
                    end: index + item.text.length,
                    status: item.status
                });

                index = source.indexOf(item.text, index + item.text.length);
            }
        }

        return matches.sort((a, b) => a.start - b.start || b.end - a.end);
    }
};

function getSubtitleHighlightSettings() {
    return {
        enabled: document.getElementById("subtitleHighlightEnabled")?.checked === true,

        statusSettings: {
            new: {
                enabled: true,
                color: document.getElementById("highlightColorNew")?.value || "#ffcc66"
            },
            learning: {
                enabled: true,
                color: document.getElementById("highlightColorLearning")?.value || "#66ccff"
            },
            young: {
                enabled: true,
                color: document.getElementById("highlightColorYoung")?.value || "#66ccff"
            },
            mature: {
                enabled: true,
                color: document.getElementById("highlightColorMature")?.value || "#88ff88"
            },
            suspended: {
                enabled: true,
                color: document.getElementById("highlightColorSuspended")?.value || "#999999"
            },
            unknown: {
                enabled: false,
                color: document.getElementById("highlightColorUnknown")?.value || "#ffffff"
            }
        }
    };
}

