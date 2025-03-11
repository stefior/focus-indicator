<div align="center">
    
# Focus Indicator

**A chrome extension for adding a high-contrast outline around the element with keyboard focus**
    
<img alt="Focus Indicator Icon" height="150" src="/icons/icon512.png" />
</div>

---

I predominantly use my keyboard to navigate websites, but many sites don't always make it clear where the keyboard is focused. This extension aims to help solve that issue by putting a white or black border around the focused element, depending on whichever results in a higher contrast.

Focus Indicator uses multiple strategies to aim for it to work effectively across all websites, but it can't account for every improper accessibility setup. For example, if a site has a focusable element out of the screen's bounds, it won't show any difference. It also doesn't affect which elements are able to be focused with the keyboard.

It prioritizes function over form. If you'd like, you can disable the extension on certain sites (blacklist them) or you can enable the extension only on certain sites (whitelist them). All settings can be configured by clicking on the extension's icon.

There are two focus indication methods, depending on your preference:

1. Overlay (default, new with version 2)
    - Works by having a floating outline above the current focused element's position
    - Almost guaranteed to show the outline if it is possible to, EVEN IF the focused element is behind another element

2. On Element
    - Works by modifying the current element's focused styles
    - The indicator will sometimes end up partly or fully covered up by other elements, but it can be less intrusive

Overlay Mode settings:
- Indicator color mode
    - Solid (default) - The outline will be either solid black or solid white
    - Hybrid - Each individual pixel in the outline will be either black or white, whichever is closest to the inverse of whatever is directly behind it
- Outline width (default: 4px) - Adjust the thickness of the outline
- Outline offset (default: 1px) - Set how much space there is between the element and the outline
- Use transition between focused elements (default: off) - Animates focus shifts for better visual tracking
- Use "On Element" mode for text input elements (default: on) - The overlay may cover text while typing in certain text input elements, mainly in online code editors, so "On Element" mode can be used for just those elements instead
