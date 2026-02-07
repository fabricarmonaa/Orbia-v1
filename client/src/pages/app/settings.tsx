import { useState, useEffect, useRef } from "react";
import { apiRequest, useAuth, getToken } from "@/lib/auth";
import { usePlan } from "@/lib/plan";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  Save,
  Crown,
  Check,
  X,
  Upload,
  Palette,
  Eye,
  AlignVerticalJustifyStart,
  LayoutGrid,
  ListOrdered,
  Minus,
  Package,
  Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Config {
  businessName: string;
  businessType: string;
  businessDescription: string;
  logoUrl: string;
  currency: string;
  trackingExpirationHours: number;
  language: string;
  trackingLayout: string;
  trackingPrimaryColor: string;
  trackingAccentColor: string;
  trackingBgColor: string;
  trackingTosText: string;
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

const layoutPresets = [
  {
    value: "classic",
    label: "Clásico",
    description: "Timeline vertical",
    Icon: AlignVerticalJustifyStart,
  },
  {
    value: "cards",
    label: "Tarjetas",
    description: "Cards lado a lado",
    Icon: LayoutGrid,
  },
  {
    value: "stepper",
    label: "Stepper",
    description: "Stepper horizontal",
    Icon: ListOrdered,
  },
  {
    value: "minimal",
    label: "Minimal",
    description: "Compacto y limpio",
    Icon: Minus,
  },
];

function TrackingPreview({ config }: { config: Config }) {
  const { trackingLayout, trackingPrimaryColor, trackingAccentColor, trackingBgColor } = config;

  const steps = [
    { label: "Recibido", time: "10:00", done: true },
    { label: "En Proceso", time: "11:30", done: true },
    { label: "Listo", time: "", done: false },
    { label: "Entregado", time: "", done: false },
  ];

  return (
    <div
      className="rounded-md p-4 border overflow-auto"
      style={{ backgroundColor: trackingBgColor, minHeight: 200 }}
      data-testid="tracking-preview"
    >
      <div className="mb-3 flex items-center gap-2">
        <Package className="w-4 h-4" style={{ color: trackingPrimaryColor }} />
        <span className="font-semibold text-sm" style={{ color: trackingPrimaryColor }}>
          Pedido #123
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ backgroundColor: trackingAccentColor, color: "#fff" }}
        >
          En Proceso
        </span>
      </div>
      <p className="text-xs mb-3" style={{ color: trackingPrimaryColor, opacity: 0.7 }}>
        Cliente: Juan Pérez
      </p>

      {trackingLayout === "classic" && (
        <div className="space-y-3 pl-2">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div
                  className="w-3 h-3 rounded-full border-2 flex-shrink-0"
                  style={{
                    borderColor: trackingPrimaryColor,
                    backgroundColor: step.done ? trackingPrimaryColor : "transparent",
                  }}
                />
                {i < steps.length - 1 && (
                  <div
                    className="w-0.5 h-5 mt-0.5"
                    style={{
                      backgroundColor: step.done ? trackingPrimaryColor : trackingAccentColor,
                      opacity: step.done ? 1 : 0.3,
                    }}
                  />
                )}
              </div>
              <div className="-mt-0.5">
                <p className="text-xs font-medium" style={{ color: step.done ? trackingPrimaryColor : `${trackingPrimaryColor}88` }}>
                  {step.label}
                </p>
                {step.time && (
                  <p className="text-[10px]" style={{ color: trackingAccentColor }}>{step.time}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {trackingLayout === "cards" && (
        <div className="grid grid-cols-2 gap-2">
          {steps.map((step, i) => (
            <div
              key={i}
              className="rounded-md p-2 border text-center"
              style={{
                borderColor: step.done ? trackingPrimaryColor : `${trackingPrimaryColor}33`,
                backgroundColor: step.done ? `${trackingPrimaryColor}11` : "transparent",
              }}
            >
              <p className="text-xs font-medium" style={{ color: step.done ? trackingPrimaryColor : `${trackingPrimaryColor}88` }}>
                {step.label}
              </p>
              {step.time && (
                <p className="text-[10px] mt-0.5" style={{ color: trackingAccentColor }}>
                  <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                  {step.time}
                </p>
              )}
              {step.done && <Check className="w-3 h-3 mx-auto mt-1" style={{ color: trackingPrimaryColor }} />}
            </div>
          ))}
        </div>
      )}

      {trackingLayout === "stepper" && (
        <div className="flex items-center gap-1 overflow-x-auto">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-1 flex-shrink-0">
              <div className="flex flex-col items-center">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{
                    backgroundColor: step.done ? trackingPrimaryColor : "transparent",
                    border: `2px solid ${step.done ? trackingPrimaryColor : `${trackingPrimaryColor}44`}`,
                    color: step.done ? "#fff" : trackingPrimaryColor,
                  }}
                >
                  {step.done ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                <p className="text-[9px] mt-1 text-center w-12 leading-tight" style={{ color: step.done ? trackingPrimaryColor : `${trackingPrimaryColor}88` }}>
                  {step.label}
                </p>
              </div>
              {i < steps.length - 1 && (
                <div
                  className="w-4 h-0.5 -mt-3"
                  style={{
                    backgroundColor: step.done ? trackingPrimaryColor : `${trackingPrimaryColor}33`,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {trackingLayout === "minimal" && (
        <div className="space-y-1">
          {steps.map((step, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-xs py-1"
              style={{
                borderBottom: i < steps.length - 1 ? `1px solid ${trackingPrimaryColor}15` : undefined,
              }}
            >
              <span style={{ color: step.done ? trackingPrimaryColor : `${trackingPrimaryColor}66` }}>
                {step.label}
              </span>
              <span style={{ color: trackingAccentColor, fontSize: 10 }}>
                {step.time || "—"}
              </span>
            </div>
          ))}
        </div>
      )}

      {config.trackingTosText && (
        <p className="text-[9px] mt-3 pt-2" style={{ color: `${trackingPrimaryColor}55`, borderTop: `1px solid ${trackingPrimaryColor}15` }}>
          {config.trackingTosText.slice(0, 80)}{config.trackingTosText.length > 80 ? "..." : ""}
        </p>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { plan, loading: planLoading, getLimit } = usePlan();
  const [config, setConfig] = useState<Config>({
    businessName: "",
    businessType: "",
    businessDescription: "",
    logoUrl: "",
    currency: "ARS",
    trackingExpirationHours: 24,
    language: "es",
    trackingLayout: "classic",
    trackingPrimaryColor: "#6366f1",
    trackingAccentColor: "#8b5cf6",
    trackingBgColor: "#ffffff",
    trackingTosText: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
          businessDescription: configData.data.businessDescription || "",
          logoUrl: configData.data.logoUrl || "",
          currency: configData.data.currency || "ARS",
          trackingExpirationHours: configData.data.trackingExpirationHours || 24,
          language: configData.data.language || "es",
          trackingLayout: configData.data.trackingLayout || "classic",
          trackingPrimaryColor: configData.data.trackingPrimaryColor || "#6366f1",
          trackingAccentColor: configData.data.trackingAccentColor || "#8b5cf6",
          trackingBgColor: configData.data.trackingBgColor || "#ffffff",
          trackingTosText: configData.data.trackingTosText || "",
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

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const token = getToken();
      const res = await fetch("/api/config/logo", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      const data = await res.json();
      const newLogoUrl = data.data?.logoUrl || data.logoUrl;
      if (newLogoUrl) {
        setConfig((prev) => ({ ...prev, logoUrl: newLogoUrl }));
      }
      toast({ title: "Logo actualizado" });
    } catch (err: any) {
      toast({ title: "Error al subir logo", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
        <div className="lg:col-span-2 space-y-6">
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
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16" data-testid="avatar-logo">
                    {config.logoUrl ? (
                      <AvatarImage src={config.logoUrl} alt="Logo" />
                    ) : null}
                    <AvatarFallback className="text-lg">
                      {config.businessName ? config.businessName.charAt(0).toUpperCase() : "N"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <Label className="text-sm">Logo del Negocio</Label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                      data-testid="input-logo-file"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="button-upload-logo"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploading ? "Subiendo..." : "Subir Logo"}
                    </Button>
                  </div>
                </div>

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

                <div className="space-y-2">
                  <Label>Descripción del Negocio</Label>
                  <Textarea
                    value={config.businessDescription}
                    onChange={(e) => setConfig({ ...config, businessDescription: e.target.value })}
                    placeholder="Breve descripción de tu negocio..."
                    rows={3}
                    data-testid="input-business-description"
                  />
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

          <Card>
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <Palette className="w-5 h-5 text-muted-foreground" />
              <div>
                <h3 className="font-semibold">Personalización del Tracking</h3>
                <p className="text-sm text-muted-foreground">Apariencia y estilo de la página pública</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Diseño del Tracking</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {layoutPresets.map((preset) => {
                    const isSelected = config.trackingLayout === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setConfig({ ...config, trackingLayout: preset.value })}
                        className={`rounded-md border p-3 text-center transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border"
                        }`}
                        data-testid={`button-layout-${preset.value}`}
                      >
                        <preset.Icon
                          className="w-6 h-6 mx-auto mb-1.5"
                          style={{ color: isSelected ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}
                        />
                        <p className={`text-xs font-medium ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                          {preset.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{preset.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Color Primario</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      value={config.trackingPrimaryColor}
                      onChange={(e) => setConfig({ ...config, trackingPrimaryColor: e.target.value })}
                      className="w-10 h-9 p-1 cursor-pointer"
                      data-testid="input-tracking-primary-color"
                    />
                    <Input
                      value={config.trackingPrimaryColor}
                      onChange={(e) => setConfig({ ...config, trackingPrimaryColor: e.target.value })}
                      className="flex-1"
                      maxLength={7}
                      data-testid="input-tracking-primary-color-text"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Color de Acento</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      value={config.trackingAccentColor}
                      onChange={(e) => setConfig({ ...config, trackingAccentColor: e.target.value })}
                      className="w-10 h-9 p-1 cursor-pointer"
                      data-testid="input-tracking-accent-color"
                    />
                    <Input
                      value={config.trackingAccentColor}
                      onChange={(e) => setConfig({ ...config, trackingAccentColor: e.target.value })}
                      className="flex-1"
                      maxLength={7}
                      data-testid="input-tracking-accent-color-text"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Color de Fondo</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      value={config.trackingBgColor}
                      onChange={(e) => setConfig({ ...config, trackingBgColor: e.target.value })}
                      className="w-10 h-9 p-1 cursor-pointer"
                      data-testid="input-tracking-bg-color"
                    />
                    <Input
                      value={config.trackingBgColor}
                      onChange={(e) => setConfig({ ...config, trackingBgColor: e.target.value })}
                      className="flex-1"
                      maxLength={7}
                      data-testid="input-tracking-bg-color-text"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Términos y Condiciones</Label>
                <Textarea
                  value={config.trackingTosText}
                  onChange={(e) => setConfig({ ...config, trackingTosText: e.target.value })}
                  placeholder="Texto de términos y condiciones que aparecerá en la página de tracking..."
                  rows={3}
                  data-testid="input-tracking-tos"
                />
              </div>

              <Button onClick={saveConfig as any} disabled={saving} data-testid="button-save-tracking">
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Guardando..." : "Guardar Personalización"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <Eye className="w-5 h-5 text-muted-foreground" />
              <div>
                <h3 className="font-semibold">Vista Previa del Tracking</h3>
                <p className="text-sm text-muted-foreground">Así se verá la página de tracking para tus clientes</p>
              </div>
            </CardHeader>
            <CardContent>
              <TrackingPreview config={config} />
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
                  <div className="flex items-center gap-2 flex-wrap">
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
