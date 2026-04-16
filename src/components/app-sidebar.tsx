import * as React from "react";
import {
  IconFile,
  IconChevronRight,
  IconFolder,
  IconFolderOpen,
  IconFolderPlus,
  IconRotateClockwise,
  IconX,
} from "@tabler/icons-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarRail,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { FileNode } from "@/hooks/useFileTree";
import { sanitizePath } from "@/hooks/useFileTree";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  status: "empty" | "prompt" | "ready";
  dirName: string | null;
  nodes: FileNode[];
  expanded: Set<string>;
  selectedPath: string | null;
  onOpenDirectory: () => void;
  onRestoreAccess: () => void;
  onCloseDirectory: () => void;
  onToggle: (node: FileNode) => void;
  onSelect: (node: FileNode) => void;
}

export function AppSidebar({
  status,
  dirName,
  nodes,
  expanded,
  selectedPath,
  onOpenDirectory,
  onRestoreAccess,
  onCloseDirectory,
  onToggle,
  onSelect,
  ...props
}: AppSidebarProps) {
  const hasTree = status === "ready" && nodes.length > 0;

  return (
    <Sidebar
      data-testid="div-sidebar-container"
      data-test-state={hasTree ? "loaded" : "empty"}
      {...props}
    >
      {hasTree && (
        <SidebarHeader className="flex-row items-center justify-between gap-2 px-3 py-2">
          <span
            data-testid="span-sidebar-dirname"
            className="truncate text-sm font-semibold"
          >
            {dirName}
          </span>
          <Button
            data-testid="btn-sidebar-close"
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={onCloseDirectory}
            aria-label="Close directory"
          >
            <IconX />
          </Button>
        </SidebarHeader>
      )}
      <SidebarContent>
        {hasTree ? (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {nodes.map((node) => (
                  <TreeNode
                    key={node.path}
                    node={node}
                    expanded={expanded}
                    selectedPath={selectedPath}
                    onToggle={onToggle}
                    onSelect={onSelect}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
            <IconFolderOpen className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Open a local directory to browse files
            </p>
            <Button
              data-testid="btn-sidebar-open"
              onClick={onOpenDirectory}
              className="gap-2"
            >
              <IconFolderPlus />
              Open Directory
            </Button>
            {status === "prompt" && (
              <Button
                data-testid="btn-sidebar-restore"
                variant="outline"
                onClick={onRestoreAccess}
                className="gap-2"
              >
                <IconRotateClockwise />
                Restore Access
              </Button>
            )}
          </div>
        )}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}

interface TreeNodeProps {
  node: FileNode;
  expanded: Set<string>;
  selectedPath: string | null;
  onToggle: (node: FileNode) => void;
  onSelect: (node: FileNode) => void;
}

function TreeNode({
  node,
  expanded,
  selectedPath,
  onToggle,
  onSelect,
}: TreeNodeProps) {
  const isExpanded = expanded.has(node.path);
  const isSelected = selectedPath === node.path;
  const testId = `div-tree-${sanitizePath(node.path)}`;

  if (node.kind === "directory") {
    return (
      <SidebarMenuItem data-testid={testId}>
        <Collapsible
          open={isExpanded}
          onOpenChange={() => onToggle(node)}
          className="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
        >
          <SidebarMenuButton
            data-testid={`btn-tree-toggle-${sanitizePath(node.path)}`}
            isActive={isSelected}
            render={<CollapsibleTrigger />}
          >
            <IconChevronRight className="transition-transform" />
            {isExpanded ? <IconFolderOpen /> : <IconFolder />}
            <span className="truncate">{node.name}</span>
          </SidebarMenuButton>
          <CollapsibleContent>
            <SidebarMenuSub>
              {node.children?.map((child) => (
                <TreeNode
                  key={child.path}
                  node={child}
                  expanded={expanded}
                  selectedPath={selectedPath}
                  onToggle={onToggle}
                  onSelect={onSelect}
                />
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </Collapsible>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem data-testid={testId}>
      <SidebarMenuButton
        isActive={isSelected}
        onClick={() => onSelect(node)}
        className={cn(isSelected && "font-medium")}
      >
        <IconFile />
        <span className="truncate">{node.name}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
