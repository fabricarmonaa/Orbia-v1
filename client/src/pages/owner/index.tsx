import { useState, useEffect, useRef } from "react";
import { useAuth, apiRequest, getToken } from "@/lib/auth";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Building2,
  Plus,
  Users,
  TrendingUp,
  LogOut,
  Shield,
  Search,
  Truck,
  Upload,
  CalendarDays,
  Lock,
  Unlock,
  Save,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tenant, Plan, TenantAddon } from "@shared/schema";

function getSubscriptionStatus(tenant: Tenant): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  className: string;
} {
  if (!tenant.isActive) {
    return { label: "Bloqueada", variant: "destructive", className: "" };
  }
  if (!tenant.subscriptionStartDate || !tenant.subscriptionEndDate) {
    return { label: "Sin suscripción", variant: "secondary", className: "" };
  }
  const now = new Date();
  const end = new Date(tenant.subscriptionEndDate);
  const diffMs = end.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < -3) {
    return { label: "Bloqueada", variant: "destructive", className: "" };
  }
  if (diffDays < 0) {
    return { label: "Período de gracia", variant: "outline", className: "border-orange-500 text-orange-600 dark:text-orange-400" };
  }
  if (diffDays <= 7) {
    return { label: "Por vencer", variant: "outline", className: "border-yellow-500 text-yellow-600 dark:text-yellow-400" };
  }
  return { label: "Activa", variant: "outline", className: "border-green-500 text-green-600 dark:text-green-400" };
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function toInputDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString().split("T")[0];
}

