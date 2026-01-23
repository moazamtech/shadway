import {
    Layers,
    Layout,
    Grid,
    Lock,
    Sidebar,
    BarChart,
    Table as TableIcon,
    Terminal,
    Sparkles,
} from "lucide-react";

export interface CategoryConfig {
    name: string;
    description: string;
    icon: any;
    blocks?: number; // Optional as it might be dynamic
}

export const CATEGORIES_CONFIG: CategoryConfig[] = [
    {
        name: "Components",
        description: "Beautiful, accessible UI components for your applications.",
        icon: Layout,
    },
    {
        name: "AI Interface",
        description: "Chat layouts, assistants, and prompt inputs.",
        icon: Sparkles,
    },
    {
        name: "Dialogs",
        description: "Modals, sheets, and popovers.",
        icon: Layers,
    },
    {
        name: "File Upload",
        description: "Dropzones and media flows.",
        icon: Layout,
    },
    {
        name: "Form Layouts",
        description: "Structured inputs and steps.",
        icon: Terminal,
    },
    {
        name: "Grid List",
        description: "Responsive content grids.",
        icon: Grid,
    },
    {
        name: "Authentication",
        description: "Login, signup and recovery.",
        icon: Lock,
    },
    {
        name: "Sidebar",
        description: "Navigation shells & menus.",
        icon: Sidebar,
    },
    {
        name: "Analytics",
        description: "Charts, KPIs, and stats.",
        icon: BarChart,
    },
    {
        name: "Data Tables",
        description: "High-density data views.",
        icon: TableIcon,
    },
    {
        name: "Hero",
        description: "Landing page hero sections.",
        icon: Layout,
    },
    {
        name: "Features",
        description: "Feature sections and bento grids.",
        icon: Grid,
    },
    {
        name: "Testimonials",
        description: "Customer reviews and social proof.",
        icon: Sparkles,
    },
    {
        name: "Cta",
        description: "Conversion-focused call to action sections.",
        icon: Terminal,
    },
    {
        name: "Contact",
        description: "Forms and contact sections.",
        icon: Terminal,
    },
    {
        name: "Footer",
        description: "Site footers and navigation.",
        icon: Layout,
    },
    {
        name: "About",
        description: "Company and team sections.",
        icon: Layout,
    }
];

export const getCategoryConfig = (name: string) => {
    return CATEGORIES_CONFIG.find(c => c.name.toLowerCase() === name.toLowerCase()) || {
        name: name,
        description: `Collection of ${name} blocks and components.`,
        icon: Layout
    };
};
