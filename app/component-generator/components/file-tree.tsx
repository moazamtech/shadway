"use client";

import React, { useState } from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileIcon,
  FolderIcon,
  Loader2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
    new Set(["/app", "/components", "/hooks", "/lib"]),
  );

  const toggleFolder = (folder: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  };

  const fileTree: Record<string, string[]> = {};
  const rootFiles: string[] = [];

  if (files && typeof files === "object") {
    Object.keys(files).forEach((path) => {
      if (!path || typeof path !== "string") return;
      const parts = path.split("/").filter(Boolean);
      if (parts.length === 1) rootFiles.push(path);
      else {
        const folder = `/${parts[0]}`;
        if (!fileTree[folder]) fileTree[folder] = [];
        fileTree[folder].push(path);
      }
    });
  }

  return (
    <div className={cn("text-sm", className)}>
      <div className="px-2 mb-2 text-xs font-semibold text-muted-foreground">
        PROJECT FILES
      </div>
      <div className="space-y-0.5">
        {rootFiles.map((file) => (
          <div
            key={file}
            onClick={() => onFileSelect(file)}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded-md cursor-pointer transition-colors",
              selectedFile === file && "bg-accent border-l-2 border-primary",
            )}
          >
            {generatingFile === file ? (
              <Loader2Icon className="h-4 w-4 text-primary animate-spin" />
            ) : (
              <FileIcon className="h-4 w-4 text-blue-500" />
            )}
            <span className="text-xs">{file.replace("/", "")}</span>
            {generatingFile === file && (
              <span className="ml-auto text-xs text-primary font-medium">
                Generating...
              </span>
            )}
          </div>
        ))}

        {Object.entries(fileTree).map(([folder, folderFiles]) => (
          <div key={folder}>
            <div
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded-md cursor-pointer"
              onClick={() => toggleFolder(folder)}
            >
              {expandedFolders.has(folder) ? (
                <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
              )}
              <FolderIcon className="h-4 w-4 text-yellow-500" />
              <span className="text-xs font-medium">
                {folder.replace("/", "")}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {folderFiles.length}
              </span>
            </div>

            {expandedFolders.has(folder) && (
              <div className="ml-6 space-y-0.5">
                {folderFiles.map((file) => (
                  <div
                    key={file}
                    onClick={() => onFileSelect(file)}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded-md cursor-pointer transition-colors",
                      selectedFile === file && "bg-accent border-l-2 border-primary",
                    )}
                  >
                    {generatingFile === file ? (
                      <Loader2Icon className="h-4 w-4 text-primary animate-spin" />
                    ) : (
                      <FileIcon className="h-4 w-4 text-blue-500" />
                    )}
                    <span className="text-xs">{file.split("/").pop()}</span>
                    {generatingFile === file && (
                      <span className="ml-auto text-xs text-primary font-medium">
                        Generating...
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
