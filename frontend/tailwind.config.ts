/**
 * Tailwind CSS configuration file.
 *
 * This file defines the complete design system for the project:
 * - A dual‑theme color palette (light/dark) via CSS custom properties.
 * - Custom scrollbar utilities.
 * - Dynamic entrance animations (stagger groups, fall classes, combos).
 * - Reusable component classes (card, glass, glass-smoked, btn-glass).
 * - Extended theme values (fonts, spacing, shadows, breakpoints, animations).
 *
 * The dark theme is activated by adding the `.dark` class to a parent element
 * (usually `<html>` or `<body>`).
 */
import type { Config } from "tailwindcss"
import plugin from "tailwindcss/plugin"
import flattenColorPalette from "tailwindcss/lib/util/flattenColorPalette"

// ─── Plugin 1: Theme color palette (light & dark modes) ────────────────
const palettePlugin = plugin(({ addBase }) => {
  addBase({
    // Light mode (default) – all colors use HSL with commas for maximum compatibility
    ":root": {
      /* Backgrounds */
      "--bg-dark": "hsl(144, 7%, 89%)",
      "--bg": "hsl(144, 13%, 94%)",
      "--bg-light": "hsl(144, 100%, 100%)",
      /* Text */
      "--text": "hsl(145, 24%, 4%)",
      "--text-muted": "hsl(144, 4%, 28%)",
      "--highlight": "hsl(144, 100%, 99%)",
      /* Borders */
      "--border": "hsl(144, 3%, 50%)",
      "--border-muted": "hsl(144, 4%, 62%)",
      /* Semantic colors */
      "--primary": "hsl(160, 100%, 13%)",
      "--secondary": "hsl(318, 38%, 30%)",
      "--danger": "hsl(9, 21%, 41%)",
      "--warning": "hsl(52, 23%, 34%)",
      "--success": "hsl(147, 19%, 36%)",
      "--info": "hsl(217, 22%, 41%)",

      /* Light mode hover & active variants */
      "--bg-dark-hover": "hsl(144, 7%, 92%)",
      "--bg-hover": "hsl(144, 13%, 98%)",
      "--bg-light-hover": "hsl(144, 100%, 100%)",
      "--primary-hover": "hsl(160, 100%, 20%)",
      "--primary-active": "hsl(160, 100%, 25%)",
      "--secondary-hover": "hsl(318, 38%, 40%)",
      "--secondary-active": "hsl(318, 38%, 45%)",
      "--danger-hover": "hsl(9, 21%, 48%)",
      "--danger-active": "hsl(9, 21%, 55%)",
      "--warning-hover": "hsl(52, 23%, 40%)",
      "--warning-active": "hsl(52, 23%, 47%)",
      "--success-hover": "hsl(147, 19%, 43%)",
      "--success-active": "hsl(147, 19%, 50%)",
      "--info-hover": "hsl(217, 22%, 48%)",
      "--info-active": "hsl(217, 22%, 55%)",

      /* Card shadows */
      "--shadow-card":
        "inset 0px 2px 0px var(--highlight), inset 0px -2px 0px rgba(0,0,0,7%), 0px 2px 3px rgba(0,0,0,7%)",
      "--shadow-card-hover":
        "inset 0px 2px 0px var(--highlight), inset 0px -2px 0px rgba(0,0,0,7%), 0px 3px 5px rgba(0,0,0,20%)",
      "--border-card": "var(--border)",
      "--border-card-hover": "var(--primary)",

      /* Glassmorphism variables – light mode */
      "--glass-bg": "hsla(144, 100%, 100%, 0.75)", // increased opacity for better readability
      "--glass-bg-smoked": "hsla(144, 7%, 89%, 0.8)",
      "--glass-border": "hsla(144, 4%, 62%, 0.3)",
      "--shadow-glass": "inset 0px 2px 0px var(--highlight), 0 8px 32px rgba(0, 0, 0, 0.1)",
      "--shadow-glass-smoked": "inset 0px 2px 0px var(--highlight), 0 8px 32px rgba(0, 0, 0, 0.25)",
      "--glass-text-shadow": "0 1px 2px rgba(0,0,0,0.15)", // subtle shadow to improve text contrast
    },

    // Dark mode overrides – activated when a parent has `.dark`
    ".dark": {
      /* Backgrounds */
      "--bg-dark": "hsl(144, 18%, 1%)",
      "--bg": "hsl(145, 11%, 4%)",
      "--bg-light": "hsl(144, 6%, 8%)",
      /* Text */
      "--text": "hsl(144, 25%, 94%)",
      "--text-muted": "hsl(144, 4%, 69%)",
      "--highlight": "hsl(144, 3%, 38%)",
      /* Borders */
      "--border": "hsl(144, 4%, 28%)",
      "--border-muted": "hsl(145, 6%, 17%)",
      /* Semantic colors */
      "--primary": "hsl(149, 41%, 62%)",
      "--secondary": "hsl(320, 50%, 73%)",
      "--danger": "hsl(9, 26%, 64%)",
      "--warning": "hsl(52, 19%, 57%)",
      "--success": "hsl(146, 17%, 59%)",
      "--info": "hsl(217, 28%, 65%)",

      /* Dark mode hover & active variants */
      "--bg-dark-hover": "hsl(144, 18%, 6%)",
      "--bg-hover": "hsl(145, 11%, 9%)",
      "--bg-light-hover": "hsl(144, 6%, 13%)",
      "--primary-hover": "hsl(149, 41%, 72%)",
      "--primary-active": "hsl(149, 41%, 77%)",
      "--secondary-hover": "hsl(320, 50%, 83%)",
      "--secondary-active": "hsl(320, 50%, 88%)",
      "--danger-hover": "hsl(9, 26%, 74%)",
      "--danger-active": "hsl(9, 26%, 79%)",
      "--warning-hover": "hsl(52, 19%, 67%)",
      "--warning-active": "hsl(52, 19%, 72%)",
      "--success-hover": "hsl(146, 17%, 69%)",
      "--success-active": "hsl(146, 17%, 74%)",
      "--info-hover": "hsl(217, 28%, 75%)",
      "--info-active": "hsl(217, 28%, 80%)",

      /* Card shadows */
      "--shadow-card":
        "inset 0px 2px 0px var(--highlight), inset 0px -2px 0px rgba(0,0,0,20%), 0px 2px 3px rgba(0,0,0,25%)",
      "--shadow-card-hover":
        "inset 0px 2px 0px var(--highlight), inset 0px -2px 0px rgba(0,0,0,20%), 0px 3px 5px rgba(0,0,0,20%)",
      "--border-card": "var(--border-muted)",
      "--border-card-hover": "var(--primary)",

      /* Glassmorphism variables – dark mode */
      "--glass-bg": "hsla(145, 11%, 4%, 0.7)", // slightly more opaque for dark backgrounds
      "--glass-bg-smoked": "hsla(0, 0%, 0%, 0.75)",
      "--glass-border": "hsla(144, 4%, 28%, 0.4)",
      "--shadow-glass": "inset 0px 2px 0px var(--highlight), 0 8px 32px rgba(0, 0, 0, 0.3)",
      "--shadow-glass-smoked": "inset 0px 2px 0px var(--highlight), 0 8px 32px rgba(0, 0, 0, 0.5)",
      "--glass-text-shadow": "0 1px 2px rgba(255,255,255,0.15)", // subtle glow for dark mode text
    },
  })
})

