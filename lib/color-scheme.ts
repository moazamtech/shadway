// Shadcn Color Scheme Types and Defaults
export interface ShadcnColorScheme {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    popover: string;
    popoverForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    destructive: string;
    destructiveForeground: string;
    border: string;
    input: string;
    ring: string;
}

export interface ColorSchemeConfig {
    light: ShadcnColorScheme;
    dark: ShadcnColorScheme;
    radiusSm: string;
    radiusMd: string;
    radiusLg: string;
    radiusXl: string;
    fontFamily: string;
}

// Default Shadcn color schemes
export const defaultLightScheme: ShadcnColorScheme = {
    background: "#ffffff",
    foreground: "#0a0a0a",
    card: "#ffffff",
    cardForeground: "#0a0a0a",
    popover: "#ffffff",
    popoverForeground: "#0a0a0a",
    primary: "#171717",
    primaryForeground: "#fafafa",
    secondary: "#f5f5f5",
    secondaryForeground: "#171717",
    muted: "#f5f5f5",
    mutedForeground: "#737373",
    accent: "#f5f5f5",
    accentForeground: "#171717",
    destructive: "#ef4444",
    destructiveForeground: "#fafafa",
    border: "#e5e5e5",
    input: "#e5e5e5",
    ring: "#0a0a0a",
};

export const defaultDarkScheme: ShadcnColorScheme = {
    background: "#0a0a0a",
    foreground: "#fafafa",
    card: "#0a0a0a",
    cardForeground: "#fafafa",
    popover: "#0a0a0a",
    popoverForeground: "#fafafa",
    primary: "#fafafa",
    primaryForeground: "#171717",
    secondary: "#262626",
    secondaryForeground: "#fafafa",
    muted: "#262626",
    mutedForeground: "#a1a1a1",
    accent: "#262626",
    accentForeground: "#fafafa",
    destructive: "#7f1d1d",
    destructiveForeground: "#fafafa",
    border: "#262626",
    input: "#262626",
    ring: "#d4d4d4",
};

