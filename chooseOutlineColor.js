function calculateRelativeLuminance(color) {
    let [r, g, b, a] = color.match(/\d*\.?\d+/g).map(Number);

    // If alpha channel exists, apply it to RGB values
    if (typeof a !== "undefined") {
        // Assuming white background for alpha blending
        r = (1 - a) * 255 + a * r;
        g = (1 - a) * 255 + a * g;
        b = (1 - a) * 255 + a * b;
    }

    const getSRGB = (c) => {
        const sc = c / 255;
        return sc <= 0.03928 ? sc / 12.92 : Math.pow((sc + 0.055) / 1.055, 2.4);
    };

    const rs = getSRGB(r);
    const gs = getSRGB(g);
    const bs = getSRGB(b);

    const luminance = 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    return luminance;
}

function isOpaque(elem) {
    const style = window.getComputedStyle(elem);
    if (style.opacity == 0) {
        return false;
    }
    if (
        style.backgroundColor.includes("rgba") &&
        style.backgroundColor.endsWith(" 0)")
    ) {
        return false;
    }
    return true;
}

function getOpaqueBgElement(element) {
    const rect = element.getBoundingClientRect();
    let x = rect.left + 1;
    let y = rect.top + 1;
    const elements = document.elementsFromPoint(x, y);

    let firstOpaque = null;
    for (let i = 1; i < elements.length; i++) {
        if (isOpaque(elements[i])) {
            firstOpaque = elements[i];
            break;
        }
    }

    if (!firstOpaque) {
        let elem = element.parentElement;
        while (elem && !isOpaque(elem)) {
            elem = elem.parentElement;
        }
        firstOpaque = elem;
    }

    return firstOpaque;
}

function chooseOutlineColor(element) {
    // The background element's color is used instead of the focused element's
    // background due to the outline being shown around the element rather
    // than on the element
    const bgElement = getOpaqueBgElement(element);
    let bgColor = "rgb(255, 255, 255)";
    if (bgElement) {
        bgColor = window.getComputedStyle(bgElement).backgroundColor;
    }

    const bgLuminance = calculateRelativeLuminance(bgColor);
    const blackContrast = (bgLuminance + 0.05) / 0.05;
    const whiteContrast = 1.05 / (bgLuminance + 0.05);
    const outlineColor = blackContrast > whiteContrast ? "black" : "white";
    return outlineColor;
}
