import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Receipt } from "lucide-react";
import { useLocation } from "wouter";

export function OperationsSettings() {
  const [, setLocation] = useLocation();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <h3 className="font-semibold">Caja</h3>
          <p className="text-sm text-muted-foreground">Movimientos y sesiones de caja</p>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setLocation("/app/cash")}>
            <Wallet className="w-4 h-4 mr-2" />
            Ir a Caja
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <h3 className="font-semibold">Gastos</h3>
          <p className="text-sm text-muted-foreground">Configura gastos fijos y variables desde Caja</p>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => setLocation("/app/cash")}>
            <Receipt className="w-4 h-4 mr-2" />
            Configurar gastos
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
