import { Fragment } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { FileViewer } from "@/components/FileViewer";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useDirectoryHandle } from "@/hooks/useDirectoryHandle";
import { useFileTree } from "@/hooks/useFileTree";

function App() {
  const {
    status,
    handle,
    restoring,
    openDirectory,
    restoreAccess,
    closeDirectory,
  } = useDirectoryHandle();

  const {
    nodes,
    expanded,
    selectedPath,
    selectedNode,
    fileContent,
    viewerState,
    toggleExpand,
    selectFile,
  } = useFileTree(handle);

  if (restoring) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        <p className="text-sm">Restoring session...</p>
      </div>
    );
  }

  const rootDirName = handle?.name ?? null;
  const pathSegments = selectedNode
    ? ([rootDirName, ...selectedNode.path.split("/")].filter(
        Boolean,
      ) as string[])
    : [];

  return (
    <SidebarProvider
      style={{ height: "100svh" }}
      className="overflow-hidden"
    >
      <AppSidebar
        status={status}
        dirName={rootDirName}
        nodes={nodes}
        expanded={expanded}
        selectedPath={selectedPath}
        onOpenDirectory={openDirectory}
        onRestoreAccess={restoreAccess}
        onCloseDirectory={closeDirectory}
        onToggle={toggleExpand}
        onSelect={selectFile}
      />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <SidebarTrigger className="-ml-1" />
          {selectedNode && (
            <>
              <Separator
                orientation="vertical"
                className="mr-1 data-[orientation=vertical]:h-4"
              />
              <Breadcrumb data-testid="nav-viewer-breadcrumb">
                <BreadcrumbList>
                  {pathSegments.map((segment, i) => (
                    <Fragment key={i}>
                      {i > 0 && <BreadcrumbSeparator />}
                      <BreadcrumbItem>
                        {i === pathSegments.length - 1 ? (
                          <BreadcrumbPage>{segment}</BreadcrumbPage>
                        ) : (
                          <span className="text-muted-foreground">
                            {segment}
                          </span>
                        )}
                      </BreadcrumbItem>
                    </Fragment>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
            </>
          )}
        </header>
        <FileViewer
          viewerState={viewerState}
          selectedNode={selectedNode}
          fileContent={fileContent}
        />
      </SidebarInset>
    </SidebarProvider>
  );
}

export default App;
