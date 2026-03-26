# Design System: Sunset Strip & Studio 50

## 1. Overview & Creative North Star
**The Creative North Star: "The Neon Nostalgic"**

This design system moves away from the tired, gritty "Noir" tropes of the 1970s and instead leans into the high-energy, high-glam era of the Sunset Strip at dusk. It is an editorial-first experience that captures the "Vice & Vices" aesthetic through sophistication rather than cliché. 

To break the "template" look, we reject the rigid grid in favor of **Intentional Fluidity**. This system utilizes overlapping elements, exaggerated typography scales, and "Liquid Containers" (using our `xl` and `full` roundedness tokens) to mimic the groovy, organic flow of '70s psych-rock posters. We don't just place content; we choreograph it across the screen using asymmetrical layouts and tonal depth.

---

## 2. Colors & Surface Logic
The palette is a sun-drenched explosion of burnt oranges (`primary`), deep teals (`secondary`), and shocking magentas (`tertiary`).

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning. Structural boundaries must be defined solely through background color shifts. For example, a `surface-container-low` section sitting on a `surface` background provides all the separation needed.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of luxury materials. 
- Use the **Surface Tiers** (`surface-container-lowest` to `highest`) to create "nested" depth. 
- An inner card should use `surface-container-highest` when placed on a `surface-container` background to create a soft, natural lift.

### The "Glass & Gradient" Rule
To achieve "Retro-Glam," use Glassmorphism for floating navigation and modal overlays. 
- **Implementation:** Use `surface` colors at 70% opacity with a `backdrop-blur` of 20px. 
- **Signature Gradients:** Apply a subtle linear gradient from `primary` (#a33700) to `primary-container` (#ff7943) on primary CTAs to simulate the glow of a vintage neon sign.

---

## 3. Typography: The Groovy Editorial
Our typography is a conversation between bold, expressive headlines and clean, modern functional text.

- **Display & Headline (`epilogue`):** This is our "Disco-Funk" voice. Use `display-lg` for hero moments. The tight tracking and bold weight of Epilogue provide the "thick sans-serif" energy required to anchor the page.
- **Title & Body (`beVietnamPro`):** High-end editorial clarity. This font balances the flamboyance of the headlines, ensuring the "Vice" aesthetic remains readable and premium.
- **Labels (`spaceGrotesk`):** We use a monospaced-adjacent feel for technical data (dates, times, locations), nodding to vintage ticket stubs and '70s analog tech.

---

## 4. Elevation & Depth: Tonal Layering
Traditional shadows are too "software-native." We use **Tonal Layering** to convey hierarchy.

- **The Layering Principle:** Place a `surface-container-lowest` (#ffffff) card on a `surface-container-low` (#f8f0e0) section. This creates a "Paper-on-Silk" effect that feels tactile and bespoke.
- **Ambient Shadows:** For floating elements (like a FAB), use a large 40px blur with only 6% opacity. The shadow color must be a tinted version of `on-surface` (#322e25), never pure grey.
- **The "Ghost Border" Fallback:** If a boundary is strictly required for accessibility, use the `outline-variant` token at **15% opacity**. It should be felt, not seen.
- **Halftone Textures:** Apply a subtle SVG halftone pattern overlay (at 3% opacity) to `surface-variant` areas to introduce the "gritty '70s character" without sacrificing the light, vibrant mode.

---

## 5. Components

### Buttons (The "Pill" Aesthetic)
- **Primary:** Burnt Orange (`primary`) background with `on-primary` text. Uses `full` rounding. On hover, transition to the `primary-fixed` gradient.
- **Secondary:** Deep Teal (`secondary`) with `on-secondary`. 
- **Tertiary:** No background; uses `tertiary` (#b50552) text with a `full` rounded `surface-container` ghost-hover state.

### Input Fields (The "Soft Well")
- Forgo the bottom line. Use a `surface-container-high` background with `sm` (0.5rem) rounding. 
- The label should use `label-md` in `on-surface-variant`.
- Active state uses a 2px "Ghost Border" of the `primary` color.

### Cards & Lists (The "Fluid Stack")
- **Rule:** Forbid divider lines.
- Use `spacing-8` (2.75rem) to separate list items. 
- Use subtle background color shifts (`surface-container-low` to `surface-container-highest`) to group related content. 
- Cards should always use `lg` (2rem) or `xl` (3rem) corner radius to lean into the fluid '70s aesthetic.

### Signature Component: The "Vibe Header"
A large-scale header component using `display-lg` typography that overlaps a `primary-container` colored fluid shape. This breaks the top-of-page "header box" and creates an immediate sense of celebration.

---

## 6. Do's and Don'ts

### Do:
- **Do** lean into asymmetry. Offset images and text blocks to create a rhythmic, musical feel.
- **Do** use `tertiary` (Magenta) sparingly as a "pop"—think of it as a strobe light in a dark room.
- **Do** utilize the full breadth of the spacing scale. Negative space in this system should feel like a "luxury" (intentional and expansive).

### Don't:
- **Don't** use pure black (#000000). Use `inverse-surface` (#110e06) if a deep tone is needed.
- **Don't** use sharp corners. The 1970s was an era of soft edges and conversational shapes.
- **Don't** use standard "Material Design" drop shadows. Stick to tonal stacking or ambient, tinted blurs.
- **Don't** use 1px dividers. If you feel the need to separate, use a background color change or a larger spacing token.