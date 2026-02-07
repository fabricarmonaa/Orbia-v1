import { useState, useEffect } from "react";
import { apiRequest, useAuth } from "@/lib/auth";
import { usePlan } from "@/lib/plan";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, Save, Crown, Lock, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Config {
  businessName: string;
  businessType: string;
  currency: string;
  trackingExpirationHours: number;
  language: string;
}

const featureLabels: Record<string, string> = {
  orders: "Pedidos / Servicios",
  tracking: "Tracking Público",
  cash_simple: "Caja Simple",
  cash_sessions: "Caja con Sesiones",
  products: "Productos y Categorías",
  branches: "Multi-Sucursal",
  fixed_expenses: "Gastos Fijos",
  variable_expenses: "Gastos Variables",
  reports_advanced: "Reportes Avanzados",
  stt: "Voz IA (STT)",
};

const limitLabels: Record<string, string> = {
  max_branches: "Máx. Sucursales",
  max_staff_users: "Máx. Staff",
  max_orders_month: "Pedidos/mes",
  tracking_retention_min_hours: "Tracking mín. (horas)",
  tracking_retention_max_hours: "Tracking máx. (horas)",
};

export default function SettingsPage() {
  const { user } = useAuth();
  const { plan, loading: planLoading, getLimit } = usePlan();
  const [config, setConfig] = useState<Config>({
    businessName: "",
    businessType: "",
    currency: "ARS",
    trackingExpirationHours: 24,
    language: "es",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const minTrackingHours = getLimit("tracking_retention_min_hours") || 1;
  const maxTrackingHours = getLimit("tracking_retention_max_hours") || 24;

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    try {
      const configRes = await apiRequest("GET", "/api/config");
      const configData = await configRes.json();
      if (configData.data) {
        setConfig({
          businessName: configData.data.businessName || "",
          businessType: configData.data.businessType || "",
          currency: configData.data.currency || "ARS",
          trackingExpirationHours: configData.data.trackingExpirationHours || 24,
          language: configData.data.language || "es",
        });
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest("PUT", "/api/config", config);
      toast({ title: "Configuración guardada" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading || planLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-md" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">Ajustes del negocio y preferencias</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <Settings className="w-5 h-5 text-muted-foreground" />
              <div>
                <h3 className="font-semibold">Perfil del Negocio</h3>
                <p className="text-sm text-muted-foreground">Información general y preferencias</p>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveConfig} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre del Negocio</Label>
                    <Input
                      value={config.businessName}
                      onChange={(e) => setConfig({ ...config, businessName: e.target.value })}
                      placeholder="Mi Negocio"
                      data-testid="input-business-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Negocio</Label>
                    <Input
                      value={config.businessType}
                      onChange={(e) => setConfig({ ...config, businessType: e.target.value })}
                      placeholder="Ej: Comercio, Servicio"
                      data-testid="input-business-type"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Moneda</Label>
                    <Select value={config.currency} onValueChange={(v) => setConfig({ ...config, currency: v })}>
                      <SelectTrigger data-testid="select-currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ARS">ARS (Peso Argentino)</SelectItem>
                        <SelectItem value="USD">USD (Dólar)</SelectItem>
                        <SelectItem value="EUR">EUR (Euro)</SelectItem>
                        <SelectItem value="MXN">MXN (Peso Mexicano)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Idioma</Label>
                    <Select value={config.language} onValueChange={(v) => setConfig({ ...config, language: v })}>
                      <SelectTrigger data-testid="select-language">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="pt">Português</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Tracking (horas)
                      <span className="text-xs text-muted-foreground ml-1">
                        ({minTrackingHours}-{maxTrackingHours}h)
                      </span>
                    </Label>
                    <Input
                      type="number"
                      min={minTrackingHours}
                      max={maxTrackingHours}
                      value={config.trackingExpirationHours}
                      onChange={(e) => {
                        const v = parseInt(e.target.value) || minTrackingHours;
                        setConfig({ ...config, trackingExpirationHours: Math.min(Math.max(v, minTrackingHours), maxTrackingHours) });
                      }}
                      data-testid="input-tracking-hours"
                    />
                  </div>
                </div>
                <Button type="submit" disabled={saving} data-testid="button-save-config">
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <Crown className="w-5 h-5 text-chart-4" />
              <div>
                <h3 className="font-semibold">Plan Actual</h3>
              </div>
            </CardHeader>
            <CardContent>
              {plan ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="text-sm" data-testid="badge-current-plan">
                      {plan.name}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Funcionalidades
                    </p>
                    <div className="space-y-1.5">
                      {Object.entries(plan.features || {}).map(([key, val]) => (
                        <div key={key} className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-muted-foreground">{featureLabels[key] || key}</span>
                          {val ? (
                            <Check className="w-4 h-4 text-chart-2 flex-shrink-0" />
                          ) : (
                            <X className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  {plan.limits && Object.keys(plan.limits).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Límites
                      </p>
                      <div className="space-y-1.5">
                        {Object.entries(plan.limits).map(([key, val]) => (
                          <div key={key} className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-muted-foreground">{limitLabels[key] || key}</span>
                            <span className="font-medium">
                              {val === -1 ? "Ilimitado" : val === 0 ? "No incluido" : val}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin plan asignado</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
