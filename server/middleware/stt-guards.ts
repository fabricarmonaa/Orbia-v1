import { Request, Response, NextFunction } from 'express';

interface TenantRateLimitStore {
    requests: number[];
}

const rateLimitStore = new Map<number, TenantRateLimitStore>();
const concurrencyTracker = new Map<number, boolean>();

const STT_RATE_LIMIT_PER_MIN = parseInt(process.env.STT_RATE_LIMIT_PER_MIN || '10');
const STT_CONCURRENCY_PER_TENANT = parseInt(process.env.STT_CONCURRENCY_PER_TENANT || '1');

export function sttRateLimiter(req: Request, res: Response, next: NextFunction) {
    const tenantId = req.auth?.tenantId;

    if (!tenantId) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minuto

    if (!rateLimitStore.has(tenantId)) {
        rateLimitStore.set(tenantId, { requests: [] });
    }

    const store = rateLimitStore.get(tenantId)!;

    // Limpiar requests fuera de ventana
    store.requests = store.requests.filter(timestamp => now - timestamp < windowMs);

    if (store.requests.length >= STT_RATE_LIMIT_PER_MIN) {
        return res.status(429).json({
            error: `Límite de transcripciones alcanzado. Máximo ${STT_RATE_LIMIT_PER_MIN} por minuto.`,
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil((store.requests[0] + windowMs - now) / 1000),
        });
    }

    store.requests.push(now);
    next();
}

export function sttConcurrencyGuard(req: Request, res: Response, next: NextFunction) {
    const tenantId = req.auth?.tenantId;

    if (!tenantId) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    if (STT_CONCURRENCY_PER_TENANT === 0) {
        // Concurrency control disabled
        return next();
    }

    if (concurrencyTracker.get(tenantId)) {
        return res.status(429).json({
            error: 'Ya hay una transcripción en curso. Esperá a que termine.',
            code: 'CONCURRENCY_LIMIT',
        });
    }

    concurrencyTracker.set(tenantId, true);

    // Release lock on response finish
    res.on('finish', () => {
        concurrencyTracker.delete(tenantId);
    });

    res.on('close', () => {
        concurrencyTracker.delete(tenantId);
    });

    next();
}

export function validateSttPayload(req: Request, res: Response, next: NextFunction) {
    const { audio, context } = req.body;

    if (!audio || typeof audio !== 'string') {
        return res.status(400).json({ error: 'Audio base64 requerido' });
    }

    // CRITICAL: Validate size BEFORE any processing to avoid DoS
    const MAX_AUDIO_SIZE = parseInt(process.env.STT_MAX_BASE64_BYTES || '2000000'); // 2MB default

    if (audio.length > MAX_AUDIO_SIZE) {
        const maxSizeMB = (MAX_AUDIO_SIZE / 1024 / 1024).toFixed(1);
        return res.status(413).json({
            error: `Audio demasiado largo. Máximo ${maxSizeMB}MB (aproximadamente 30 segundos).`,
            code: 'PAYLOAD_TOO_LARGE',
            maxSizeBytes: MAX_AUDIO_SIZE,
        });
    }

    const validContexts = ['orders', 'cash', 'products'];
    if (!context || !validContexts.includes(context)) {
        return res.status(400).json({
            error: 'Contexto inválido',
            validContexts
        });
    }

    next();
}