// ─── Plugin 2: Custom scrollbar utilities ──────────────────────────────
const scrollbarPlugin = plugin(({ addBase, addUtilities, matchUtilities, theme }) => {
  addBase({
    ":root": {
      "--scrollbar-hover-brightness": "0.85",
      "--scrollbar-thumb": "auto",
      "--scrollbar-track": "transparent",
      "--scrollbar-width": "8px",
    },
    ".dark": {
      "--scrollbar-hover-brightness": "1.25",
    },
  })

  addUtilities({
    ".scrollbar": {
      "scrollbar-gutter": "stable",
      "scrollbar-color": "var(--scrollbar-thumb) var(--scrollbar-track)",
      "&::-webkit-scrollbar": {
        width: "var(--scrollbar-width)",
        height: "var(--scrollbar-width)",
      },
      "&::-webkit-scrollbar-track": {
        backgroundColor: "var(--scrollbar-track)",
      },
      "&::-webkit-scrollbar-thumb": {
        backgroundColor: "var(--scrollbar-thumb)",
      },
      "&::-webkit-scrollbar-thumb:hover": {
        filter: "brightness(var(--scrollbar-hover-brightness))",
      },
    },
    ".scrollbar-rounded": {
      "&::-webkit-scrollbar-track, &::-webkit-scrollbar-thumb": {
        borderRadius: "0.5rem",
      },
    },
    ".scrollbar-thin": {
      "scrollbar-width": "thin",
      "--scrollbar-width": "5px",
    },
  })

  matchUtilities(
    {
      "scrollbar-thumb": (value) => ({ "--scrollbar-thumb": value }),
      "scrollbar-track": (value) => ({ "--scrollbar-track": value }),
    },
    {
      values: flattenColorPalette(theme("colors")),
      type: "color",
    }
  )
})

