chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "update") {
        chrome.tabs.create({ url: "update.html" });
    }
});

const DEFAULT_SETTINGS = {
    siteList: [],
    listType: "blacklist",
    outlineWidth: 4,
    outlineOffset: 1,
    indicatorPosition: "overlay",
    indicatorColor: "solid",
    useTransition: false,
    textInputOverride: true,
    forceOpacity: true,
};

async function initializeSettings() {
    try {
        const storedSettings = await chrome.storage.sync.get(
            Object.keys(DEFAULT_SETTINGS),
        );
        const updatedSettings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            storedSettings,
        );

        await chrome.storage.sync.set(updatedSettings);
    } catch (error) {
        console.error("Error initializing settings:", error);
    }
}

function cleanupFocusIndicators() {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(async (tab) => {
            if (tab.id) {
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: () => {
                            window.postMessage(
                                { type: "CLEANUP_FOCUS_INDICATOR" },
                                "*",
                            );
                        },
                    });
                } catch (err) {
                    console.warn(`Skipping tab ${tab.id}:`, err);
                }
            }
        });
    });
}

async function injectContentScript() {
    try {
        cleanupFocusIndicators();
        await initializeSettings();

        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(async (tab) => {
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ["content.js", "chooseOutlineColor.js"],
                    });
                } catch (err) {
                    console.warn(
                        `Failed to inject content script into tab ${tab.id}:`,
                        err,
                    );
                }
            });
        });
    } catch (err) {
        console.error("Error injecting content script:", err);
    }
}

injectContentScript();
