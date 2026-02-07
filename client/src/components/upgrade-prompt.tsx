import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, ArrowUpRight } from "lucide-react";
import { usePlan } from "@/lib/plan";

interface UpgradePromptProps {
  feature: string;
  title: string;
  description: string;
}

const featureNames: Record<string, string> = {
  products: "Productos",
  branches: "Sucursales",
  cash_sessions: "Caja con Sesiones",
  fixed_expenses: "Gastos Fijos",
  variable_expenses: "Gastos Variables",
  reports_advanced: "Reportes Avanzados",
  stt: "Voz IA (STT)",
};

const planUpgradeSuggestions: Record<string, string> = {
  ECONOMICO: "Profesional",
  PROFESIONAL: "Escala",
};

export function UpgradePrompt({ feature, title, description }: UpgradePromptProps) {
  const { plan } = usePlan();
  const suggestedPlan = plan ? planUpgradeSuggestions[plan.planCode] || "superior" : "superior";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
      <Card>
        <CardContent className="py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2" data-testid="text-upgrade-title">
            Funcionalidad no disponible
          </h3>
          <p className="text-muted-foreground mb-4 max-w-md mx-auto">
            La funcionalidad de <strong>{featureNames[feature] || feature}</strong> no está
            incluida en tu plan actual
            {plan && (
              <>
                {" "}
                <Badge variant="secondary">{plan.name}</Badge>
              </>
            )}
            .
          </p>
          <div className="inline-flex items-center gap-2 text-sm text-primary font-medium">
            <ArrowUpRight className="w-4 h-4" />
            <span data-testid="text-upgrade-suggestion">
              Mejorá al plan {suggestedPlan} para acceder
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
