"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import {
  FileIcon,
  FolderIcon as Folder,
  FolderOpen,
  ChevronRight,
  Hash,
  FileJson,
  FileCode2,
  Image as ImageIcon,
  FileText,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Clipboard,
  FolderPlus,
  FilePlus,
  Search,
} from "lucide-react";
import { useTheme } from "next-themes";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  // Special files - VS Code colors
  if (fileName === "package.json")
    return <FileJson className="h-4 w-4 text-[#e8ab53]" />;
  if (fileName === "tsconfig.json")
    return <FileJson className="h-4 w-4 text-[#519aba]" />;
  if (fileName === "vite.config.ts")
    return <FileCode2 className="h-4 w-4 text-[#41b883]" />;
  if (fileName === ".gitignore")
    return <FileText className="h-4 w-4 text-[#f05032]" />;
  if (fileName === "readme.md")
    return <FileText className="h-4 w-4 text-[#519aba]" />;
  if (fileName === "index.html")
    return <FileCode2 className="h-4 w-4 text-[#e44d26]" />;

  switch (ext) {
    case "tsx":
      return <FileCode2 className="h-4 w-4 text-[#519aba]" />;
    case "jsx":
      return <FileCode2 className="h-4 w-4 text-[#61dafb]" />;
    case "ts":
      return <FileCode2 className="h-4 w-4 text-[#519aba]" />;
    case "js":
      return <FileCode2 className="h-4 w-4 text-[#cbcb41]" />;
    case "css":
      return <Hash className="h-4 w-4 text-[#519aba]" />;
    case "scss":
      return <Hash className="h-4 w-4 text-[#c6538c]" />;
    case "html":
      return <FileCode2 className="h-4 w-4 text-[#e44d26]" />;
    case "json":
      return <FileJson className="h-4 w-4 text-[#cbcb41]" />;
    case "md":
      return <FileText className="h-4 w-4 text-[#519aba]" />;
    case "png":
    case "jpg":
    case "jpeg":
    case "svg":
    case "webp":
      return <ImageIcon className="h-4 w-4 text-[#a074c4]" />;
    default:
      return <FileIcon className="h-4 w-4 text-[#858585]" />;
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
  onFileAdd,
  onFileRename,
  onFileDelete,
  onFileCopy,
  onFilePaste,
}: {
  files: Record<string, string>;
  selectedFile: string | null;
  onFileSelect: (path: string) => void;
  generatingFile?: string | null;
  className?: string;
  onFileAdd?: (path: string, isFolder: boolean) => void;
  onFileRename?: (oldPath: string, newPath: string) => void;
  onFileDelete?: (path: string) => void;
  onFileCopy?: (path: string) => void;
  onFilePaste?: (targetPath: string) => void;
}) {
  const { theme, resolvedTheme } = useTheme();
  const isDark = theme === "dark" || resolvedTheme === "dark";
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set(defaultExpanded),
  );
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    path: string;
    isFolder: boolean;
  } | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Dialog states
  const [renameDialog, setRenameDialog] = useState<{
    open: boolean;
    path: string;
    currentName: string;
  }>({
    open: false,
    path: "",
    currentName: "",
  });
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    path: string;
  }>({
    open: false,
    path: "",
  });
  const [newFileName, setNewFileName] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenu(null);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextMenu(null);
      }
    };

    const handleScroll = () => {
      setContextMenu(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, []);

  const handleContextMenu = (
    e: React.MouseEvent,
    path: string,
    isFolder: boolean,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    // Calculate position with viewport boundary checks
    const menuWidth = 180;
    const menuHeight = 250; // Approximate max height

    let x = e.clientX;
    let y = e.clientY;

    // Keep menu within viewport
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }

    setContextMenu({ x, y, path, isFolder });
  };

  const toggleFolder = (folder: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  };

  const tree = useMemo(() => buildTree(files), [files]);
  const normalizedGeneratingFile = useMemo(() => {
    if (!generatingFile) return null;
    return generatingFile.startsWith("/")
      ? generatingFile
      : `/${generatingFile}`;
  }, [generatingFile]);

  const searchMatches = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return null;
    const matches = new Set<string>();
    const addAncestors = (path: string) => {
      const parts = path.split("/").filter(Boolean);
      let current = "";
      for (const part of parts) {
        current += `/${part}`;
        matches.add(current);
      }
    };
    for (const [rawPath, content] of Object.entries(files || {})) {
      const normalized = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
      const haystack = `${normalized} ${String(content || "")}`.toLowerCase();
      if (haystack.includes(query)) {
        matches.add(normalized);
        addAncestors(normalized);
      }
    }
    return matches;
  }, [files, searchQuery]);

  const renderNode = (node: TreeNode, depth: number) => {
    if (node.type === "folder") {
      if (searchMatches && !searchMatches.has(node.path)) {
        return null;
      }
      const isOpen = searchMatches ? true : expandedFolders.has(node.path);
      const hasChildren = node.children && node.children.length > 0;

      return (
        <div key={node.path}>
          <button
            type="button"
            onClick={() => toggleFolder(node.path)}
            onContextMenu={(e) => handleContextMenu(e, node.path, true)}
            className={cn(
              "group flex w-full items-center gap-1 py-[3px] text-[13px] transition-colors duration-100",
              isDark
                ? "text-[#cccccc] hover:bg-[#2a2d2e]"
                : "text-[#616161] hover:bg-[#e8e8e8]",
              "focus:outline-none",
            )}
            style={{ paddingLeft: 8 + depth * 16 }}
          >
            <ChevronRight
              className={cn(
                "h-3 w-3 shrink-0 transition-transform duration-150 text-[#cccccc]",
                isOpen && "rotate-90",
              )}
            />
            {isOpen ? (
              <FolderOpen className="h-4 w-4 shrink-0 text-[#dcb67a]" />
            ) : (
              <Folder className="h-4 w-4 shrink-0 text-[#dcb67a]" />
            )}
            <span className="truncate font-normal">{node.name}</span>
          </button>
          {isOpen && hasChildren && (
            <div className="relative">
              {node.children?.map((child) => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    if (searchMatches && !searchMatches.has(node.path)) {
      return null;
    }
    const isSelected = selectedFile === node.path;
    const isGenerating = normalizedGeneratingFile === node.path;

    return (
      <button
        key={node.path}
        type="button"
        onClick={() => onFileSelect(node.path)}
        onContextMenu={(e) => handleContextMenu(e, node.path, false)}
        className={cn(
          "group flex w-full items-center gap-2 py-[3px] text-[13px] transition-colors duration-100",
          "focus:outline-none",
          isSelected
            ? isDark
              ? "bg-[#37373d] text-[#ffffff]"
              : "bg-[#e8e8e8] text-[#000000]"
            : isDark
              ? "text-[#cccccc] hover:bg-[#2a2d2e]"
              : "text-[#616161] hover:bg-[#e8e8e8]",
        )}
        style={{ paddingLeft: 24 + depth * 16 }}
      >
        <div className="flex-shrink-0">
          {isGenerating ? <LoadingSpinner /> : getFileIcon(node.name)}
        </div>
        <span className="truncate font-normal">{node.name}</span>
      </button>
    );
  };

  const fileCount = Object.keys(files || {}).length;

  const bgColor = isDark ? "bg-[#1e1e1e]" : "bg-[#f3f3f3]";
  const borderColor = isDark ? "border-[#2d2d30]" : "border-[#e5e5e5]";
  const textColor = isDark ? "text-[#cccccc]" : "text-[#616161]";
  const scrollbarColor = isDark
    ? "scrollbar-thumb-[#424245]"
    : "scrollbar-thumb-[#c4c4c4]";

  return (
    <div className={cn("flex flex-col h-full relative", bgColor, className)}>
      {/* Header - VS Code style */}
      <div
        className={cn(
          "px-3 py-2 flex items-center justify-between border-b",
          borderColor,
        )}
      >
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-[11px] font-semibold uppercase tracking-wider",
              textColor,
            )}
          >
            Explorer
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className={cn(
              "p-1 rounded-sm transition-colors",
              isDark
                ? "hover:bg-[#2a2d2e] text-[#cccccc]"
                : "hover:bg-[#e8e8e8] text-[#616161]",
            )}
            onClick={() => onFileAdd?.("/components/newfile.tsx", false)}
            title="New File (in components folder)"
          >
            <FilePlus className="h-4 w-4" />
          </button>
          <button
            className={cn(
              "p-1 rounded-sm transition-colors",
              isDark
                ? "hover:bg-[#2a2d2e] text-[#cccccc]"
                : "hover:bg-[#e8e8e8] text-[#616161]",
            )}
            title="Search"
            onClick={() => setSearchOpen((prev) => !prev)}
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className={cn("px-3 py-2 border-b", borderColor)}>
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files or symbols..."
            className={cn(
              "h-8 text-xs bg-transparent",
              isDark
                ? "border-[#2d2d30] text-[#cccccc] placeholder:text-[#6b6b6b]"
                : "border-[#e5e5e5] text-[#2b2b2b] placeholder:text-[#9b9b9b]",
            )}
          />
        </div>
      )}

      {/* Tree */}
      <div
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden py-1 scroll-smooth scrollbar-thin scrollbar-track-transparent",
          scrollbarColor,
        )}
      >
        {tree.children?.map((child) => renderNode(child, 0))}
      </div>

      {/* Context Menu - Using Portal */}
      {mounted &&
        contextMenu &&
        createPortal(
          <div
            ref={contextMenuRef}
            className={cn(
              "fixed z-[9999] min-w-[180px] rounded-md shadow-xl border",
              isDark
                ? "bg-[#252526] border-[#454545]"
                : "bg-white border-[#e5e5e5]",
            )}
            style={{
              top: `${contextMenu.y}px`,
              left: `${contextMenu.x}px`,
              maxHeight: "300px",
              overflowY: "auto",
            }}
          >
            <div className="py-1">
              {contextMenu.isFolder &&
                onFileAdd &&
                contextMenu.path.startsWith("/components") && (
                  <>
                    <button
                      className={cn(
                        "w-full px-3 py-1.5 text-left text-[13px] flex items-center gap-2 transition-colors",
                        isDark
                          ? "hover:bg-[#2a2d2e] text-[#cccccc]"
                          : "hover:bg-[#e8e8e8] text-[#616161]",
                      )}
                      onClick={() => {
                        onFileAdd(contextMenu.path + "/newfile.tsx", false);
                        setContextMenu(null);
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      New File
                    </button>
                    <button
                      className={cn(
                        "w-full px-3 py-1.5 text-left text-[13px] flex items-center gap-2 transition-colors",
                        isDark
                          ? "hover:bg-[#2a2d2e] text-[#cccccc]"
                          : "hover:bg-[#e8e8e8] text-[#616161]",
                      )}
                      onClick={() => {
                        onFileAdd(contextMenu.path + "/newfolder", true);
                        setContextMenu(null);
                      }}
                    >
                      <FolderPlus className="h-3.5 w-3.5" />
                      New Folder
                    </button>
                    <div
                      className={cn(
                        "h-[1px] my-1",
                        isDark ? "bg-[#454545]" : "bg-[#e5e5e5]",
                      )}
                    />
                  </>
                )}
              {onFileRename && (
                <button
                  className={cn(
                    "w-full px-3 py-1.5 text-left text-[13px] flex items-center gap-2 transition-colors",
                    isDark
                      ? "hover:bg-[#2a2d2e] text-[#cccccc]"
                      : "hover:bg-[#e8e8e8] text-[#616161]",
                  )}
                  onClick={() => {
                    setRenameDialog({
                      open: true,
                      path: contextMenu.path,
                      currentName: contextMenu.path.split("/").pop() || "",
                    });
                    setNewFileName(contextMenu.path.split("/").pop() || "");
                    setContextMenu(null);
                  }}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Rename
                </button>
              )}
              {onFileCopy && (
                <button
                  className={cn(
                    "w-full px-3 py-1.5 text-left text-[13px] flex items-center gap-2 transition-colors",
                    isDark
                      ? "hover:bg-[#2a2d2e] text-[#cccccc]"
                      : "hover:bg-[#e8e8e8] text-[#616161]",
                  )}
                  onClick={() => {
                    onFileCopy(contextMenu.path);
                    setCopiedPath(contextMenu.path);
                    setContextMenu(null);
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </button>
              )}
              {copiedPath && onFilePaste && contextMenu.isFolder && (
                <button
                  className={cn(
                    "w-full px-3 py-1.5 text-left text-[13px] flex items-center gap-2 transition-colors",
                    isDark
                      ? "hover:bg-[#2a2d2e] text-[#cccccc]"
                      : "hover:bg-[#e8e8e8] text-[#616161]",
                  )}
                  onClick={() => {
                    onFilePaste(contextMenu.path);
                    setContextMenu(null);
                  }}
                >
                  <Clipboard className="h-3.5 w-3.5" />
                  Paste
                </button>
              )}
              {onFileDelete && (
                <>
                  <div
                    className={cn(
                      "h-[1px] my-1",
                      isDark ? "bg-[#454545]" : "bg-[#e5e5e5]",
                    )}
                  />
                  <button
                    className={cn(
                      "w-full px-3 py-1.5 text-left text-[13px] flex items-center gap-2 transition-colors",
                      isDark
                        ? "hover:bg-[#5a1d1d] text-[#f48771]"
                        : "hover:bg-[#ffeaea] text-[#d32f2f]",
                    )}
                    onClick={() => {
                      setDeleteDialog({
                        open: true,
                        path: contextMenu.path,
                      });
                      setContextMenu(null);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}

      {/* Rename Dialog */}
      <Dialog
        open={renameDialog.open}
        onOpenChange={(open) => setRenameDialog({ ...renameDialog, open })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
            <DialogDescription>
              Enter a new name for {renameDialog.currentName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="filename">File name</Label>
              <Input
                id="filename"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newFileName.trim()) {
                    const newPath = renameDialog.path.replace(
                      /[^/]+$/,
                      newFileName,
                    );
                    onFileRename?.(renameDialog.path, newPath);
                    setRenameDialog({ open: false, path: "", currentName: "" });
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setRenameDialog({ open: false, path: "", currentName: "" })
              }
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (newFileName.trim()) {
                  const newPath = renameDialog.path.replace(
                    /[^/]+$/,
                    newFileName,
                  );
                  onFileRename?.(renameDialog.path, newPath);
                  setRenameDialog({ open: false, path: "", currentName: "" });
                }
              }}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete File</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">{deleteDialog.path}</span>? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, path: "" })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onFileDelete?.(deleteDialog.path);
                setDeleteDialog({ open: false, path: "" });
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
