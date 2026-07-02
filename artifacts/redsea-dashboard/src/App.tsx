import { Switch, Route, Router as WouterRouter } from "wouter"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "@/components/ui/toaster"
import { TooltipProvider } from "@/components/ui/tooltip"
import NotFound from "@/pages/not-found"
import HomePage from "@/pages/HomePage"
import DashboardHome from "@/pages/DashboardHome"
import OverviewPage from "@/pages/OverviewPage"
import VesselsPage from "@/pages/VesselsPage"
import PortsPage from "@/pages/PortsPage"
import DocumentsPage from "@/pages/DocumentsPage"
import DashboardLayout from "@/components/DashboardLayout"

const queryClient = new QueryClient()

const withLayout = (Page: React.ComponentType) => () => (
  <DashboardLayout>
    <Page />
  </DashboardLayout>
)

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/dashboard" component={withLayout(DashboardHome)} />
      <Route path="/dashboard/overview" component={withLayout(OverviewPage)} />
      <Route path="/dashboard/vessels" component={withLayout(VesselsPage)} />
      <Route path="/dashboard/ports" component={withLayout(PortsPage)} />
      <Route path="/dashboard/documents" component={withLayout(DocumentsPage)} />
      <Route component={NotFound} />
    </Switch>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App
