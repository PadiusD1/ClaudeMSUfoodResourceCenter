import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import DashboardPage from "@/pages/dashboard";
import InventoryPage from "@/pages/inventory";
import CheckInPage from "@/pages/check-in";
import CheckOutPage from "@/pages/check-out";
import ClientsPage from "@/pages/clients";
import ClientDetailPage from "@/pages/client-detail";
import ReportsPage from "@/pages/reports";
import ActivityPage from "@/pages/activity";
import { AppShell } from "@/components/layout/AppShell";
import { RepositoryProvider } from "@/lib/repository";

function Router() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/inventory" component={InventoryPage} />
      <Route path="/check-in" component={CheckInPage} />
      <Route path="/check-out" component={CheckOutPage} />
      <Route path="/clients" component={ClientsPage} />
      <Route path="/clients/:id" component={ClientDetailPage} />
      <Route path="/reports" component={ReportsPage} />
      <Route path="/activity" component={ActivityPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RepositoryProvider>
          <Toaster />
          <AppShell>
            <Router />
          </AppShell>
        </RepositoryProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
