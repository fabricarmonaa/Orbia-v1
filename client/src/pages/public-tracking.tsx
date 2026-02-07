import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PackageSearch, Clock, CheckCircle2, AlertCircle } from "lucide-react";

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

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto space-y-4">
        <div className="text-center py-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-md bg-primary mb-3">
            <PackageSearch className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-bold tracking-tight">Seguimiento</h1>
          {data.businessName && (
            <p className="text-sm text-muted-foreground">{data.businessName}</p>
          )}
        </div>

        <Card>
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

        {data.history.length > 0 && (
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
        )}

        {data.publicComments.length > 0 && (
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
        )}

        <p className="text-center text-xs text-muted-foreground py-4">
          Powered by ORBIA
        </p>
      </div>
    </div>
  );
}
