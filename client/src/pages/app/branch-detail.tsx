import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { apiRequest } from "@/lib/auth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Phone,
  ClipboardList,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Branch, Order, CashMovement } from "@shared/schema";

export default function BranchDetailPage() {
  const params = useParams<{ branchId: string }>();
  const [, setLocation] = useLocation();
  const branchId = params?.branchId;
  const [branch, setBranch] = useState<Branch | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (branchId) fetchData();
  }, [branchId]);

  async function fetchData() {
    try {
      const [branchesRes, ordersRes, movementsRes] = await Promise.all([
        apiRequest("GET", "/api/branches"),
        apiRequest("GET", `/api/branches/${branchId}/orders`),
        apiRequest("GET", `/api/branches/${branchId}/cash/movements`),
      ]);
      const branchesData = await branchesRes.json();
      const ordersData = await ordersRes.json();
      const movementsData = await movementsRes.json();

      const found = (branchesData.data || []).find(
        (b: Branch) => b.id === parseInt(branchId!)
      );
      setBranch(found || null);
      setOrders(ordersData.data || []);
      setMovements(movementsData.data || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function formatDate(d: string | Date | null) {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-md" />
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setLocation("/app/branches")} data-testid="button-back-branches">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">Sucursal no encontrada</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalIncome = movements
    .filter((m) => m.type === "ingreso")
    .reduce((acc, m) => acc + parseFloat(m.amount), 0);
  const totalExpense = movements
    .filter((m) => m.type === "egreso")
    .reduce((acc, m) => acc + parseFloat(m.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" onClick={() => setLocation("/app/branches")} data-testid="button-back-branches">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-md bg-primary/10">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-branch-name">
              {branch.name}
            </h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
              {branch.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {branch.address}
                </span>
              )}
              {branch.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {branch.phone}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">Pedidos</p>
              <ClipboardList className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold mt-1" data-testid="text-branch-orders-count">{orders.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">Ingresos</p>
              <ArrowUpRight className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold mt-1 text-green-600" data-testid="text-branch-income">
              ${totalIncome.toLocaleString("es-AR")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">Egresos</p>
              <ArrowDownRight className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-2xl font-bold mt-1 text-red-600" data-testid="text-branch-expense">
              ${totalExpense.toLocaleString("es-AR")}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders" data-testid="tab-branch-orders">
            Pedidos ({orders.length})
          </TabsTrigger>
          <TabsTrigger value="cash" data-testid="tab-branch-cash">
            Movimientos ({movements.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-4">
          {orders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ClipboardList className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Sin pedidos en esta sucursal</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {orders.map((order) => (
                <Card key={order.id} data-testid={`card-branch-order-${order.id}`}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{order.customerName}</p>
                          <Badge variant="outline">{order.type}</Badge>
                          <span className="text-xs text-muted-foreground">#{order.orderNumber}</span>
                        </div>
                        {order.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                            {order.description}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold">
                          ${order.totalAmount ? parseFloat(order.totalAmount).toLocaleString("es-AR") : "0"}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="cash" className="mt-4">
          {movements.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Wallet className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Sin movimientos en esta sucursal</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {movements.map((mov) => (
                <Card key={mov.id} data-testid={`card-branch-movement-${mov.id}`}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        {mov.type === "ingreso" ? (
                          <ArrowUpRight className="w-5 h-5 text-green-500 flex-shrink-0" />
                        ) : (
                          <ArrowDownRight className="w-5 h-5 text-red-500 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium capitalize">{mov.type}</p>
                            {mov.category && <Badge variant="secondary">{mov.category}</Badge>}
                            {mov.method && (
                              <span className="text-xs text-muted-foreground capitalize">{mov.method}</span>
                            )}
                          </div>
                          {mov.description && (
                            <p className="text-sm text-muted-foreground mt-1 truncate">{mov.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-bold ${mov.type === "ingreso" ? "text-green-600" : "text-red-600"}`}>
                          {mov.type === "ingreso" ? "+" : "-"}${parseFloat(mov.amount).toLocaleString("es-AR")}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDate(mov.createdAt)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
