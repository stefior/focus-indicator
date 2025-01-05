chrome.storage.sync.get("siteList", function (data) {
    const siteList = data.siteList || [];
    const currentHost = location.host;

    chrome.storage.sync.get("listType", function (data) {
        const listType = data.listType || "blacklist";

        if (listType === "blacklist" && siteList.includes(currentHost)) {
            return; // Don't apply focus indicators
        } else if (
            listType !== "blacklist" &&
            !siteList.includes(currentHost)
        ) {
            return; // Don't apply focus indicators
        }

        // Relative luminance formula:
        // https://www.w3.org/TR/2008/REC-WCAG20-20081211/#relativeluminancedef
        function calculateRelativeLuminance(color) {
            const [r, g, b] = color.match(/\d+/g).map(Number);

            // Gamma correction
            const getSRGB = (c) => {
                // Divide by 255 to normalize
                const sc = c / 255;

                return sc <= 0.03928
                    ? // linear
                      sc / 12.92
                    : // exponential
                      Math.pow((sc + 0.055) / 1.055, 2.4);
            };

            return (
                0.2126 * getSRGB(r) + 0.7152 * getSRGB(g) + 0.0722 * getSRGB(b)
            );
        }

        function getOutlineColor(bgColor) {
            const bgLuminance = calculateRelativeLuminance(bgColor);

            const blackContrast = (bgLuminance + 0.05) / 0.05;

            const whiteContrast = 1.05 / (bgLuminance + 0.05);

            return blackContrast > whiteContrast ? "black" : "white";
        }

        function isOpaque(elem) {
            const style = window.getComputedStyle(elem);

            if (style.opacity == 0) return false;

            if (
                style.backgroundColor.includes("rgba") &&
                style.backgroundColor.endsWith(" 0)")
            ) {
                return false;
            }

            return true;
        }

        function getOpaqueBgElement(focused) {
            // Get focused element position
            const rect = focused.getBoundingClientRect();
            let x = rect.left + 1; // add 1 to get inside the bounds of the element
            let y = rect.top + 1;

            // Get stack of elements at point
            const elements = document.elementsFromPoint(x, y);

            // Find the first opaque element visually on/below the focused element, which
            // is often not actually an ancestor
            let firstOpaque = null;
            for (let i = 1; i < elements.length; i++) {
                if (isOpaque(elements[i])) {
                    firstOpaque = elements[i];
                    break;
                }
            }

            // Fall back to checking parent elements (e.g. focus is outside viewport)
            if (!firstOpaque) {
                let elem = focused.parentElement;
                while (elem && !isOpaque(elem)) {
                    elem = elem.parentElement;
                }
                firstOpaque = elem;
            }

            return firstOpaque;
        }

        document.addEventListener("focusin", (event) => {
            const focused = event.target;
            // (Background element's color is used instead of the focused element's
            // background due to the outline being shown around the element rather
            // than on the element)
            const bgElement = getOpaqueBgElement(focused);
            if (bgElement) {
                let bgColor =
                    window.getComputedStyle(bgElement).backgroundColor;

                const outlineColor = getOutlineColor(bgColor);

                document.documentElement.style.setProperty(
                    "--focus-indicator-color",
                    outlineColor,
                );
                if (focused.tagName == "TEXTAREA") {
                    focused.classList.add("focus-indicator-ext-textarea");
                } else {
                    focused.classList.add("focus-indicator-ext");
                }
            }
        });

        document.addEventListener("focusout", (event) => {
            event.target.classList.remove("focus-indicator-ext");
            event.target.classList.remove("focus-indicator-ext-textarea");
        });
    });
});
