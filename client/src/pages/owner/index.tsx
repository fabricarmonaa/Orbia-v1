import { useState, useEffect } from "react";
import { useAuth, apiRequest } from "@/lib/auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Building2,
  Plus,
  Users,
  TrendingUp,
  LogOut,
  Shield,
  Search,
  Truck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tenant, Plan, TenantAddon } from "@shared/schema";

export default function OwnerDashboard() {
  const { user, isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [tenants, setTenants] = useState<(Tenant & { plan?: Plan })[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const [addonStatus, setAddonStatus] = useState<Record<number, Record<string, boolean>>>({});
  const [togglingAddon, setTogglingAddon] = useState<string | null>(null);

  const [newTenant, setNewTenant] = useState({
    code: "",
    name: "",
    planId: "",
    adminEmail: "",
    adminPassword: "",
    adminName: "",
  });

  useEffect(() => {
    if (!isAuthenticated || !user?.isSuperAdmin) {
      setLocation("/owner/login");
      return;
    }
    fetchData();
  }, [isAuthenticated, user]);

  async function fetchData() {
    try {
      const [tenantsRes, plansRes] = await Promise.all([
        apiRequest("GET", "/api/super/tenants"),
        apiRequest("GET", "/api/super/plans"),
      ]);
      const tenantsData = await tenantsRes.json();
      const plansData = await plansRes.json();
      const tenantsList: (Tenant & { plan?: Plan })[] = tenantsData.data || [];
      setTenants(tenantsList);
      setPlans(plansData.data || []);
      const addonMap: Record<number, Record<string, boolean>> = {};
      await Promise.all(
        tenantsList.map(async (t) => {
          try {
            const addonsRes = await apiRequest("GET", `/api/super/tenants/${t.id}/addons`);
            const addonsData = await addonsRes.json();
            const map: Record<string, boolean> = {};
            (addonsData.data || []).forEach((a: TenantAddon) => {
              map[a.addonKey] = a.enabled;
            });
            addonMap[t.id] = map;
          } catch {
            addonMap[t.id] = {};
          }
        })
      );
      setAddonStatus(addonMap);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function toggleAddon(tenantId: number, addonKey: string, enabled: boolean) {
    const key = `${tenantId}-${addonKey}`;
    setTogglingAddon(key);
    try {
      await apiRequest("POST", `/api/super/tenants/${tenantId}/addons`, { addonKey, enabled });
      setAddonStatus((prev) => ({
        ...prev,
        [tenantId]: { ...prev[tenantId], [addonKey]: enabled },
      }));
      toast({ title: enabled ? "Addon activado" : "Addon desactivado" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setTogglingAddon(null);
    }
  }

  async function createTenant(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiRequest("POST", "/api/super/tenants", {
        ...newTenant,
        planId: parseInt(newTenant.planId),
      });
      toast({ title: "Tenant creado correctamente" });
      setDialogOpen(false);
      setNewTenant({ code: "", name: "", planId: "", adminEmail: "", adminPassword: "", adminName: "" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  async function changePlan(tenantId: number, planId: number) {
    try {
      await apiRequest("PATCH", `/api/super/tenants/${tenantId}/plan`, { planId });
      toast({ title: "Plan actualizado" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.code.toLowerCase().includes(search.toLowerCase())
  );

  const activeTenants = tenants.filter((t) => t.isActive).length;

  function handleLogout() {
    logout();
    setLocation("/owner/login");
  }

  if (!isAuthenticated || !user?.isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 h-14">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-primary" />
              <span className="font-bold text-lg tracking-tight">ORBIA</span>
              <Badge variant="secondary">Super Admin</Badge>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="button-logout">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Tenants</p>
                  <p className="text-2xl font-bold" data-testid="text-total-tenants">{tenants.length}</p>
                </div>
                <div className="p-3 rounded-md bg-primary/10">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Activos</p>
                  <p className="text-2xl font-bold" data-testid="text-active-tenants">{activeTenants}</p>
                </div>
                <div className="p-3 rounded-md bg-chart-2/10">
                  <Users className="w-5 h-5 text-chart-2" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Planes</p>
                  <p className="text-2xl font-bold" data-testid="text-total-plans">{plans.length}</p>
                </div>
                <div className="p-3 rounded-md bg-chart-4/10">
                  <TrendingUp className="w-5 h-5 text-chart-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-xl font-semibold">Negocios</h2>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar negocio..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-64"
                data-testid="input-search-tenants"
              />
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-tenant">
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Negocio
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Crear Nuevo Negocio</DialogTitle>
                </DialogHeader>
                <form onSubmit={createTenant} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Código</Label>
                      <Input
                        placeholder="mi-negocio"
                        value={newTenant.code}
                        onChange={(e) => setNewTenant({ ...newTenant, code: e.target.value })}
                        required
                        data-testid="input-new-tenant-code"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nombre</Label>
                      <Input
                        placeholder="Mi Negocio"
                        value={newTenant.name}
                        onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                        required
                        data-testid="input-new-tenant-name"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Plan</Label>
                    <Select
                      value={newTenant.planId}
                      onValueChange={(v) => setNewTenant({ ...newTenant, planId: v })}
                    >
                      <SelectTrigger data-testid="select-plan">
                        <SelectValue placeholder="Seleccionar plan" />
                      </SelectTrigger>
                      <SelectContent>
                        {plans.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nombre del Admin</Label>
                    <Input
                      placeholder="Juan Pérez"
                      value={newTenant.adminName}
                      onChange={(e) => setNewTenant({ ...newTenant, adminName: e.target.value })}
                      required
                      data-testid="input-new-admin-name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Email Admin</Label>
                      <Input
                        type="email"
                        placeholder="admin@negocio.com"
                        value={newTenant.adminEmail}
                        onChange={(e) => setNewTenant({ ...newTenant, adminEmail: e.target.value })}
                        required
                        data-testid="input-new-admin-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Contraseña Admin</Label>
                      <Input
                        type="password"
                        placeholder="Contraseña"
                        value={newTenant.adminPassword}
                        onChange={(e) => setNewTenant({ ...newTenant, adminPassword: e.target.value })}
                        required
                        data-testid="input-new-admin-password"
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" data-testid="button-submit-tenant">
                    Crear Negocio
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-md" />
            ))}
          </div>
        ) : filteredTenants.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                {search ? "No se encontraron negocios" : "No hay negocios registrados aún"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredTenants.map((tenant) => {
              const plan = plans.find((p) => p.id === tenant.planId);
              return (
                <Card key={tenant.id} className="hover-elevate" data-testid={`card-tenant-${tenant.id}`}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium" data-testid={`text-tenant-name-${tenant.id}`}>
                            {tenant.name}
                          </p>
                          <p className="text-sm text-muted-foreground">{tenant.code}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge variant={tenant.isActive ? "default" : "secondary"}>
                          {tenant.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-muted-foreground" />
                          <Label className="text-xs text-muted-foreground whitespace-nowrap">Delivery</Label>
                          <Switch
                            checked={!!addonStatus[tenant.id]?.delivery}
                            disabled={togglingAddon === `${tenant.id}-delivery`}
                            onCheckedChange={(checked) => toggleAddon(tenant.id, "delivery", checked)}
                            data-testid={`switch-delivery-addon-${tenant.id}`}
                          />
                        </div>
                        <Select
                          value={String(tenant.planId || "")}
                          onValueChange={(v) => changePlan(tenant.id, parseInt(v))}
                        >
                          <SelectTrigger className="w-40" data-testid={`select-tenant-plan-${tenant.id}`}>
                            <SelectValue placeholder="Plan">{plan?.name || "Sin plan"}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {plans.map((p) => (
                              <SelectItem key={p.id} value={String(p.id)}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
