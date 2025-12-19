"use client";

import React, { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type TreeNode = {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: TreeNode[];
};

const defaultExpanded = new Set<string>([
  "/",
  "/app",
  "/components",
  "/hooks",
  "/lib",
]);

// VS Code-like file icons with colors
const getFileIcon = (name: string): { icon: string; color: string } => {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const fileName = name.toLowerCase();

  // Special file names
  if (fileName === "package.json") return { icon: "📦", color: "text-green-500" };
  if (fileName === "tsconfig.json") return { icon: "⚙️", color: "text-blue-400" };
  if (fileName === ".gitignore") return { icon: "🔒", color: "text-gray-400" };
  if (fileName === "readme.md") return { icon: "📖", color: "text-blue-300" };
  if (fileName.includes(".config.")) return { icon: "⚙️", color: "text-gray-400" };

  // By extension
  switch (ext) {
    case "tsx":
      return { icon: "⚛", color: "text-cyan-400" };
    case "ts":
      return { icon: "TS", color: "text-blue-500" };
    case "jsx":
      return { icon: "⚛", color: "text-cyan-300" };
    case "js":
      return { icon: "JS", color: "text-yellow-400" };
    case "css":
      return { icon: "🎨", color: "text-purple-400" };
    case "scss":
    case "sass":
      return { icon: "🎨", color: "text-pink-400" };
    case "json":
      return { icon: "{}", color: "text-yellow-300" };
    case "md":
    case "mdx":
      return { icon: "📝", color: "text-blue-300" };
    case "html":
      return { icon: "🌐", color: "text-orange-500" };
    case "svg":
      return { icon: "🖼", color: "text-yellow-400" };
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
      return { icon: "🖼", color: "text-green-400" };
    case "env":
      return { icon: "🔐", color: "text-yellow-500" };
    default:
      return { icon: "📄", color: "text-gray-400" };
  }
};

const sortNodes = (nodes: TreeNode[]) =>
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

const buildTree = (files: Record<string, string>) => {
  const root: TreeNode = { name: "", path: "", type: "folder", children: [] };
  const map = new Map<string, TreeNode>([["", root]]);

  for (const rawPath of Object.keys(files || {})) {
    if (!rawPath || typeof rawPath !== "string") continue;
    const normalized = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
    const parts = normalized.split("/").filter(Boolean);
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath += `/${part}`;
      const isFile = i === parts.length - 1;

      if (!map.has(currentPath)) {
        const node: TreeNode = {
          name: part,
          path: currentPath,
          type: isFile ? "file" : "folder",
          children: isFile ? undefined : [],
        };
        map.set(currentPath, node);

        const parentPath = currentPath.slice(0, currentPath.lastIndexOf("/"));
        const parent = map.get(parentPath === "" ? "" : parentPath);
        if (parent?.children) parent.children.push(node);
      }
    }
  }

  for (const node of map.values()) {
    if (node.children) sortNodes(node.children);
  }

  return root;
};

// Chevron icon component
const ChevronIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg
    className={cn(
      "h-3 w-3 shrink-0 transition-transform duration-150",
      isOpen ? "rotate-90" : "rotate-0"
    )}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

// Folder icon component
const FolderIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg
    className={cn("h-4 w-4 shrink-0", isOpen ? "text-yellow-400" : "text-yellow-500")}
    fill="currentColor"
    viewBox="0 0 20 20"
  >
    {isOpen ? (
      <path
        fillRule="evenodd"
        d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H3a2 2 0 00-2 2v5a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2H9.414l-2-2H4a2 2 0 00-2 2v8z"
        clipRule="evenodd"
      />
    ) : (
      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    )}
  </svg>
);

// Loading spinner
const LoadingSpinner = () => (
  <svg className="h-3.5 w-3.5 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

export function FileTree({
  files,
  selectedFile,
  onFileSelect,
  generatingFile,
  className,
}: {
  files: Record<string, string>;
  selectedFile: string | null;
  onFileSelect: (path: string) => void;
  generatingFile?: string | null;
  className?: string;
}) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set(defaultExpanded),
  );

  const toggleFolder = (folder: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  };

  const tree = useMemo(() => buildTree(files), [files]);

  const renderNode = (node: TreeNode, depth: number) => {
    if (node.type === "folder") {
      const isOpen = expandedFolders.has(node.path);
      const hasChildren = node.children && node.children.length > 0;

      return (
        <div key={node.path}>
          <button
            type="button"
            onClick={() => toggleFolder(node.path)}
            className={cn(
              "group flex w-full items-center gap-1.5 py-[3px] text-[13px] text-muted-foreground/90 transition-colors",
              "hover:bg-accent/50 hover:text-foreground",
              "focus:outline-none focus:bg-accent/50",
            )}
            style={{ paddingLeft: 8 + depth * 12 }}
          >
            <ChevronIcon isOpen={isOpen} />
            <FolderIcon isOpen={isOpen} />
            <span className="truncate">{node.name}</span>
          </button>
          {isOpen && hasChildren && (
            <div className="relative">
              {/* Indent guide line */}
              <div
                className="absolute left-0 top-0 bottom-0 w-px bg-border/40"
                style={{ marginLeft: 14 + depth * 12 }}
              />
              {node.children?.map((child) => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    const isSelected = selectedFile === node.path;
    const isGenerating = generatingFile === node.path;
    const { icon, color } = getFileIcon(node.name);

    return (
      <button
        key={node.path}
        type="button"
        onClick={() => onFileSelect(node.path)}
        className={cn(
          "group flex w-full items-center gap-2 py-[3px] text-[13px] transition-colors",
          "focus:outline-none",
          isSelected
            ? "bg-accent text-foreground"
            : "text-muted-foreground/80 hover:bg-accent/40 hover:text-foreground",
        )}
        style={{ paddingLeft: 20 + depth * 12 }}
      >
        {isGenerating ? (
          <LoadingSpinner />
        ) : (
          <span className={cn("text-xs shrink-0 w-4 text-center", color)}>
            {icon}
          </span>
        )}
        <span className={cn(
          "truncate font-mono text-[12px]",
          isSelected && "font-medium"
        )}>
          {node.name}
        </span>
      </button>
    );
  };

  const fileCount = Object.keys(files || {}).length;

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-background/50",
        className,
      )}
    >
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-border/50 bg-muted/30">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Explorer
        </span>
        <span className="text-[10px] text-muted-foreground/60">
          {fileCount} file{fileCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        {tree.children?.map((child) => renderNode(child, 0))}
      </div>
    </div>
  );
}
