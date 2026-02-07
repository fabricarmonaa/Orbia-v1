import { Switch, Route, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import NotFound from "@/pages/not-found";
import SuperLogin from "@/pages/super-login";
import TenantLogin from "@/pages/tenant-login";
import OwnerDashboard from "@/pages/owner/index";
import AppLayout from "@/pages/app/layout";
import PublicTracking from "@/pages/public-tracking";

function Router() {
  return (
    <Switch>
      <Route path="/">
        <Redirect to="/login" />
      </Route>
      <Route path="/login" component={TenantLogin} />
      <Route path="/owner/login" component={SuperLogin} />
      <Route path="/owner" component={OwnerDashboard} />
      <Route path="/app/:rest*" component={AppLayout} />
      <Route path="/app" component={AppLayout} />
      <Route path="/tracking/:id" component={PublicTracking} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <Toaster />
          <Router />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
