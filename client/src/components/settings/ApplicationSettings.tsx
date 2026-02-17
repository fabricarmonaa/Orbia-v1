import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { usePwaInstall } from "@/lib/pwa-install";

export function ApplicationSettings() {
  const { canInstall, isInstalled, install, platformHint } = usePwaInstall();

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold">Aplicación</h3>
        <p className="text-sm text-muted-foreground">Instalá Orbia para abrirla rápido desde tu dispositivo.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isInstalled ? (
          <p className="text-sm font-medium">Orbia ya está instalada ✅</p>
        ) : canInstall ? (
          <>
            <p className="text-sm text-muted-foreground">Instalá Orbia en tu celular para acceso rápido.</p>
            <Button type="button" onClick={() => void install()}>
              Descargar app
            </Button>
          </>
        ) : platformHint === "ios" ? (
          <p className="text-sm text-muted-foreground">Para instalar en iPhone: Compartir → Agregar a pantalla de inicio.</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Este navegador no permite instalar la app desde aquí. Probá en Chrome, Edge o Brave.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
