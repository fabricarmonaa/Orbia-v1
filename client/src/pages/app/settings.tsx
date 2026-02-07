import { useState, useEffect } from "react";
import { apiRequest, useAuth } from "@/lib/auth";
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
import { Settings, Save, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Config {
  businessName: string;
  businessType: string;
  currency: string;
  trackingExpirationHours: number;
  language: string;
}

interface PlanInfo {
  name: string;
  planCode: string;
  features: Record<string, boolean>;
  limits: Record<string, number>;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState<Config>({
    businessName: "",
    businessType: "",
    currency: "ARS",
    trackingExpirationHours: 24,
    language: "es",
  });
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    try {
      const [configRes, planRes] = await Promise.all([
        apiRequest("GET", "/api/config"),
        apiRequest("GET", "/api/me/plan"),
      ]);
      const configData = await configRes.json();
      const planData = await planRes.json();
      if (configData.data) {
        setConfig({
          businessName: configData.data.businessName || "",
          businessType: configData.data.businessType || "",
          currency: configData.data.currency || "ARS",
          trackingExpirationHours: configData.data.trackingExpirationHours || 24,
          language: configData.data.language || "es",
        });
      }
      setPlanInfo(planData.data || null);
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

  if (loading) {
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
                    <Label>Link Tracking (horas)</Label>
                    <Input
                      type="number"
                      value={config.trackingExpirationHours}
                      onChange={(e) =>
                        setConfig({ ...config, trackingExpirationHours: parseInt(e.target.value) || 24 })
                      }
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

        <div>
          <Card>
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <Crown className="w-5 h-5 text-chart-4" />
              <div>
                <h3 className="font-semibold">Plan Actual</h3>
              </div>
            </CardHeader>
            <CardContent>
              {planInfo ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="text-sm">
                      {planInfo.name}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Funcionalidades
                    </p>
                    <div className="space-y-1.5">
                      {Object.entries(planInfo.features || {}).map(([key, val]) => (
                        <div key={key} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{key.replace(/_/g, " ")}</span>
                          <Badge variant={val ? "default" : "secondary"}>
                            {val ? "Si" : "No"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                  {planInfo.limits && Object.keys(planInfo.limits).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Límites
                      </p>
                      <div className="space-y-1.5">
                        {Object.entries(planInfo.limits).map(([key, val]) => (
                          <div key={key} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{key.replace(/_/g, " ")}</span>
                            <span className="font-medium">{val === -1 ? "Ilimitado" : val}</span>
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
