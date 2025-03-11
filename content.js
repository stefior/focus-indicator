"use strict";

(function () {
    const inIframe = window.self !== window.top;
    let currentHost = window.location.host;
    let outerHostInterval = null;
    if (inIframe) {
        // If users choose to blacklist a site, it would be unexpected to see
        // focus indicators inside iframes on that site, so we'll always use
        // the location.host of the topmost window
        window.top.postMessage({ type: "GET_CURRENT_HOST" }, "*");
    }

    let overlayShadowHost = document.getElementById("focusIndicatorShadowHost");
    if (overlayShadowHost) {
        overlayShadowHost.remove();
    }
    overlayShadowHost = document.createElement("div");
    overlayShadowHost.id = "focusIndicatorShadowHost";
    document.documentElement.appendChild(overlayShadowHost);

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
    let windowIsFocused = true;

    chrome.storage.sync.get(
        [
            "listType",
            "siteList",
            "outlineWidth",
            "outlineOffset",
            "indicatorPosition",
            "indicatorColor",
            "forceOpacity",
            "useTransition",
            "textInputOverride",
        ],
        (data) => {
            Object.assign(settings, data);

            if (!isEnabledOnHost(currentHost)) {
                return;
            }

            handleFocusIn({ target: document.activeElement });
            applyFocusIndicators();
        },
    );

    function createOverlay() {
        const id = "focusIndicatorOverlay";

        const shadowRoot =
            overlayShadowHost.shadowRoot ||
            overlayShadowHost.attachShadow({ mode: "closed" });

        const existingOverlay = shadowRoot.getElementById(id);
        if (existingOverlay) {
            return existingOverlay;
        }

        const newOverlay = document.createElement("div");
        newOverlay.id = id;
        saveInlineStyles(newOverlay, {
            margin: "0",
            padding: "0",
            position: "fixed",
            visibility: "hidden",
            "z-index": "2147483647",
            "pointer-events": "none",
            background: "none",
            transition: "none",
            filter: "none",
            transform: "none",
            outline: "none",
            border: "none",
            opacity: "1",
            "clip-path": "none",
            "user-select": "none",
            "mix-blend-mode": "normal",
            "touch-action": "none",
        });

        shadowRoot.appendChild(newOverlay);

        return newOverlay;
    }

    function updateOverlay(focused, outlineColor = null) {
        const isTextInput = isTextInputElement(focused);
        if (!focused || focused.tabIndex < 0 || focused.tagName === "IFRAME") {
            if (!isTextInput) {
                return;
            }
        }

        if (!document.getElementById(overlayShadowHost.id)) {
            // We could do this every time the overlay is updated to account for
            // the possibility of something having max z-index and coming after
            // it in the document, but I don't want to cover up hint-based extensions
            document.documentElement.appendChild(overlayShadowHost);
        }

        const rect = focused.getBoundingClientRect();
        lastBorderRadius = window.getComputedStyle(focused).borderRadius;

        if (settings.indicatorColor === "hybrid") {
            const combinedOffset =
                settings.outlineOffset + settings.outlineWidth;
            lastKnownPosition = {
                top: Math.round(rect.top) - combinedOffset,
                left: Math.round(rect.left) - combinedOffset,
                width: Math.round(rect.width) + combinedOffset * 2,
                height: Math.round(rect.height) + combinedOffset * 2,
            };

            const w = settings.outlineWidth;
            saveInlineStyles(overlay, {
                top: `${lastKnownPosition.top}px`,
                left: `${lastKnownPosition.left}px`,
                width: `${lastKnownPosition.width}px`,
                height: `${lastKnownPosition.height}px`,
                "backdrop-filter": "grayscale(1) contrast(999) invert(1)",
                "clip-path": `polygon(
              /* Top left corner */  0 0,
             /* Top right corner */  100% 0,
          /* Bottom right corner */  100% 100%,
           /* Bottom left corner */  0 100%,
              /* Top left corner */  0 0,
        /* Top left INNER corner */  ${w}px ${w}px,
     /* Bottom left INNER corner */  ${w}px calc(100% - ${w}px),
    /* Bottom right INNER corner */  calc(100% - ${w}px) calc(100% - ${w}px),
       /* Top right INNER corner */  calc(100% - ${w}px) ${w}px,
        /* Top left INNER corner */  ${w}px ${w}px
                )`,
                "border-radius": "0",
                "box-shadow": "none",
            });
        } else {
            if (outlineColor === null) {
                outlineColor = chooseOutlineColor(focused);
            }
            lastKnownPosition = {
                top: Math.round(rect.top) - settings.outlineOffset,
                left: Math.round(rect.left) - settings.outlineOffset,
                width: Math.round(rect.width) + settings.outlineOffset * 2,
                height: Math.round(rect.height) + settings.outlineOffset * 2,
            };
            saveInlineStyles(overlay, {
                top: `${lastKnownPosition.top}px`,
                left: `${lastKnownPosition.left}px`,
                width: `${lastKnownPosition.width}px`,
                height: `${lastKnownPosition.height}px`,
                "border-radius": lastBorderRadius,
                "box-shadow": `0 0 0 1px ${outlineColor === "black" ? "white" : "black"},
                           0 0 0 ${1 + settings.outlineWidth}px ${outlineColor}`,
                "backdrop-filter": "none",
                "clip-path": "none",
            });
        }

        if (!settings.textInputOverride || !isTextInput) {
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
        if (element.tagName === "TEXTAREA" || element.isContentEditable) {
            return true;
        }

        if (element.tagName === "INPUT") {
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
        let focused = event?.target;
        const isTextInput = isTextInputElement(focused);
        if (!focused || (focused.tabIndex < 0 && !isTextInput)) {
            return;
        }

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

        // Either mode
        if (settings.forceOpacity) {
            saveInlineStyles(focused, { opacity: "1" });
        }
        if (
            (settings.indicatorPosition === "element" ||
                settings.textInputOverride) &&
            isTextInput
        ) {
            // Seeing the cursor can be difficult if there is a border right up
            // against it, so we will avoid doing that for text inputs
            // by only having an outline with an offset.
            //
            // The outline is 4px instead of 2px so it is the same width as it
            // would be with a border and box shadow.
            saveInlineStyles(focused, {
                outline: `4px solid ${outlineColor}`,
                "outline-offset": "2px",
            });
            if (settings.useTransition) {
                updateOverlay(focused, outlineColor);
            }
            return;
        }

        // Element mode
        if (settings.indicatorPosition === "element") {
            saveInlineStyles(focused, {
                border: `1px solid ${outlineColor}`, // Can make some stuff move slightly, but it is needed for cases when the element's outline is covered
                outline: `2px solid ${outlineColor}`,
                "outline-offset": "0",
                "box-shadow": `0 0 0 1px ${outlineColor === "black" ? "white" : "black"} inset`,
            });
            return;
        }

        // Overlay mode
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
        updateOverlay(focused, outlineColor);
    }

    function saveInlineStyles(element, styles) {
        // Using inline styles to usurp specificity of the website
        for (const [property, value] of Object.entries(styles)) {
            if (element.id !== "focusIndicatorOverlay") {
                const tempAttribute = `data-original-${property}`;
                if (element.getAttribute(tempAttribute) === null) {
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
                continue;
            } else if (!originalValue) {
                element.style.removeProperty(property);
            }

            element.style[property] = originalValue;
            element.removeAttribute(tempAttribute);
        }
    }

    function isEnabledOnHost(host) {
        if (!host) {
            return true; // It's probably a file
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

        window.addEventListener("focus", handleWindowFocus);
        window.addEventListener("blur", handleWindowBlur);

        if (settings.indicatorPosition !== "element") {
            document.documentElement.appendChild(overlayShadowHost);
            window.focusIndicatorRAF = requestAnimationFrame(updateOverlayRAF);
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

        window.removeEventListener("focus", handleWindowFocus);
        window.removeEventListener("blur", handleWindowBlur);

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
        overlayShadowHost.remove();
    }

    function handleWindowFocus() {
        windowIsFocused = true;
        if (settings.indicatorPosition !== "element") {
            cancelAnimationFrame(window.focusIndicatorRAF);
            window.focusIndicatorRAF = requestAnimationFrame(updateOverlayRAF);
        }
    }

    function handleWindowBlur() {
        windowIsFocused = false;
        cancelAnimationFrame(window.focusIndicatorRAF);
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

                // Pass message on to nested iframes
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
                            document.documentElement.appendChild(
                                overlayShadowHost,
                            );
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

        let currentPosition;
        const rect = element.getBoundingClientRect();
        if (settings.indicatorColor === "hybrid") {
            const combinedOffset =
                settings.outlineOffset + settings.outlineWidth;
            currentPosition = {
                top: Math.round(rect.top) - combinedOffset,
                left: Math.round(rect.left) - combinedOffset,
                width: Math.round(rect.width) + combinedOffset * 2,
                height: Math.round(rect.height) + combinedOffset * 2,
            };
        } else {
            const currentBorderRadius =
                window.getComputedStyle(element).borderRadius;
            if (lastBorderRadius && currentBorderRadius !== lastBorderRadius) {
                return true;
            }
            currentPosition = {
                top: Math.round(rect.top) - settings.outlineOffset,
                left: Math.round(rect.left) - settings.outlineOffset,
                width: Math.round(rect.width) + settings.outlineOffset * 2,
                height: Math.round(rect.height) + settings.outlineOffset * 2,
            };
        }

        const changed = Object.entries(currentPosition).some(
            ([key, value]) => lastKnownPosition[key] !== value,
        );
        return changed;
    }

    function updateOverlayRAF() {
        if (!windowIsFocused) {
            return;
        }

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

