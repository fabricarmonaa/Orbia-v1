export type ApiErrorInfo = {
  message: string;
  code?: string;
  status: number;
};

const DEFAULT_MESSAGES: Record<string, string> = {
  TOKEN_REQUIRED: "Tu sesión expiró. Volvé a iniciar sesión.",
  PERMISSION_DENIED: "No tenés permisos para realizar esta acción.",
};

function formatMaxMb(bytes?: number) {
  if (!bytes) return null;
  const mb = bytes / (1024 * 1024);
  return mb % 1 === 0 ? String(mb) : mb.toFixed(1);
}

export async function parseApiError(
  res: Response,
  options?: { maxUploadBytes?: number }
): Promise<ApiErrorInfo> {
  const raw = await res.text();
  let parsed: any = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  const code = parsed?.code;
  const fallbackMessage = parsed?.error || parsed?.message || raw || res.statusText;
  let message = fallbackMessage;

  if (res.status === 401 || code === "TOKEN_REQUIRED") {
    message = DEFAULT_MESSAGES.TOKEN_REQUIRED;
  } else if (code && DEFAULT_MESSAGES[code]) {
    message = DEFAULT_MESSAGES[code];
  } else if (code === "UPLOAD_TOO_LARGE") {
    const maxMb = formatMaxMb(options?.maxUploadBytes);
    message = maxMb
      ? `Archivo demasiado grande. Máximo ${maxMb} MB.`
      : "Archivo demasiado grande. Verificá el tamaño permitido.";
  }

  return { message, code, status: res.status };
}
