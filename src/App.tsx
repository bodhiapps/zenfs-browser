import { Fragment } from "react";
import { BodhiProvider } from "@bodhiapp/bodhi-js-react";
import { AppSidebar } from "@/components/app-sidebar";
import { FileViewer } from "@/components/FileViewer";
import AuthBar from "@/components/chat/AuthBar";
import ChatColumn from "@/components/chat/ChatColumn";
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
import { Toaster } from "@/components/ui/sonner";
import { useDirectoryHandle } from "@/hooks/useDirectoryHandle";
import { useFileTree } from "@/hooks/useFileTree";
import { AUTH_CLIENT_ID, AUTH_SERVER_URL } from "@/env";

const BASE_PATH = import.meta.env.BASE_URL;

function AppContent() {
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
    saveState,
    toggleExpand,
    selectFile,
    saveFile,
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
          <div className="ml-auto">
            <AuthBar />
          </div>
        </header>
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <FileViewer
            viewerState={viewerState}
            selectedNode={selectedNode}
            fileContent={fileContent}
            saveState={saveState}
            onSave={saveFile}
          />
          <ChatColumn className="w-[380px] shrink-0 border-l" />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function App() {
  return (
    <BodhiProvider
      authClientId={AUTH_CLIENT_ID}
      clientConfig={{
        ...(AUTH_SERVER_URL && { authServerUrl: AUTH_SERVER_URL }),
      }}
      basePath={BASE_PATH}
    >
      <AppContent />
      <Toaster />
    </BodhiProvider>
  );
}

export default App;
