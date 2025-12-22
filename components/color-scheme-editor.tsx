"use client";

import React, { useState } from "react";
import { Palette, ChevronDown, RotateCcw, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
    ColorSchemeConfig,
    ShadcnColorScheme,
    defaultColorSchemeConfig,
    colorSchemePresets,
} from "@/lib/color-scheme";

interface ColorSchemeEditorProps {
    value: ColorSchemeConfig;
    onChange: (config: ColorSchemeConfig) => void;
    isDark?: boolean;
}

// Color swatch component for selecting colors
function ColorSwatch({
    color,
    onChange,
    label,
}: {
    color: string;
    onChange: (color: string) => void;
    label: string;
}) {
    return (
        <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground w-28 truncate" title={label}>
                {label}
            </label>
            <div className="relative">
                <input
                    type="color"
                    value={color}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent p-0.5"
                />
            </div>
            <input
                type="text"
                value={color}
                onChange={(e) => onChange(e.target.value)}
                className="flex-1 h-7 px-2 text-xs rounded border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="#000000"
            />
        </div>
    );
}

export function ColorSchemeEditor({
    value,
    onChange,
    isDark = false,
}: ColorSchemeEditorProps) {
    const [activeTab, setActiveTab] = useState<"presets" | "customize">("presets");
    const [editMode, setEditMode] = useState<"light" | "dark">(isDark ? "dark" : "light");

    const currentScheme = editMode === "dark" ? value.dark : value.light;

    const updateColor = (key: keyof ShadcnColorScheme, color: string) => {
        const newConfig = { ...value };
        if (editMode === "dark") {
            newConfig.dark = { ...newConfig.dark, [key]: color };
        } else {
            newConfig.light = { ...newConfig.light, [key]: color };
        }
        onChange(newConfig);
    };

    const selectPreset = (preset: ColorSchemeConfig) => {
        onChange(preset);
    };

    const resetToDefault = () => {
        onChange(defaultColorSchemeConfig);
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs h-8"
                >
                    <Palette className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Colors</span>
                    <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-80 p-0"
                align="end"
                sideOffset={8}
            >
                <div className="p-3 border-b border-border">
                    <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">Color Scheme</h4>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={resetToDefault}
                            title="Reset to default"
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Customize the look of your generated components
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-border">
                    <button
                        onClick={() => setActiveTab("presets")}
                        className={cn(
                            "flex-1 py-2 text-xs font-medium transition-colors",
                            activeTab === "presets"
                                ? "border-b-2 border-primary text-foreground"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Presets
                    </button>
                    <button
                        onClick={() => setActiveTab("customize")}
                        className={cn(
                            "flex-1 py-2 text-xs font-medium transition-colors",
                            activeTab === "customize"
                                ? "border-b-2 border-primary text-foreground"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Customize
                    </button>
                </div>

                <div className="p-3 max-h-80 overflow-y-auto">
                    {activeTab === "presets" ? (
                        <div className="grid grid-cols-2 gap-2">
                            {colorSchemePresets.map((preset) => (
                                <button
                                    key={preset.name}
                                    onClick={() => selectPreset(preset.config)}
                                    className={cn(
                                        "p-2 rounded-lg border text-left transition-all",
                                        JSON.stringify(value) === JSON.stringify(preset.config)
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:border-primary/50"
                                    )}
                                >
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <div
                                            className="w-4 h-4 rounded-full border border-border"
                                            style={{ backgroundColor: isDark ? preset.config.dark.primary : preset.config.light.primary }}
                                        />
                                        <span className="text-xs font-medium">{preset.name}</span>
                                    </div>
                                    <div className="flex gap-0.5">
                                        {[
                                            isDark ? preset.config.dark.primary : preset.config.light.primary,
                                            isDark ? preset.config.dark.secondary : preset.config.light.secondary,
                                            isDark ? preset.config.dark.accent : preset.config.light.accent,
                                            isDark ? preset.config.dark.muted : preset.config.light.muted,
                                        ].map((color, i) => (
                                            <div
                                                key={i}
                                                className="w-5 h-3 rounded-sm"
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {/* Mode Toggle */}
                            <div className="flex items-center justify-center gap-1 p-1 bg-muted rounded-lg">
                                <button
                                    onClick={() => setEditMode("light")}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors",
                                        editMode === "light"
                                            ? "bg-background shadow text-foreground"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <Sun className="h-3 w-3" />
                                    Light
                                </button>
                                <button
                                    onClick={() => setEditMode("dark")}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors",
                                        editMode === "dark"
                                            ? "bg-background shadow text-foreground"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <Moon className="h-3 w-3" />
                                    Dark
                                </button>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-medium">Base Colors</Label>
                                <ColorSwatch
                                    label="Background"
                                    color={currentScheme.background}
                                    onChange={(c) => updateColor("background", c)}
                                />
                                <ColorSwatch
                                    label="Foreground"
                                    color={currentScheme.foreground}
                                    onChange={(c) => updateColor("foreground", c)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-medium">Primary</Label>
                                <ColorSwatch
                                    label="Primary"
                                    color={currentScheme.primary}
                                    onChange={(c) => updateColor("primary", c)}
                                />
                                <ColorSwatch
                                    label="Primary Text"
                                    color={currentScheme.primaryForeground}
                                    onChange={(c) => updateColor("primaryForeground", c)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-medium">Secondary & Muted</Label>
                                <ColorSwatch
                                    label="Secondary"
                                    color={currentScheme.secondary}
                                    onChange={(c) => updateColor("secondary", c)}
                                />
                                <ColorSwatch
                                    label="Muted"
                                    color={currentScheme.muted}
                                    onChange={(c) => updateColor("muted", c)}
                                />
                                <ColorSwatch
                                    label="Muted Text"
                                    color={currentScheme.mutedForeground}
                                    onChange={(c) => updateColor("mutedForeground", c)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-medium">UI Elements</Label>
                                <ColorSwatch
                                    label="Border"
                                    color={currentScheme.border}
                                    onChange={(c) => updateColor("border", c)}
                                />
                                <ColorSwatch
                                    label="Input"
                                    color={currentScheme.input}
                                    onChange={(c) => updateColor("input", c)}
                                />
                                <ColorSwatch
                                    label="Ring/Focus"
                                    color={currentScheme.ring}
                                    onChange={(c) => updateColor("ring", c)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-medium">Destructive</Label>
                                <ColorSwatch
                                    label="Destructive"
                                    color={currentScheme.destructive}
                                    onChange={(c) => updateColor("destructive", c)}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