export const defaultColorSchemeConfig: ColorSchemeConfig = {
    light: defaultLightScheme,
    dark: defaultDarkScheme,
    radiusSm: "0.25rem",
    radiusMd: "0.375rem",
    radiusLg: "0.5rem",
    radiusXl: "0.75rem",
    fontFamily: '"Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

// Generate Tailwind v4 @theme CSS from color scheme
export function generateThemeCSS(config: ColorSchemeConfig, isDark: boolean): string {
    const colors = isDark ? config.dark : config.light;

    return `
@theme {
  --font-sans: ${config.fontFamily};
  
  --color-background: ${colors.background};
  --color-foreground: ${colors.foreground};
  --color-card: ${colors.card};
  --color-card-foreground: ${colors.cardForeground};
  --color-popover: ${colors.popover};
  --color-popover-foreground: ${colors.popoverForeground};
  --color-primary: ${colors.primary};
  --color-primary-foreground: ${colors.primaryForeground};
  --color-secondary: ${colors.secondary};
  --color-secondary-foreground: ${colors.secondaryForeground};
  --color-muted: ${colors.muted};
  --color-muted-foreground: ${colors.mutedForeground};
  --color-accent: ${colors.accent};
  --color-accent-foreground: ${colors.accentForeground};
  --color-destructive: ${colors.destructive};
  --color-destructive-foreground: ${colors.destructiveForeground};
  --color-border: ${colors.border};
  --color-input: ${colors.input};
  --color-ring: ${colors.ring};
  
  /* Chart colors */
  --color-chart-1: ${isDark ? "#3b82f6" : "#e76e50"};
  --color-chart-2: ${isDark ? "#22c55e" : "#2a9d90"};
  --color-chart-3: ${isDark ? "#f59e0b" : "#264753"};
  --color-chart-4: ${isDark ? "#a855f7" : "#e8c468"};
  --color-chart-5: ${isDark ? "#ec4899" : "#f4a462"};
  
  --radius-sm: ${config.radiusSm};
  --radius-md: ${config.radiusMd};
  --radius-lg: ${config.radiusLg};
  --radius-xl: ${config.radiusXl};
  --radius-2xl: 1rem;
  --radius-full: 9999px;
}

html, body, #root {
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
}

body {
  background-color: var(--color-background);
  color: var(--color-foreground);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* {
  border-color: var(--color-border);
}
`;
}

// Preset color schemes for non-coders
export const colorSchemePresets: { name: string; config: ColorSchemeConfig }[] = [
    {
        name: "Default (Neutral)",
        config: defaultColorSchemeConfig,
    },
    {
        name: "Slate",
        config: {
            ...defaultColorSchemeConfig,
            light: {
                ...defaultLightScheme,
                primary: "#0f172a",
                primaryForeground: "#f8fafc",
                secondary: "#f1f5f9",
                secondaryForeground: "#0f172a",
                muted: "#f1f5f9",
                mutedForeground: "#64748b",
                accent: "#f1f5f9",
                accentForeground: "#0f172a",
                border: "#e2e8f0",
                input: "#e2e8f0",
                ring: "#0f172a",
            },
            dark: {
                ...defaultDarkScheme,
                background: "#020617",
                foreground: "#f8fafc",
                card: "#020617",
                cardForeground: "#f8fafc",
                primary: "#f8fafc",
                primaryForeground: "#0f172a",
                secondary: "#1e293b",
                secondaryForeground: "#f8fafc",
                muted: "#1e293b",
                mutedForeground: "#94a3b8",
                accent: "#1e293b",
                accentForeground: "#f8fafc",
                border: "#1e293b",
                input: "#1e293b",
                ring: "#cbd5e1",
            },
        },
    },
    {
        name: "Blue",
        config: {
            ...defaultColorSchemeConfig,
            light: {
                ...defaultLightScheme,
                primary: "#2563eb",
                primaryForeground: "#ffffff",
                ring: "#2563eb",
            },
            dark: {
                ...defaultDarkScheme,
                primary: "#3b82f6",
                primaryForeground: "#ffffff",
                ring: "#3b82f6",
            },
        },
    },
    {
        name: "Green",
        config: {
            ...defaultColorSchemeConfig,
            light: {
                ...defaultLightScheme,
                primary: "#16a34a",
                primaryForeground: "#ffffff",
                ring: "#16a34a",
            },
            dark: {
                ...defaultDarkScheme,
                primary: "#22c55e",
                primaryForeground: "#052e16",
                ring: "#22c55e",
            },
        },
    },
    {
        name: "Rose",
        config: {
            ...defaultColorSchemeConfig,
            light: {
                ...defaultLightScheme,
                primary: "#e11d48",
                primaryForeground: "#ffffff",
                ring: "#e11d48",
            },
            dark: {
                ...defaultDarkScheme,
                primary: "#f43f5e",
                primaryForeground: "#ffffff",
                ring: "#f43f5e",
            },
        },
    },
    {
        name: "Orange",
        config: {
            ...defaultColorSchemeConfig,
            light: {
                ...defaultLightScheme,
                primary: "#ea580c",
                primaryForeground: "#ffffff",
                ring: "#ea580c",
            },
            dark: {
                ...defaultDarkScheme,
                primary: "#f97316",
                primaryForeground: "#ffffff",
                ring: "#f97316",
            },
        },
    },
    {
        name: "Violet",
        config: {
            ...defaultColorSchemeConfig,
            light: {
                ...defaultLightScheme,
                primary: "#7c3aed",
                primaryForeground: "#ffffff",
                ring: "#7c3aed",
            },
            dark: {
                ...defaultDarkScheme,
                primary: "#8b5cf6",
                primaryForeground: "#ffffff",
                ring: "#8b5cf6",
            },
        },
    },
];
