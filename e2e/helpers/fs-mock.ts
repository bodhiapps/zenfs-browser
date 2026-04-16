import type { Page } from "@playwright/test";

/**
 * Injects a mock File System Access API into the page before it loads.
 * Must be called before page.goto().
 */
export async function installFsMock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const root = {
      kind: "directory",
      name: "test-project",
      children: {
        src: {
          kind: "directory",
          name: "src",
          children: {
            "index.ts": {
              kind: "file",
              name: "index.ts",
              content: "console.log('hello world');\n",
              type: "text/plain",
            },
            "utils.ts": {
              kind: "file",
              name: "utils.ts",
              content:
                "export function add(a: number, b: number) {\n  return a + b;\n}\n",
              type: "text/plain",
            },
          },
        },
        docs: {
          kind: "directory",
          name: "docs",
          children: {
            "guide.md": {
              kind: "file",
              name: "guide.md",
              content: "# Getting Started\n\nWelcome to the guide.\n",
              type: "text/plain",
            },
          },
        },
        "README.md": {
          kind: "file",
          name: "README.md",
          content: "# Test Project\n\nA sample project for testing.\n",
          type: "text/plain",
        },
        "image.png": {
          kind: "file",
          name: "image.png",
          content: "\x89PNG\r\n",
          type: "image/png",
        },
        "package.json": {
          kind: "file",
          name: "package.json",
          content: '{\n  "name": "test-project"\n}\n',
          type: "application/json",
        },
      },
    };

    function createFileHandle(vfile: any): any {
      return {
        kind: "file",
        name: vfile.name,
        isSameEntry: async () => false,
        queryPermission: async () => "granted",
        requestPermission: async () => "granted",
        getFile: async () =>
          new File([vfile.content], vfile.name, { type: vfile.type }),
        createWritable: async () => {
          throw new DOMException("Not allowed", "NotAllowedError");
        },
      };
    }

    function createDirHandle(vdir: any): any {
      const childEntries = Object.entries(vdir.children);

      return {
        kind: "directory",
        name: vdir.name,
        isSameEntry: async () => false,
        queryPermission: async () => "granted",
        requestPermission: async () => "granted",
        resolve: async () => null,
        getDirectoryHandle: async (name: string) => {
          const child = vdir.children[name];
          if (!child || child.kind !== "directory")
            throw new DOMException("Not found", "NotFoundError");
          return createDirHandle(child);
        },
        getFileHandle: async (name: string) => {
          const child = vdir.children[name];
          if (!child || child.kind !== "file")
            throw new DOMException("Not found", "NotFoundError");
          return createFileHandle(child);
        },
        removeEntry: async () => {
          throw new DOMException("Not allowed", "NotAllowedError");
        },
        entries: () => {
          let idx = 0;
          return {
            [Symbol.asyncIterator]() {
              return this;
            },
            async next() {
              if (idx >= childEntries.length) {
                return { done: true, value: undefined };
              }
              const [name, child] = childEntries[idx++] as [string, any];
              const childHandle =
                child.kind === "file"
                  ? createFileHandle(child)
                  : createDirHandle(child);
              return { done: false, value: [name, childHandle] };
            },
          };
        },
        keys: () => {
          let idx = 0;
          const names = Object.keys(vdir.children);
          return {
            [Symbol.asyncIterator]() {
              return this;
            },
            async next() {
              if (idx >= names.length)
                return { done: true, value: undefined };
              return { done: false, value: names[idx++] };
            },
          };
        },
        values: () => {
          let idx = 0;
          return {
            [Symbol.asyncIterator]() {
              return this;
            },
            async next() {
              if (idx >= childEntries.length)
                return { done: true, value: undefined };
              const [, child] = childEntries[idx++] as [string, any];
              const childHandle =
                child.kind === "file"
                  ? createFileHandle(child)
                  : createDirHandle(child);
              return { done: false, value: childHandle };
            },
          };
        },
      };
    }

    const mockRoot = createDirHandle(root);

    Object.defineProperty(window, "showDirectoryPicker", {
      value: async () => mockRoot,
      writable: true,
      configurable: true,
    });
  });
}
