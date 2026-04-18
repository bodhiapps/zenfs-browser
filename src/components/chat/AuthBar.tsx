import { useBodhi, LoginOptionsBuilder } from "@bodhiapp/bodhi-js-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export default function AuthBar() {
  const {
    isServerReady,
    isOverallReady,
    auth,
    isAuthenticated,
    isAuthLoading,
    login,
    logout,
    showSetup,
  } = useBodhi();

  const handleLogin = async () => {
    const loginOptions = new LoginOptionsBuilder()
      .setFlowType("redirect")
      .setRole("scope_user_user")
      .build();
    const authState = await login(loginOptions);
    if (authState?.status === "error" && authState.error) {
      toast.error(authState.error.message);
    }
  };

  return (
    <div className="flex items-center gap-3" data-testid="div-auth-bar">
      <div
        className="flex items-center gap-1.5"
        title={`Bodhi server ${isServerReady ? "ready" : "not ready"}`}
      >
        <span
          data-testid="badge-server-status"
          data-teststate={isServerReady ? "ready" : "not-ready"}
          className={cn(
            "inline-block size-2 rounded-full",
            isServerReady ? "bg-green-500" : "bg-red-500",
          )}
        />
        <span className="text-xs text-muted-foreground">Server</span>
      </div>
      <section
        data-testid="section-auth"
        data-teststate={isAuthenticated ? "authenticated" : "unauthenticated"}
      >
        {!isOverallReady ? (
          <Button
            data-testid="btn-setup-bodhi"
            onClick={showSetup}
            size="sm"
          >
            Setup Bodhi
          </Button>
        ) : isAuthenticated ? (
          <div className="flex items-center gap-2">
            <span
              data-testid="span-auth-name"
              className="text-xs text-muted-foreground max-w-[140px] truncate"
              title={auth.user?.email}
            >
              {auth.user?.name || auth.user?.email || "User"}
            </span>
            <Button
              data-testid="btn-auth-logout"
              onClick={logout}
              variant="ghost"
              size="sm"
            >
              Logout
            </Button>
          </div>
        ) : (
          <Button
            data-testid="btn-auth-login"
            onClick={handleLogin}
            disabled={isAuthLoading}
            size="sm"
          >
            {isAuthLoading ? <Spinner /> : "Login"}
          </Button>
        )}
      </section>
    </div>
  );
}
