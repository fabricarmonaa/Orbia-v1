import { useState, useCallback } from "react";
import { useVoiceRecorder } from "../../replit_integrations/audio/useVoiceRecorder";
import { apiRequest } from "@/lib/auth";
import { usePlan } from "@/lib/plan";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, Square, Loader2, Check, X, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export type VoiceContext = "orders" | "cash" | "products";

interface VoiceCommandProps {
  context: VoiceContext;
  onConfirm: (intent: any) => void;
  onCancel?: () => void;
}

interface SttResult {
  transcription: string;
  intent: any;
  context: string;
}

export function VoiceCommand({ context, onConfirm, onCancel }: VoiceCommandProps) {
  const { hasFeature } = usePlan();
  const { state: recState, startRecording, stopRecording } = useVoiceRecorder();
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<SttResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const canUseSTT = hasFeature("stt");

  const handleToggleRecording = useCallback(async () => {
    setError(null);
    if (recState === "recording") {
      setProcessing(true);
      try {
        const blob = await stopRecording();
        if (blob.size === 0) {
          setError("No se grabó audio");
          setProcessing(false);
          return;
        }
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
        );

        const res = await apiRequest("POST", "/api/ai/stt", {
          audio: base64,
          context,
        });
        const data = await res.json();
        setResult(data.data);
      } catch (err: any) {
        let msg = "Error procesando el audio";
        try {
          const parsed = JSON.parse(err.message.split(": ").slice(1).join(": "));
          msg = parsed.error || msg;
        } catch {
          if (err.message) msg = err.message;
        }
        setError(msg);
      } finally {
        setProcessing(false);
      }
    } else {
      try {
        await startRecording();
      } catch {
        setError("No se pudo acceder al micrófono. Verificá los permisos del navegador.");
      }
    }
  }, [recState, stopRecording, startRecording, context]);

  const handleConfirm = useCallback(() => {
    if (result?.intent) {
      onConfirm(result.intent);
      setResult(null);
    }
  }, [result, onConfirm]);

  const handleRetry = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  if (!canUseSTT) return null;

  const contextLabels: Record<VoiceContext, string> = {
    orders: "pedido",
    cash: "movimiento",
    products: "producto",
  };

  return (
    <div className="space-y-3" data-testid="voice-command-container">
      {!result && !error && (
        <div className="flex items-center gap-2">
          <Button
            variant={recState === "recording" ? "destructive" : "outline"}
            size="sm"
            onClick={handleToggleRecording}
            disabled={processing}
            data-testid="button-voice-toggle"
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Procesando...
              </>
            ) : recState === "recording" ? (
              <>
                <Square className="w-4 h-4 mr-1" />
                Detener
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 mr-1" />
                Dictar {contextLabels[context]}
              </>
            )}
          </Button>
          {recState === "recording" && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-xs text-muted-foreground">Grabando...</span>
            </div>
          )}
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel} data-testid="button-voice-cancel">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}

      {error && (
        <Card className="border-destructive/30">
          <CardContent className="py-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button variant="outline" size="sm" onClick={handleRetry} data-testid="button-voice-retry">
                Reintentar
              </Button>
              {onCancel && (
                <Button variant="ghost" size="sm" onClick={onCancel}>
                  Cancelar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="border-primary/30">
          <CardContent className="py-4 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Transcripción:</p>
              <p className="text-sm italic" data-testid="text-transcription">
                "{result.transcription}"
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Datos detectados:</p>
              <div className="flex flex-wrap gap-1.5" data-testid="intent-tags">
                {result.intent && typeof result.intent === "object" && !result.intent.raw ? (
                  Object.entries(result.intent)
                    .filter(([k]) => k !== "action")
                    .map(([key, val]) => (
                      <Badge key={key} variant="secondary" className="text-xs">
                        {formatIntentKey(key)}: {String(val)}
                      </Badge>
                    ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No se pudieron extraer datos estructurados
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleConfirm} data-testid="button-voice-confirm">
                <Check className="w-4 h-4 mr-1" />
                Confirmar
              </Button>
              <Button variant="outline" size="sm" onClick={handleRetry} data-testid="button-voice-retry">
                <Mic className="w-4 h-4 mr-1" />
                Reintentar
              </Button>
              {onCancel && (
                <Button variant="ghost" size="sm" onClick={() => { setResult(null); onCancel(); }}>
                  Cancelar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatIntentKey(key: string): string {
  const map: Record<string, string> = {
    customerName: "Cliente",
    customerPhone: "Teléfono",
    description: "Descripción",
    totalAmount: "Monto",
    type: "Tipo",
    amount: "Monto",
    method: "Método",
    category: "Categoría",
    name: "Nombre",
    price: "Precio",
    cost: "Costo",
    stock: "Stock",
    sku: "SKU",
  };
  return map[key] || key;
}