// ─── Plugin 3: Animations and extra utilities ───────────────────────────
const animationsPlugin = plugin(({ addBase, addComponents, addUtilities }) => {
  // Inyectamos incondicionalmente las animaciones necesarias en el DOM base.
  // Al hacerlo vía addBase, garantizamos que el motor JIT de Tailwind no purgue
  // estos @keyframes si solo son referenciados desde un custom component string.
  addBase({
    'input[type="number"]::-webkit-outer-spin-button, input[type="number"]::-webkit-inner-spin-button':
      { "-webkit-appearance": "none", margin: "0" },
    'input[type="number"]': {
      "-moz-appearance": "textfield",
      appearance: "textfield",
    },
    "@keyframes stagger-fade-up": {
      "0%": { opacity: "0", transform: "translateY(-15px)" },
      "100%": { opacity: "1", transform: "translateY(0)" },
    },
    // Keyframes combinados para evitar colisiones entre translateX y translateY.
    // CSS desechará transformaciones anteriores si se declaran en animaciones separadas concurrentes.
    "@keyframes fall-and-slide-right": {
      "0%": { opacity: "0", transform: "translate(100%, -15px)" },
      "100%": { opacity: "1", transform: "translate(0, 0)" },
    },
    "@keyframes fall-and-slide-left": {
      "0%": { opacity: "0", transform: "translate(-100%, -15px)" },
      "100%": { opacity: "1", transform: "translate(0, 0)" },
    },
  })

  // Staggered entrance for child elements (up to 10 children)
  const staggerChildren: Record<string, any> = {
    ".stagger-group > *": {
      opacity: "0",
      // Referencia asegurada ya que stagger-fade-up se ha registrado en addBase
      animation: "stagger-fade-up 0.5s ease forwards",
    },
  }
  for (let i = 1; i <= 10; i++) {
    staggerChildren[`.stagger-group > *:nth-child(${i})`] = {
      "animation-delay": `${i * 0.1}s`,
    }
  }
  addComponents(staggerChildren)

  // Individual entrance classes: animate-fall-on-1, animate-fall-on-2, ...
  // These use the stagger-fade-up keyframe with incremental delays.
  const fallClasses: Record<string, any> = {}
  for (let i = 1; i <= 10; i++) {
    fallClasses[`.animate-fall-on-${i}`] = {
      opacity: "0",
      animation: `stagger-fade-up 0.5s ease ${(i - 1) * 0.1}s forwards`,
    }
  }
  addComponents(fallClasses)

  // Combined animation examples
  addComponents({
    ".fall-and-slide-right": {
      opacity: "0",
      // Unificamos la llamada apuntando al keyframe que maneja el cálculo matricial en ambos ejes.
      animation: "fall-and-slide-right 0.5s ease forwards",
    },
    ".fall-and-slide-left": {
      opacity: "0",
      animation: "fall-and-slide-left 0.5s ease forwards",
    },
  })

  // Scroll‑fade effect using CSS masks
  addUtilities({
    ".scroll-fade-y": {
      "--fade-size": "1rem",
      "mask-image":
        "linear-gradient(to bottom, transparent 0%, black var(--fade-size), black calc(100% - var(--fade-size)), transparent 100%)",
      "-webkit-mask-image":
        "linear-gradient(to bottom, transparent 0%, black var(--fade-size), black calc(100% - var(--fade-size)), transparent 100%)",
    },
  })
})

