"use client";

import React, { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { FileIcon, FolderIcon as Folder, FolderOpen, ChevronRight, Hash, FileJson, FileCode2, Image as ImageIcon, FileText } from "lucide-react";

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

// Modern file icons using Lucide
const getFileIcon = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const fileName = name.toLowerCase();

  if (fileName === "package.json") return <FileJson className="h-4 w-4 text-yellow-500" />;
  if (fileName === "tsconfig.json") return <FileJson className="h-4 w-4 text-blue-400" />;
  if (fileName === ".gitignore") return <FileText className="h-4 w-4 text-orange-400" />;
  if (fileName === "readme.md") return <FileText className="h-4 w-4 text-blue-300" />;

  switch (ext) {
    case "tsx":
    case "jsx":
      return <FileCode2 className="h-4 w-4 text-cyan-400" />;
    case "ts":
    case "js":
      return <FileCode2 className="h-4 w-4 text-blue-500" />;
    case "css":
    case "scss":
      return <Hash className="h-4 w-4 text-purple-400" />;
    case "json":
      return <FileJson className="h-4 w-4 text-yellow-300" />;
    case "md":
      return <FileText className="h-4 w-4 text-blue-300" />;
    case "png":
    case "jpg":
    case "jpeg":
    case "svg":
    case "webp":
      return <ImageIcon className="h-4 w-4 text-emerald-400" />;
    default:
      return <FileIcon className="h-4 w-4 text-muted-foreground/60" />;
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

// Loading spinner
const LoadingSpinner = () => (
  <div className="flex items-center justify-center w-4 h-4">
    <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
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
              "group flex w-full items-center gap-2 py-1.5 text-xs text-muted-foreground transition-all duration-200",
              "hover:bg-primary/5 hover:text-foreground",
              "focus:outline-none",
            )}
            style={{ paddingLeft: 12 + depth * 12 }}
          >
            <ChevronRight className={cn(
              "h-3.5 w-3.5 shrink-0 transition-transform duration-200 text-muted-foreground/40 group-hover:text-muted-foreground",
              isOpen && "rotate-90"
            )} />
            {isOpen ? (
              <FolderOpen className="h-4 w-4 shrink-0 text-amber-400/80" />
            ) : (
              <Folder className="h-4 w-4 shrink-0 text-amber-500/70" />
            )}
            <span className="truncate font-medium">{node.name}</span>
          </button>
          {isOpen && hasChildren && (
            <div className="relative">
              {/* Indent guide line */}
              <div
                className="absolute left-[19px] top-0 bottom-0 w-[1px] bg-border/40"
                style={{ left: 19 + depth * 12 }}
              />
              {node.children?.map((child) => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    const isSelected = selectedFile === node.path;
    const isGenerating = generatingFile === node.path;

    return (
      <button
        key={node.path}
        type="button"
        onClick={() => onFileSelect(node.path)}
        className={cn(
          "group flex w-full items-center gap-2.5 py-1.5 text-xs transition-all duration-200",
          "focus:outline-none",
          isSelected
            ? "bg-primary/10 text-primary border-r-2 border-primary"
            : "text-muted-foreground/80 hover:bg-primary/5 hover:text-foreground",
        )}
        style={{ paddingLeft: 28 + depth * 12 }}
      >
        <div className="flex-shrink-0">
          {isGenerating ? <LoadingSpinner /> : getFileIcon(node.name)}
        </div>
        <span className={cn(
          "truncate font-mono",
          isSelected && "font-bold"
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
        "flex flex-col h-full bg-background/50 backdrop-blur-sm",
        className,
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-border/60 bg-muted/20">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-foreground/70">
            Explorer
          </span>
        </div>
        <div className="bg-background/50 px-1.5 py-0.5 rounded-md border border-border/40 shadow-sm">
          <span className="text-[10px] font-bold text-primary/80">
            {fileCount}
          </span>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 scroll-smooth no-scrollbar">
        {tree.children?.map((child) => renderNode(child, 0))}
      </div>
    </div>
  );
}