export default function OwnerDashboard() {
  const { user, isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [tenants, setTenants] = useState<(Tenant & { plan?: Plan })[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const { toast } = useToast();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [addonStatus, setAddonStatus] = useState<Record<number, Record<string, boolean>>>({});
  const [togglingAddon, setTogglingAddon] = useState<string | null>(null);

  const [subscriptionDates, setSubscriptionDates] = useState<Record<number, { start: string; end: string }>>({});
  const [savingSubscription, setSavingSubscription] = useState<number | null>(null);
  const [togglingBlock, setTogglingBlock] = useState<number | null>(null);

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
    fetchConfig();
  }, [isAuthenticated, user]);

  async function fetchConfig() {
    try {
      const res = await apiRequest("GET", "/api/super/config");
      const data = await res.json();
      if (data.data?.avatarUrl) {
        setAvatarUrl(data.data.avatarUrl);
      }
    } catch {
    }
  }

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

      const dates: Record<number, { start: string; end: string }> = {};
      tenantsList.forEach((t) => {
        dates[t.id] = {
          start: toInputDate(t.subscriptionStartDate),
          end: toInputDate(t.subscriptionEndDate),
        };
      });
      setSubscriptionDates(dates);

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

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const token = getToken();
      const res = await fetch("/api/super/config/avatar", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      const data = await res.json();
      if (data.data?.avatarUrl) {
        setAvatarUrl(data.data.avatarUrl);
      }
      toast({ title: "Avatar actualizado" });
      setAvatarDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = "";
      }
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

  async function saveSubscription(tenantId: number) {
    const dates = subscriptionDates[tenantId];
    if (!dates?.start || !dates?.end) {
      toast({ title: "Error", description: "Seleccioná ambas fechas", variant: "destructive" });
      return;
    }
    setSavingSubscription(tenantId);
    try {
      await apiRequest("PATCH", `/api/super/tenants/${tenantId}/subscription`, {
        startDate: new Date(dates.start).toISOString(),
        endDate: new Date(dates.end).toISOString(),
      });
      toast({ title: "Suscripción actualizada" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingSubscription(null);
    }
  }

  async function toggleBlock(tenantId: number, currentlyActive: boolean) {
    setTogglingBlock(tenantId);
    try {
      await apiRequest("PATCH", `/api/super/tenants/${tenantId}/block`, {
        isActive: !currentlyActive,
      });
      toast({ title: currentlyActive ? "Tenant bloqueado" : "Tenant desbloqueado" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setTogglingBlock(null);
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
              <Dialog open={avatarDialogOpen} onOpenChange={setAvatarDialogOpen}>
                <DialogTrigger asChild>
                  <button
                    className="focus:outline-none cursor-pointer"
                    data-testid="button-avatar-trigger"
                  >
                    <Avatar className="h-8 w-8">
                      {avatarUrl ? (
                        <AvatarImage src={avatarUrl} alt="Owner avatar" data-testid="img-owner-avatar" />
                      ) : null}
                      <AvatarFallback>
                        <Shield className="w-4 h-4 text-primary" />
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Actualizar Avatar</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col items-center gap-4 py-4">
                    <Avatar className="h-20 w-20">
                      {avatarUrl ? (
                        <AvatarImage src={avatarUrl} alt="Owner avatar" />
                      ) : null}
                      <AvatarFallback>
                        <Shield className="w-8 h-8 text-primary" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-2 w-full">
                      <Label htmlFor="avatar-upload">Seleccionar imagen</Label>
                      <Input
                        id="avatar-upload"
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        disabled={uploadingAvatar}
                        data-testid="input-avatar-upload"
                      />
                    </div>
                    {uploadingAvatar && (
                      <p className="text-sm text-muted-foreground">Subiendo...</p>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
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

        <Tabs defaultValue="tenants" data-testid="tabs-owner">
          <TabsList>
            <TabsTrigger value="tenants" data-testid="tab-tenants">Negocios</TabsTrigger>
            <TabsTrigger value="subscriptions" data-testid="tab-subscriptions">Suscripciones</TabsTrigger>
          </TabsList>

          <TabsContent value="tenants" className="space-y-4">
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
          </TabsContent>

          <TabsContent value="subscriptions" className="space-y-4">
            <h2 className="text-xl font-semibold">Suscripciones</h2>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 w-full rounded-md" />
                ))}
              </div>
            ) : tenants.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CalendarDays className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No hay negocios registrados</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {tenants.map((tenant) => {
                  const status = getSubscriptionStatus(tenant);
                  const dates = subscriptionDates[tenant.id] || { start: "", end: "" };
                  return (
                    <Card key={tenant.id} data-testid={`card-subscription-${tenant.id}`}>
                      <CardContent className="py-4 space-y-4">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Building2 className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium" data-testid={`text-sub-tenant-name-${tenant.id}`}>
                                {tenant.name}
                              </p>
                              <p className="text-sm text-muted-foreground">{tenant.code}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <Badge
                              variant={status.variant}
                              className={status.className}
                              data-testid={`badge-subscription-status-${tenant.id}`}
                            >
                              {status.label}
                            </Badge>
                            {tenant.subscriptionStartDate && tenant.subscriptionEndDate && (
                              <span className="text-sm text-muted-foreground" data-testid={`text-subscription-dates-${tenant.id}`}>
                                {formatDate(tenant.subscriptionStartDate)} - {formatDate(tenant.subscriptionEndDate)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-end gap-3 flex-wrap">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Inicio</Label>
                            <Input
                              type="date"
                              value={dates.start}
                              onChange={(e) =>
                                setSubscriptionDates((prev) => ({
                                  ...prev,
                                  [tenant.id]: { ...prev[tenant.id], start: e.target.value },
                                }))
                              }
                              data-testid={`input-sub-start-${tenant.id}`}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Fin</Label>
                            <Input
                              type="date"
                              value={dates.end}
                              onChange={(e) =>
                                setSubscriptionDates((prev) => ({
                                  ...prev,
                                  [tenant.id]: { ...prev[tenant.id], end: e.target.value },
                                }))
                              }
                              data-testid={`input-sub-end-${tenant.id}`}
                            />
                          </div>
                          <Button
                            onClick={() => saveSubscription(tenant.id)}
                            disabled={savingSubscription === tenant.id}
                            data-testid={`button-save-subscription-${tenant.id}`}
                          >
                            <Save className="w-4 h-4 mr-2" />
                            {savingSubscription === tenant.id ? "Guardando..." : "Guardar suscripción"}
                          </Button>
                          <Button
                            variant={tenant.isActive ? "destructive" : "default"}
                            onClick={() => toggleBlock(tenant.id, tenant.isActive)}
                            disabled={togglingBlock === tenant.id}
                            data-testid={`button-toggle-block-${tenant.id}`}
                          >
                            {tenant.isActive ? (
                              <>
                                <Lock className="w-4 h-4 mr-2" />
                                Bloquear
                              </>
                            ) : (
                              <>
                                <Unlock className="w-4 h-4 mr-2" />
                                Desbloquear
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