// ─── Plugin 4: Reusable component classes ───────────────────────────────
const componentsPlugin = plugin(({ addComponents }) => {
  addComponents({
    // Card component with gradient, shadow, and hover scale effect
    ".card": {
      display: "flex",
      flexDirection: "column",
      gap: "0.5rem",
      borderRadius: "1.5rem", // 3xl
      borderWidth: "2px",
      padding: "1.5rem",
      transition: "all 75ms ease-in-out",
      background: "linear-gradient(to bottom, var(--bg-light), var(--bg), var(--bg))",
      boxShadow: "var(--shadow-card)",
      borderColor: "var(--border-card)",
      "&:hover": {
        transform: "scale(1.05)",
        background:
          "linear-gradient(to bottom, var(--bg-light-hover), var(--bg-hover), var(--bg-hover))",
        boxShadow: "var(--shadow-card-hover)",
        borderColor: "var(--border-card-hover)",
      },
    },

    // ─── Glass containers (with highlight shadow) ─────────────────
    ".glass": {
      background: "var(--glass-bg)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)", // Safari
      border: "1px solid var(--glass-border)",
      boxShadow: "var(--shadow-glass)",
      borderRadius: "1rem",
    },
    ".glass-smoked": {
      background: "var(--glass-bg-smoked)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      border: "1px solid var(--glass-border)",
      boxShadow: "var(--shadow-glass-smoked)",
      borderRadius: "1rem",
    },

    // ─── Glass button (translucent, with highlight shadow) ───────
    ".btn-glass": {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "0.5rem",
      borderRadius: "1rem",
      background: "var(--glass-bg)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      border: "1px solid var(--glass-border)",
      boxShadow: "var(--shadow-glass)",
      color: "var(--text)",
      fontWeight: "600",
      fontSize: "0.875rem",
      lineHeight: "1.25rem",
      cursor: "pointer",
      textShadow: "var(--glass-text-shadow)", // enhances legibility over glass
      // Separate transitions: fast scale, smooth color/background changes
      transition:
        "transform 75ms ease-in-out, background 250ms ease-in-out, box-shadow 250ms ease-in-out, color 250ms ease-in-out",
      "&:hover:not([disabled])": {
        background: "var(--bg-light-hover)", // nearly opaque for maximum contrast
        boxShadow: "var(--shadow-glass-smoked)", // stronger shadow
        transform: "scale(1.02)",
        textShadow: "none", // shadow no longer needed on solid background
      },
      "&:active:not([disabled])": {
        transform: "scale(0.98)",
      },
      "&[disabled]": {
        opacity: "0.5",
        pointerEvents: "none",
      },
    },
  })
})

// ─── Tailwind configuration export ──────────────────────────────────────
export const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "selector",
  theme: {
    extend: {
      fontFamily: {
        heading: ["Montserrat Variable"],
        body: ["Inter Variable"],
      },
      spacing: {
        128: "32rem",
        144: "36rem",
        152: "38rem",
      },
      colors: {
        ui: {
          back: "var(--bg-dark)",
          base: "var(--bg)",
          front: "var(--bg-light)",
          text: "var(--text)",
          "text-muted": "var(--text-muted)",
          highlight: "var(--highlight)",
          border: "var(--border)",
          "border-muted": "var(--border-muted)",
          primary: "var(--primary)",
          "primary-hover": "var(--primary-hover)",
          "primary-active": "var(--primary-active)",
          secondary: "var(--secondary)",
          "secondary-hover": "var(--secondary-hover)",
          "secondary-active": "var(--secondary-active)",
          danger: "var(--danger)",
          "danger-hover": "var(--danger-hover)",
          "danger-active": "var(--danger-active)",
          warning: "var(--warning)",
          "warning-hover": "var(--warning-hover)",
          "warning-active": "var(--warning-active)",
          success: "var(--success)",
          "success-hover": "var(--success-hover)",
          "success-active": "var(--success-active)",
          info: "var(--info)",
          "info-hover": "var(--info-hover)",
          "info-active": "var(--info-active)",
        },
      },
      keyframes: {
        // Los keyframes exclusivos de los plugins se han movido al scope de addBase.
        // Aquí solo se mantienen los keyframes que están expuestos a clases estándar de utilidad de Tailwind.
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(-15px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          from: { transform: "translateY(-100%)" },
          to: { transform: "translateY(0)" },
        },
        "slide-in-left": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.5s ease forwards",
        "slide-down": "slide-down 0.5s ease forwards",
        "slide-in-left": "slide-in-left 0.25s ease forwards",
        "slide-in-right": "slide-in-right 0.25s ease forwards",
        "spin-slow": "spin 25s linear infinite",
      },
      boxShadow: {
        ui: "var(--shadow-card)",
        "2ui": "var(--shadow-card-hover)",
        "3ui":
          "inset 0px 2px 0px var(--highlight), inset 0px -2px 0px rgba(0,0,0,15%), 0px 2px 3px rgba(0,0,0,7%)",
        dui: "var(--shadow-card)",
      },
      screens: {
        xs: "480px",
      },
    },
  },
  plugins: [palettePlugin, scrollbarPlugin, animationsPlugin, componentsPlugin],
}

export default config
