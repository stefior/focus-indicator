let currentHost;
let listType;
const overlayConfigs = document.getElementById("overlayConfigs");
let elements = {
    disabledMessage: document.getElementById("disabledMessage"),
    toggleCurrentSiteBtn: document.getElementById("toggleCurrentSiteBtn"),
    listLabel: document.getElementById("listLabel"),
    textarea: document.getElementById("siteListTextArea"),
    saveSiteListBtn: document.getElementById("saveSiteListBtn"),
    toggleListTypeBtn: document.getElementById("toggleListTypeBtn"),
    outlineWidthInput: document.getElementById("outlineWidthInput"),
    outlineOffsetInput: document.getElementById("outlineOffsetInput"),
    indicatorPositionInput: document.getElementById("indicatorPositionInput"),
    indicatorColorInput: document.getElementById("indicatorColorInput"),
    useTransitionCheckbox: document.getElementById("useTransitionCheckbox"),
    textInputOverrideCheckbox: document.getElementById(
        "textInputOverrideCheckbox",
    ),
    //forceOpacityCheckbox: document.getElementById("forceOpacityCheckbox"),
};

function updateSliderSwitch(input) {
    const solidText = input.parentElement.querySelector("span:nth-of-type(1)");
    const invertedText = input.parentElement.querySelector(
        "span:nth-of-type(2)",
    );
    solidText.className = input.checked ? "" : "active";
    invertedText.className = input.checked ? "active" : "";
}

function initializeEventListeners() {
    // Toggle current site
    elements.toggleCurrentSiteBtn.addEventListener("click", () => {
        const siteList = elements.textarea.value.split("\n").filter(Boolean);
        const currentIndex = siteList.indexOf(currentHost);

        if (currentIndex !== -1) {
            siteList.splice(currentIndex, 1);
            elements.toggleCurrentSiteBtn.textContent = "Add current site";
        } else {
            siteList.push(currentHost);
            elements.toggleCurrentSiteBtn.textContent = "Remove current site";
        }

        chrome.storage.sync.set({ siteList: [...new Set(siteList)] });
        elements.textarea.value = siteList.join("\n");

        elements.saveSiteListBtn.textContent = "Saved";
        setTimeout(() => {
            elements.saveSiteListBtn.textContent = "Save list";
        }, 1000);
    });

    // Save site list
    elements.saveSiteListBtn.addEventListener("click", () => {
        const siteList = [
            ...new Set(elements.textarea.value.split("\n").filter(Boolean)),
        ];
        chrome.storage.sync.set({ siteList });
        elements.textarea.value = siteList.join("\n");

        elements.saveSiteListBtn.textContent = "List saved";

        elements.toggleCurrentSiteBtn.textContent = siteList.includes(
            currentHost,
        )
            ? "Remove current site"
            : "Add current site";

        setTimeout(() => {
            elements.saveSiteListBtn.textContent = "Save list";
        }, 1000);
    });

    // Indicator position
    elements.indicatorPositionInput.addEventListener("change", () => {
        const newMode = elements.indicatorPositionInput.checked
            ? "overlay"
            : "element";
        chrome.storage.sync.set({ indicatorPosition: newMode });
        updateSliderSwitch(elements.indicatorPositionInput);
        overlayConfigs.style.display = newMode === "overlay" ? "flex" : "none";
    });

    elements.indicatorPositionInput.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft") {
            e.preventDefault();
            elements.indicatorPositionInput.checked = false;
            elements.indicatorPositionInput.dispatchEvent(new Event("change"));
        } else if (e.key === "ArrowRight") {
            e.preventDefault();
            elements.indicatorPositionInput.checked = true;
            elements.indicatorPositionInput.dispatchEvent(new Event("change"));
        } else if (e.key === "Enter") {
            e.preventDefault();
        }
    });

    elements.indicatorPositionInput.addEventListener("keyup", (e) => {
        if (e.key === "Enter") {
            elements.indicatorPositionInput.checked =
                !elements.indicatorPositionInput.checked;
            elements.indicatorPositionInput.dispatchEvent(new Event("change"));
        }
    });

    // Indicator color
    elements.indicatorColorInput.addEventListener("change", () => {
        const newMode = elements.indicatorColorInput.checked
            ? "hybrid"
            : "solid";
        chrome.storage.sync.set({ indicatorColor: newMode });
        updateSliderSwitch(elements.indicatorColorInput);
    });

    elements.indicatorColorInput.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft") {
            e.preventDefault();
            elements.indicatorColorInput.checked = false;
            elements.indicatorColorInput.dispatchEvent(new Event("change"));
        } else if (e.key === "ArrowRight") {
            e.preventDefault();
            elements.indicatorColorInput.checked = true;
            elements.indicatorColorInput.dispatchEvent(new Event("change"));
        } else if (e.key === "Enter") {
            e.preventDefault();
        }
    });

    elements.indicatorColorInput.addEventListener("keyup", (e) => {
        if (e.key === "Enter") {
            elements.indicatorColorInput.checked =
                !elements.indicatorColorInput.checked;
            elements.indicatorColorInput.dispatchEvent(new Event("change"));
        }
    });

    // Toggle list type
    const toggleListType = () => {
        listType = listType === "blacklist" ? "whitelist" : "blacklist";

        if (listType === "blacklist") {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }

        elements.toggleListTypeBtn.textContent = `Switch to ${
            listType === "blacklist" ? "whitelist" : "blacklist"
        }`;
        elements.listLabel.textContent = `Manage ${listType}:`;

        chrome.storage.sync.set({ listType: listType });
    };

    elements.toggleListTypeBtn.addEventListener("mouseup", toggleListType);
    elements.toggleListTypeBtn.addEventListener("keyup", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleListType();
        }
    });

    // Outline width
    elements.outlineWidthInput.addEventListener("change", () => {
        const width = Math.min(
            Math.max(parseInt(elements.outlineWidthInput.value), 1),
            10,
        );
        elements.outlineWidthInput.value = width;
        chrome.storage.sync.set({ outlineWidth: width });
    });

    // Outline offset
    elements.outlineOffsetInput.addEventListener("change", () => {
        const offset = Math.min(
            Math.max(parseInt(elements.outlineOffsetInput.value), 0),
            10,
        );
        elements.outlineOffsetInput.value = offset;
        chrome.storage.sync.set({ outlineOffset: offset });
    });

    // Use transition
    elements.useTransitionCheckbox.addEventListener("keyup", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            elements.useTransitionCheckbox.click();
        }
    });

    elements.useTransitionCheckbox.addEventListener("change", () => {
        chrome.storage.sync.set({
            useTransition: elements.useTransitionCheckbox.checked,
        });
    });

    // Text input override
    elements.textInputOverrideCheckbox.addEventListener("keyup", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            elements.textInputOverrideCheckbox.click();
        }
    });

    elements.textInputOverrideCheckbox.addEventListener("change", () => {
        chrome.storage.sync.set({
            textInputOverride: elements.textInputOverrideCheckbox.checked,
        });
    });

    //// Force opacity
    //elements.forceOpacityCheckbox.addEventListener("keyup", (e) => {
    //    if (e.key === "Enter") {
    //        e.preventDefault();
    //        elements.forceOpacityCheckbox.click();
    //    }
    //});
    //
    //elements.forceOpacityCheckbox.addEventListener("change", () => {
    //    chrome.storage.sync.set({
    //        forceOpacity: elements.forceOpacityCheckbox.checked,
    //    });
    //});
}

