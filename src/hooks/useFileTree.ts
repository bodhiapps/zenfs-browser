import { useState, useCallback, useEffect, useRef } from "react";

export interface FileNode {
  name: string;
  kind: "file" | "directory";
  handle: FileSystemFileHandle | FileSystemDirectoryHandle;
  path: string;
  children?: FileNode[];
  loaded?: boolean;
}

const TEXT_EXTENSIONS = new Set([
  ".txt", ".md", ".json", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".css", ".scss", ".less", ".html", ".htm", ".xml", ".svg",
  ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf",
  ".env", ".env.local", ".env.development", ".env.production",
  ".sh", ".bash", ".zsh", ".fish",
  ".py", ".rb", ".rs", ".go", ".java", ".kt", ".c", ".cpp", ".h", ".hpp",
  ".cs", ".swift", ".php", ".lua", ".r", ".sql",
  ".graphql", ".gql", ".proto",
  ".gitignore", ".dockerignore", ".editorconfig",
  ".lock", ".log",
]);

const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown", ".mdx"]);

const EXTENSIONLESS_TEXT_FILES = new Set([
  "Makefile", "Dockerfile", "Containerfile", "Procfile",
  "LICENSE", "LICENCE", "README", "CHANGELOG",
  ".gitignore", ".gitattributes", ".npmrc", ".nvmrc",
  ".prettierrc", ".eslintrc", ".babelrc",
]);

export function isTextFile(name: string): boolean {
  if (EXTENSIONLESS_TEXT_FILES.has(name)) return true;
  const dotIdx = name.lastIndexOf(".");
  if (dotIdx === -1) return false;
  return TEXT_EXTENSIONS.has(name.slice(dotIdx).toLowerCase());
}

export function isMarkdownFile(name: string): boolean {
  const dotIdx = name.lastIndexOf(".");
  if (dotIdx === -1) return false;
  return MARKDOWN_EXTENSIONS.has(name.slice(dotIdx).toLowerCase());
}

export function sanitizePath(path: string): string {
  return path.replace(/[^a-zA-Z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

async function readDirEntries(
  dirHandle: FileSystemDirectoryHandle,
  parentPath: string,
): Promise<FileNode[]> {
  const entries: FileNode[] = [];
  for await (const [name, handle] of dirHandle.entries()) {
    entries.push({
      name,
      kind: handle.kind,
      handle,
      path: parentPath ? `${parentPath}/${name}` : name,
      children: handle.kind === "directory" ? [] : undefined,
      loaded: handle.kind === "directory" ? false : undefined,
    });
  }
  return sortNodes(entries);
}

function sortNodes(nodes: FileNode[]): FileNode[] {
  return nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

export type ViewerState =
  | "empty"
  | "loading"
  | "loaded"
  | "editor"
  | "unsupported";

export type SaveState = "idle" | "saving" | "saved" | "error";

interface TreeState {
  nodes: FileNode[];
  expanded: Set<string>;
  selectedPath: string | null;
  selectedNode: FileNode | null;
  fileContent: string | null;
  viewerState: ViewerState;
  saveState: SaveState;
}

const EMPTY_SET = new Set<string>();

const EMPTY_STATE: TreeState = {
  nodes: [],
  expanded: EMPTY_SET,
  selectedPath: null,
  selectedNode: null,
  fileContent: null,
  viewerState: "empty",
  saveState: "idle",
};

export function useFileTree(handle: FileSystemDirectoryHandle | null) {
  const [state, setState] = useState<TreeState>(EMPTY_STATE);
  const selectedNodeRef = useRef<FileNode | null>(null);

  useEffect(() => {
    selectedNodeRef.current = state.selectedNode;
  }, [state.selectedNode]);

  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    readDirEntries(handle, "").then((root) => {
      if (!cancelled) {
        setState({ ...EMPTY_STATE, nodes: root });
      }
    });
    return () => { cancelled = true; };
  }, [handle]);

  const toggleExpand = useCallback(
    async (node: FileNode) => {
      if (node.kind !== "directory") return;

      setState((prev) => {
        const isExpanded = prev.expanded.has(node.path);
        if (isExpanded) {
          const next = new Set(prev.expanded);
          next.delete(node.path);
          return { ...prev, expanded: next };
        }
        return prev;
      });

      const isCurrentlyExpanded = state.expanded.has(node.path);
      if (isCurrentlyExpanded) return;

      if (!node.loaded) {
        const children = await readDirEntries(
          node.handle as FileSystemDirectoryHandle,
          node.path,
        );
        setState((prev) => ({
          ...prev,
          nodes: updateNodeChildren(prev.nodes, node.path, children),
        }));
      }

      setState((prev) => ({
        ...prev,
        expanded: new Set(prev.expanded).add(node.path),
      }));
    },
    [state.expanded],
  );

  const selectFile = useCallback(async (node: FileNode) => {
    if (node.kind === "directory") {
      setState((prev) => ({
        ...prev,
        selectedPath: node.path,
        selectedNode: node,
        viewerState: "empty",
        fileContent: null,
        saveState: "idle",
      }));
      return;
    }

    if (!isTextFile(node.name)) {
      setState((prev) => ({
        ...prev,
        selectedPath: node.path,
        selectedNode: node,
        viewerState: "unsupported",
        fileContent: null,
        saveState: "idle",
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      selectedPath: node.path,
      selectedNode: node,
      viewerState: "loading",
      fileContent: null,
      saveState: "idle",
    }));

    try {
      const file = await (node.handle as FileSystemFileHandle).getFile();
      const text = await file.text();
      const nextViewerState: ViewerState = isMarkdownFile(node.name)
        ? "editor"
        : "loaded";
      setState((prev) => ({
        ...prev,
        fileContent: text,
        viewerState: nextViewerState,
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        viewerState: "unsupported",
        fileContent: null,
      }));
    }
  }, []);

  const saveFile = useCallback(async (content: string) => {
    const node = selectedNodeRef.current;
    if (!node || node.kind !== "file") return;
    const fileHandle = node.handle as FileSystemFileHandle;
    setState((prev) => ({ ...prev, saveState: "saving" }));
    try {
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      setState((prev) =>
        prev.selectedNode?.path === node.path
          ? { ...prev, saveState: "saved" }
          : prev,
      );
    } catch {
      setState((prev) =>
        prev.selectedNode?.path === node.path
          ? { ...prev, saveState: "error" }
          : prev,
      );
    }
  }, []);

  if (!handle) {
    return {
      ...EMPTY_STATE,
      toggleExpand,
      selectFile,
      saveFile,
    };
  }

  return {
    nodes: state.nodes,
    expanded: state.expanded,
    selectedPath: state.selectedPath,
    selectedNode: state.selectedNode,
    fileContent: state.fileContent,
    viewerState: state.viewerState,
    saveState: state.saveState,
    toggleExpand,
    selectFile,
    saveFile,
  };
}

function updateNodeChildren(
  nodes: FileNode[],
  targetPath: string,
  children: FileNode[],
): FileNode[] {
  return nodes.map((node) => {
    if (node.path === targetPath) {
      return { ...node, children, loaded: true };
    }
    if (node.children && targetPath.startsWith(node.path + "/")) {
      return {
        ...node,
        children: updateNodeChildren(node.children, targetPath, children),
      };
    }
    return node;
  });
}
