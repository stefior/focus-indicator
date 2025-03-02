"use strict";

(function () {
    const inIframe = window.self !== window.top;
    let currentHost = location.host;
    let outerHostInterval = null;
    if (inIframe) {
        // If users choose to blacklist a site, it would be unexpected to see
        // focus indicators inside iframes on that site, so we'll always use
        // the location.host of the topmost window
        window.top.postMessage({ type: "GET_CURRENT_HOST" }, "*");
    }

    let indicatorsAreEnabled = false;
    const settings = {};
    const overlay = createOverlay();
    const liveCollectionIframes = document.getElementsByTagName("iframe");
    const encounteredShadowRoots = new WeakSet();
    const shadowFocusListeners = new Map();

    let then = Date.now();
    let lastBorderRadius = null;
    let lastKnownPosition = {
        top: 0,
        left: 0,
        width: 0,
        height: 0,
    };
    let lastMovementTime = 0;

    chrome.storage.sync.get(
        [
            "listType",
            "siteList",
            "outlineWidth",
            "outlineOffset",
            "indicatorPosition",
            "forceOpacity",
            "useTransition",
            "textInputOverride",
        ],
        (data) => {
            Object.assign(settings, data);

            if (!isEnabledOnHost(currentHost)) {
                return;
            }

            applyFocusIndicators();
        },
    );

    function createOverlay() {
        const id = "focusIndicatorOverlay";
        const existingOverlay = document.getElementById(id);
        if (existingOverlay) {
            return existingOverlay;
        }

        const newOverlay = document.createElement("div");
        newOverlay.id = id;
        saveInlineStyles(newOverlay, {
            position: "fixed",
            visibility: "hidden",
            "pointer-events": "none",
            "z-index": "2147483647",
        });

        return newOverlay;
    }

    function updateOverlay(focused) {
        if (!focused || focused.tabIndex < 0 || focused.tagName === "IFRAME") {
            return;
        }

        if (!document.getElementById(overlay.id)) {
            document.documentElement.appendChild(overlay);
        }

        const rect = focused.getBoundingClientRect();
        lastKnownPosition = {
            top: Math.round(rect.top) - settings.outlineOffset,
            left: Math.round(rect.left) - settings.outlineOffset,
            width: Math.round(rect.width) + settings.outlineOffset * 2,
            height: Math.round(rect.height) + settings.outlineOffset * 2,
        };

        const outlineColor = chooseOutlineColor(focused);
        lastBorderRadius = window.getComputedStyle(focused).borderRadius;
        saveInlineStyles(overlay, {
            top: `${lastKnownPosition.top}px`,
            left: `${lastKnownPosition.left}px`,
            width: `${lastKnownPosition.width}px`,
            height: `${lastKnownPosition.height}px`,
            "box-shadow": `0 0 0 1px ${outlineColor === "black" ? "white" : "black"},
                           0 0 0 ${1 + settings.outlineWidth}px ${outlineColor}`,
            "border-radius": lastBorderRadius,
        });

        if (!settings.textInputOverride || !isTextInputElement(focused)) {
            saveInlineStyles(overlay, { visibility: "visible" });
        }
    }

    function getDeepestFocus(element) {
        let deepestFocus = element;
        if (element === document) {
            return document.documentElement;
        }

        try {
            const shadowRoot = chrome.dom.openOrClosedShadowRoot(element);
            if (shadowRoot) {
                if (!encounteredShadowRoots.has(shadowRoot)) {
                    attachFocusListenersShadow(shadowRoot);
                    encounteredShadowRoots.add(shadowRoot);
                }

                if (shadowRoot.activeElement) {
                    deepestFocus = getDeepestFocus(shadowRoot.activeElement);
                }
            }
        } catch (err) {
            // Ignore
        }

        return deepestFocus;
    }

    function focusInHandlerInsideShadow(event) {
        this.host.dispatchEvent(
            new CustomEvent("shadow-focusin", {
                bubbles: true,
                composed: true,
                detail: {
                    target: event.target,
                    relatedTarget: event.relatedTarget,
                },
            }),
        );
    }

    function focusOutHandlerInsideShadow(event) {
        this.host.dispatchEvent(
            new CustomEvent("shadow-focusout", {
                bubbles: true,
                composed: true,
                detail: {
                    target: event.target,
                    relatedTarget: event.relatedTarget,
                },
            }),
        );
    }

    function attachFocusListenersShadow(shadowRoot) {
        // Focus events inside shadow DOMs are hidden, so using getDeepestFocus
        // would only work for the first element focused inside a shadow DOM.
        // We attach focus listeners to handle subsequent focus events while
        // still inside the shadow DOM or nested shadow doms
        if (!shadowRoot) {
            return;
        }

        shadowRoot.addEventListener("focusin", focusInHandlerInsideShadow);
        shadowRoot.addEventListener("focusout", focusOutHandlerInsideShadow);

        shadowFocusListeners.set(shadowRoot, {
            focusInHandlerInsideShadow,
            focusOutHandlerInsideShadow,
        });
    }

    function handleFocusInFromShadow(event) {
        handleFocusIn(event.detail);
    }

    function handleFocusOutFromShadow(event) {
        handleFocusOut(event.detail);
    }

    function isTextInputElement(element) {
        const tagName = element.tagName.toLowerCase();

        if (tagName === "textarea" || element.isContentEditable) {
            return true;
        }

        if (tagName === "input") {
            const type = element.type.toLowerCase();
            const textInputTypes = [
                "text",
                "password",
                "email",
                "number",
                "search",
                "tel",
                "url",
                "date",
                "datetime-local",
                "month",
                "time",
                "week",
            ];
            return textInputTypes.includes(type);
        }

        const role = element.getAttribute("role");
        const textInputRoles = [
            "textbox",
            "searchbox",
            "combobox",
            "spinbutton",
        ];
        if (textInputRoles.includes(role)) {
            return true;
        }

        return false;
    }

    function handleFocusIn(event) {
        lastBorderRadius = null;
        let focused = event.target;

        try {
            const possibleShadow = chrome.dom.openOrClosedShadowRoot(focused);
            if (encounteredShadowRoots.has(possibleShadow)) {
                // This is a duplicate event from the light DOM
                // The focus event from the shadow DOM listener will come separately
                return;
            }
        } catch (err) {
            // Ignore
        }

        focused = getDeepestFocus(event.target);
        const previouslyFocused = event.relatedTarget;

        const outlineColor = chooseOutlineColor(focused);

        if (settings.forceOpacity) {
            saveInlineStyles(focused, { opacity: "1" });
        }

        if (
            (settings.indicatorPosition === "element" ||
                settings.textInputOverride) &&
            isTextInputElement(focused)
        ) {
            // Seeing the white cursor can be difficult if there is a white
            // right up against it, so we will avoid doing that for text inputs
            // by only having an outline with an offset.
            //
            // The outline is 4px instead of 2px so it is the same width as it
            // would be with a border and box shadow.
            saveInlineStyles(focused, {
                outline: `4px solid ${outlineColor}`,
                "outline-offset": "2px",
            });
            if (settings.useTransition) {
                updateOverlay(focused);
            }
            return;
        }

        if (settings.indicatorPosition === "element") {
            saveInlineStyles(focused, {
                border: `1px solid ${outlineColor}`,
                outline: `2px solid ${outlineColor}`,
                "outline-offset": "0",
                "box-shadow": `0 0 0 1px ${outlineColor === "black" ? "white" : "black"} inset`,
            });
            return;
        }

        saveInlineStyles(focused, { outline: "none" }); // So no duplicate outline from the website's styles
        if (
            settings.useTransition &&
            previouslyFocused &&
            previouslyFocused !== document.body
        ) {
            saveInlineStyles(overlay, { transition: "all 0.05s linear" });
        } else {
            saveInlineStyles(overlay, { transition: "none" });
        }
        updateOverlay(focused);
    }

    function saveInlineStyles(element, styles) {
        // Using inline styles to usurp specificity of the website
        for (const [property, value] of Object.entries(styles)) {
            if (element.id !== "focusIndicatorOverlay") {
                const tempAttribute = `data-original-${property}`;
                if (!element.getAttribute(tempAttribute)) {
                    element.setAttribute(
                        tempAttribute,
                        element.style[property],
                    );
                }
            }
            element.style.setProperty(property, value, "important");
        }
    }

    function handleFocusOut(event) {
        // NOTE: focusout always fires before focusin is fired on the new element
        let unfocused = event.target;

        try {
            const possibleShadow = chrome.dom.openOrClosedShadowRoot(
                event.target,
            );
            if (encounteredShadowRoots.has(possibleShadow)) {
                // This is a duplicate event from the light DOM
                // The focus event from the shadow DOM listener will come separately
                return;
            }
        } catch (err) {
            // Ignore
        }

        if (settings.forceOpacity) {
            restoreInlineStyles(unfocused, ["opacity"]);
        }
        restoreInlineStyles(unfocused, [
            "outline",
            "outline-offset",
            "border",
            "box-shadow",
        ]);

        saveInlineStyles(overlay, { visibility: "hidden" });
    }

    function restoreInlineStyles(element, properties) {
        for (const property of properties) {
            const tempAttribute = `data-original-${property}`;
            const originalValue = element.getAttribute(tempAttribute);

            if (originalValue === null) {
                element.style.removeProperty(property);
                continue;
            }

            element.style[property] = originalValue;
            element.removeAttribute(tempAttribute);
        }
    }

    function isEnabledOnHost(host) {
        if (!host) {
            return false;
        }

        const listHasHost = settings.siteList?.includes(host);
        if (settings.listType === "blacklist" && !listHasHost) {
            return true;
        }
        if (settings.listType === "whitelist" && listHasHost) {
            return true;
        }

        return false;
    }

    function applyFocusIndicators() {
        indicatorsAreEnabled = true;

        document.addEventListener("focusin", handleFocusIn);
        document.addEventListener("focusout", handleFocusOut);
        document.addEventListener("shadow-focusin", handleFocusInFromShadow);
        document.addEventListener("shadow-focusout", handleFocusOutFromShadow);

        if (settings.indicatorPosition !== "element") {
            document.documentElement.appendChild(overlay);
            window.focusIndicatorRAF = requestAnimationFrame(updateOverlayRAF);
        }
        if (document.activeElement.tabIndex >= 0) {
            handleFocusIn({ target: document.activeElement });
        }
    }

    function removeFocusIndicators() {
        indicatorsAreEnabled = false;

        document.removeEventListener("focusin", handleFocusIn);
        document.removeEventListener("focusout", handleFocusOut);
        document.removeEventListener("shadow-focusin", handleFocusInFromShadow);
        document.removeEventListener(
            "shadow-focusout",
            handleFocusOutFromShadow,
        );

        for (const shadowRoot of shadowFocusListeners.keys()) {
            const { focusInHandlerInsideShadow, focusOutHandlerInsideShadow } =
                shadowFocusListeners.get(shadowRoot);
            shadowRoot.removeEventListener(
                "focusin",
                focusInHandlerInsideShadow,
            );
            shadowRoot.removeEventListener(
                "focusout",
                focusOutHandlerInsideShadow,
            );
        }
        shadowFocusListeners.clear();

        cancelAnimationFrame(window.focusIndicatorRAF);
        overlay.remove();
    }

    function handleWindowMessages(message) {
        switch (message.data?.type) {
            case "CLEANUP_FOCUS_INDICATOR": {
                window.removeEventListener("message", handleWindowMessages);
                removeFocusIndicators();
                return;
            }
            case "UPDATE_CURRENT_HOST": {
                clearInterval(outerHostInterval);
                currentHost = message.data.host;
                if (!isEnabledOnHost(currentHost)) {
                    removeFocusIndicators();
                }
                break;
            }
            case "GET_CURRENT_HOST": {
                for (const iframe of liveCollectionIframes) {
                    iframe.contentWindow.postMessage(
                        {
                            type: "UPDATE_CURRENT_HOST",
                            host: location.host,
                        },
                        "*",
                    );
                }
                break;
            }
        }
    }
    window.addEventListener("message", handleWindowMessages);

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace !== "sync") {
            return;
        }

        Object.entries(changes).forEach(([key, { oldValue, newValue }]) => {
            if (settings[key] !== newValue) {
                settings[key] = newValue;

                switch (key) {
                    case "indicatorPosition":
                        if (newValue === "element") {
                            overlay.remove();
                            cancelAnimationFrame(window.focusIndicatorRAF);
                        } else {
                            document.documentElement.appendChild(overlay);
                            updateOverlay();
                            window.focusIndicatorRAF =
                                requestAnimationFrame(updateOverlayRAF);
                        }
                        break;

                    case "textInputOverride":
                        if (isTextInputElement(document.activeElement)) {
                            saveInlineStyles(overlay, { visibility: "hidden" });
                        }
                        break;

                    case "siteList":
                    case "listType":
                        const newIndicatorsAreEnabled =
                            isEnabledOnHost(currentHost);

                        if (indicatorsAreEnabled && !newIndicatorsAreEnabled) {
                            removeFocusIndicators();
                        } else if (
                            !indicatorsAreEnabled &&
                            newIndicatorsAreEnabled
                        ) {
                            applyFocusIndicators();
                        }
                        break;
                }
            }
        });
    });

    function shouldUpdateOverlay(element) {
        if (!element) {
            saveInlineStyles(overlay, { visibility: "hidden" });
            return false;
        }

        if (settings.textInputOverride && isTextInputElement(element)) {
            return false;
        }

        const rect = element.getBoundingClientRect();
        const currentBorderRadius =
            window.getComputedStyle(element).borderRadius;
        if (lastBorderRadius && currentBorderRadius !== lastBorderRadius) {
            return true;
        }
        const currentPosition = {
            top: Math.round(rect.top) - settings.outlineOffset,
            left: Math.round(rect.left) - settings.outlineOffset,
            width: Math.round(rect.width) + settings.outlineOffset * 2,
            height: Math.round(rect.height) + settings.outlineOffset * 2,
        };
        const changed = Object.entries(currentPosition).some(
            ([key, value]) => lastKnownPosition[key] !== value,
        );
        return changed;
    }

    function updateOverlayRAF() {
        try {
            const now = Date.now();
            if (now - lastMovementTime > 500 && now - then < 100) {
                window.focusIndicatorRAF =
                    requestAnimationFrame(updateOverlayRAF);
                return;
            }
            then = now;

            const focused = getDeepestFocus(document.activeElement);
            if (shouldUpdateOverlay(focused)) {
                updateOverlay(focused);
                // Keep going once movement is detected until movement stops (for smoothness)
                lastMovementTime = now;
            }

            window.focusIndicatorRAF = requestAnimationFrame(updateOverlayRAF);
        } catch (err) {
            if (err.message.includes("Extension context invalidated")) {
                // The extension's context was invalidated due to an update/reload,
                // which can be safely ignored
                return;
            }
            console.error(err);
        }
    }
})();