function addSliderTransitions() {
    const sliders = document.querySelectorAll(".toggle-switch .slider");
    setTimeout(() => {
        sliders.forEach((slider) => {
            slider.style.transition = "transform 0.2s";
        });
    }, 100);
}

chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    currentHost = new URL(tabs[0].url).host;

    chrome.storage.sync.get(
        [
            "listType",
            "siteList",
            "outlineWidth",
            "outlineOffset",
            "indicatorPosition",
            "indicatorColor",
            "useTransition",
            "textInputOverride",
            //"forceOpacity",
        ],
        (data) => {
            listType = data.listType;

            elements.textarea.value = data.siteList.join("\n");
            elements.toggleCurrentSiteBtn.textContent = data.siteList.includes(
                currentHost,
            )
                ? "Remove current site"
                : "Add current site";
            elements.toggleListTypeBtn.textContent = `Switch to ${
                listType === "blacklist" ? "whitelist" : "blacklist"
            }`;
            elements.listLabel.textContent = `Manage ${listType}:`;
            elements.outlineWidthInput.value = data.outlineWidth;
            elements.outlineOffsetInput.value = data.outlineOffset;
            elements.indicatorPositionInput.checked =
                data.indicatorPosition === "overlay" ? true : false;
            elements.indicatorColorInput.checked =
                data.indicatorColor === "hybrid" ? true : false;
            elements.useTransitionCheckbox.checked = data.useTransition;
            elements.textInputOverrideCheckbox.checked = data.textInputOverride;
            //elements.forceOpacityCheckbox.checked = data.forceOpacity;

            updateSliderSwitch(elements.indicatorPositionInput);
            updateSliderSwitch(elements.indicatorColorInput);

            if (listType === "whitelist") {
                document.documentElement.classList.remove("dark");
            }

            if (data.indicatorPosition === "overlay") {
                overlayConfigs.style.display = "flex";
            } else {
                overlayConfigs.style.display = "none";
            }

            initializeEventListeners();
            addSliderTransitions();
        },
    );
});

chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.scripting
        .executeScript({
            target: { tabId: tabs[0].id },
            func: () => {},
        })
        .catch(() => {
            const url = tabs[0].url;
            const extensionId = chrome.runtime.id;
            if (url.includes(extensionId)) {
                return;
            }

            // If we can't inject a script, consider it a protected page
            elements.disabledMessage.style.opacity = "1";

            if (url.startsWith("file://")) {
                elements.disabledMessage.textContent =
                    "File URL access for Focus Indicator is currently disabled. It can be enabled on ";

                const link = document.createElement("a");
                link.textContent = "this page";
                link.style.color = "blue";
                link.style.textDecoration = "underline";
                link.style.cursor = "pointer";

                // Using this because opening "chrome://" urls with href is blocked
                link.onclick = (event) => {
                    event.preventDefault();
                    chrome.tabs.create({
                        url: `chrome://extensions/?id=${extensionId}`,
                    });
                };

                elements.disabledMessage.appendChild(link);
            }
        });
});
