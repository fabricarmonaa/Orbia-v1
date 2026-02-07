import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PackageSearch, Clock, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";

interface TrackingData {
  orderNumber: number;
  type: string;
  status: string;
  statusColor: string;
  customerName: string;
  createdAt: string;
  scheduledAt: string | null;
  closedAt: string | null;
  history: Array<{
    status: string;
    color: string;
    date: string;
    note: string | null;
  }>;
  publicComments: Array<{
    content: string;
    date: string;
  }>;
  businessName: string;
  logoUrl: string | null;
  trackingLayout: string;
  trackingPrimaryColor: string;
  trackingAccentColor: string;
  trackingBgColor: string;
  trackingTosText: string | null;
}

export default function PublicTracking() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchTracking();
  }, [params.id]);

  async function fetchTracking() {
    try {
      const res = await fetch(`/api/public/tracking/${params.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No encontrado");
      setData(json.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(d: string | null) {
    if (!d) return "";
    return new Date(d).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-48 w-full rounded-md" />
          <Skeleton className="h-32 w-full rounded-md" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto text-destructive mb-4" />
          <h1 className="text-xl font-bold mb-2">No disponible</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const primary = data.trackingPrimaryColor || "#6366f1";
  const accent = data.trackingAccentColor || "#8b5cf6";
  const bgColor = data.trackingBgColor || "#ffffff";
  const layout = data.trackingLayout || "classic";

  function getContrastText(hex: string) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.5 ? "#1a1a1a" : "#ffffff";
  }

  const textColor = getContrastText(bgColor);
  const mutedText = getContrastText(bgColor) === "#ffffff" ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)";

  const headerSection = (
    <div className="text-center py-4">
      {data.logoUrl ? (
        <img
          src={data.logoUrl}
          alt={data.businessName}
          className="w-14 h-14 rounded-md object-cover mx-auto mb-3"
          data-testid="img-tracking-logo"
        />
      ) : (
        <div
          className="inline-flex items-center justify-center w-12 h-12 rounded-md mb-3"
          style={{ backgroundColor: primary }}
        >
          <PackageSearch className="w-6 h-6" style={{ color: getContrastText(primary) }} />
        </div>
      )}
      <h1 className="text-lg font-bold tracking-tight" style={{ color: textColor }}>
        Seguimiento
      </h1>
      {data.businessName && (
        <p className="text-sm" style={{ color: mutedText }}>{data.businessName}</p>
      )}
    </div>
  );

  const orderInfoSection = (
    <Card style={{ borderColor: `${primary}20` }}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <p className="text-sm text-muted-foreground">Pedido</p>
            <p className="text-xl font-bold" data-testid="text-tracking-order-number">
              #{data.orderNumber}
            </p>
          </div>
          <Badge
            style={{ backgroundColor: data.statusColor, color: "#fff" }}
            className="text-sm"
            data-testid="badge-tracking-status"
          >
            {data.status}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Tipo</p>
            <p className="font-medium">{data.type}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Cliente</p>
            <p className="font-medium">{data.customerName || "-"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Creado</p>
            <p className="font-medium">{formatDate(data.createdAt)}</p>
          </div>
          {data.closedAt && (
            <div>
              <p className="text-muted-foreground">Cerrado</p>
              <p className="font-medium">{formatDate(data.closedAt)}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const classicHistory = data.history.length > 0 && (
    <Card>
      <CardHeader className="pb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Historial
        </h3>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.history.map((h, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                  style={{ backgroundColor: h.color }}
                />
                {i < data.history.length - 1 && (
                  <div className="w-px flex-1 bg-border mt-1" />
                )}
              </div>
              <div className="pb-4">
                <p className="text-sm font-medium">{h.status}</p>
                <p className="text-xs text-muted-foreground">{formatDate(h.date)}</p>
                {h.note && (
                  <p className="text-sm text-muted-foreground mt-1">{h.note}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const cardsHistory = data.history.length > 0 && (
    <div>
      <h3 className="font-semibold flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4" />
        Historial
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {data.history.map((h, i) => (
          <Card key={i} style={{ borderLeftColor: h.color, borderLeftWidth: "3px" }}>
            <CardContent className="p-3">
              <p className="text-sm font-medium">{h.status}</p>
              <p className="text-xs text-muted-foreground">{formatDate(h.date)}</p>
              {h.note && <p className="text-xs text-muted-foreground mt-1">{h.note}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const stepperHistory = data.history.length > 0 && (
    <Card>
      <CardHeader className="pb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Historial
        </h3>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {data.history.map((h, i) => (
            <div key={i} className="flex items-center flex-shrink-0">
              <div className="flex flex-col items-center">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: h.color }}
                >
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
                <p className="text-xs font-medium mt-1 text-center max-w-[80px] truncate">{h.status}</p>
                <p className="text-xs text-muted-foreground">{formatDate(h.date).split(",")[0]}</p>
              </div>
              {i < data.history.length - 1 && (
                <ArrowRight className="w-4 h-4 text-muted-foreground mx-1 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const minimalHistory = data.history.length > 0 && (
    <div className="space-y-2">
      {data.history.map((h, i) => (
        <div key={i} className="flex items-center gap-3 py-1.5" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: h.color }} />
          <span className="text-sm font-medium flex-1">{h.status}</span>
          <span className="text-xs text-muted-foreground">{formatDate(h.date)}</span>
        </div>
      ))}
    </div>
  );

  const historySection = layout === "cards" ? cardsHistory
    : layout === "stepper" ? stepperHistory
    : layout === "minimal" ? minimalHistory
    : classicHistory;

  const commentsSection = data.publicComments.length > 0 && (
    <Card>
      <CardHeader className="pb-3">
        <h3 className="font-semibold">Notas</h3>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.publicComments.map((c, i) => (
            <div key={i} className="p-3 rounded-md bg-muted/50">
              <p className="text-sm">{c.content}</p>
              <p className="text-xs text-muted-foreground mt-1">{formatDate(c.date)}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const tosSection = data.trackingTosText && (
    <div className="text-xs p-3 rounded-md" style={{ backgroundColor: `${primary}10`, color: mutedText }}>
      {data.trackingTosText}
    </div>
  );

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: bgColor, color: textColor }}>
      <div className="max-w-md mx-auto space-y-4">
        {headerSection}
        {orderInfoSection}
        {historySection}
        {commentsSection}
        {tosSection}
        <p className="text-center text-xs py-4" style={{ color: mutedText }}>
          Powered by ORBIA
        </p>
      </div>
    </div>
  );
}
