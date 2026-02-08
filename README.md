# Orbia SaaS — Multi-tenant Order & Cash Management

**Stack**: Node.js/Express + PostgreSQL + React + Python AI Service  
**Deployment**: Railway Hobby Plan

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 20+
- PostgreSQL 16+
- Python 3.11+ (for AI service)
- ffmpeg (for audio conversion)

### Setup

1. **Clone & Install**
```bash
git clone <repo-url>
cd Orbia-Orbiter
npm install
```

2. **Configure Environment**
```bash
cp .env.example .env
# Edit .env with your DATABASE_URL and secrets
```

3. **Database Setup**
```bash
npm run db:push
```

4. **Start Backend**
```bash
npm run dev
```

5. **Start AI Service** (separate terminal)
```bash
cd ai-service
pip install -r requirements.txt
python main.py
```

6. **Access**
- Frontend: http://localhost:5173
- Backend: http://localhost:5000
- AI Service: http://localhost:8001

---

## 🔒 STT Security & Cost Controls

**Implemented protections for Railway Hobby deployment**:

- ✅ **Rate Limiting**: 10 requests/min per tenant (configurable via `STT_RATE_LIMIT_PER_MIN`)
- ✅ **Concurrency Guard**: 1 concurrent transcription per tenant (prevents parallel abuse)
- ✅ **Payload Validation**: Max 2MB audio (~30 seconds)
- ✅ **Zero RAM Persistence**: Whisper model loads per-request in subprocess and exits
- ✅ **Strict Timeouts**: 25s worker timeout + 30s backend timeout
- ✅ **Process Isolation**: Subprocess killed on timeout (no zombie processes)

**Railway Hobby Estimate**: $5-15/month with normal usage

**Variables** (set in Railway):
```bash
STT_RATE_LIMIT_PER_MIN=10
STT_CONCURRENCY_PER_TENANT=1
STT_MAX_BASE64_BYTES=2000000
AI_WORKER_TIMEOUT_SECONDS=25
WHISPER_MODEL=base
```

---

## 📦 Railway Deployment

### Step 1: Create Railway Project

1. Go to [railway.app](https://railway.app)
2. Create new project
3. Add **3 services**:
   - PostgreSQL (from template)
   - Backend (Node.js)
   - AI Service (Python)

### Step 2: PostgreSQL Service

- Select "PostgreSQL" from templates
- Railway auto-generates `DATABASE_URL`
- No additional config needed

### Step 3: Backend Service

**Settings → Build**:
- Build Command: `npm run build`
- Start Command: `npm start`

**Variables**:
```bash
DATABASE_URL=${{Postgres.DATABASE_URL}}
PORT=5000
NODE_ENV=production
SESSION_SECRET=<generate-random-secret>
AI_SERVICE_URL=${{AiService.RAILWAY_PUBLIC_DOMAIN}}
STT_RATE_LIMIT_PER_MIN=10
STT_CONCURRENCY_PER_TENANT=1
STT_MAX_BASE64_BYTES=2000000
```

**Networking**:
- Enable "Public Domain"
- Copy domain for frontend `VITE_API_URL`

### Step 4: AI Service

**Settings → Build**:
- Root Directory: `ai-service`
- Build Command: `pip install -r requirements.txt`
- Start Command: `python main.py`

**Variables**:
```bash
AI_SERVICE_PORT=8001
AI_WORKER_TIMEOUT_SECONDS=25
WHISPER_MODEL=base
FRONTEND_URL=https://your-backend-domain.railway.app
```

**Networking**:
- Enable "Private Networking" (backend will access via private URL)
- Optionally enable "Public Domain" for health checks

**System Packages** (Settings → Apt Packages):
```
ffmpeg
```

### Step 5: Frontend Build

Frontend is served by backend in `/dist` after build.

Update local `.env` for build:
```bash
# .env (local, for build)
VITE_API_URL=https://your-backend-domain.railway.app
```

Build locally and commit:
```bash
npm run build
git add dist/
git commit -m "Add production build"
git push
```

Or configure Railway to build frontend:
```bash
# In Backend service settings
Build Command: npm run build && npm run build:client
```

---

## ✅ Pre-Deployment Checklist

**Security**:
- [ ] `SESSION_SECRET` is random and secure
- [ ] `DATABASE_URL` uses SSL (Railway default)
- [ ] Rate limits configured (`STT_RATE_LIMIT_PER_MIN=10`)
- [ ] Payload limits set (`STT_MAX_BASE64_BYTES=2000000`)
- [ ] CORS restricted (`FRONTEND_URL` not `*`)

**STT Zero-RAM**:
- [ ] `worker_transcribe.py` exists in `ai-service/`
- [ ] `main.py` uses subprocess pattern (no global model)
- [ ] `AI_WORKER_TIMEOUT_SECONDS=25` set
- [ ] ffmpeg installed in AI service

**Configuration**:
- [ ] All env vars set in Railway
- [ ] `WHISPER_MODEL=base` (or `tiny` for lower cost)
- [ ] Frontend build includes correct `VITE_API_URL`

**Testing**:
- [run] Test STT locally before deploy
- [ ] Verify subprocess kills after timeout
- [ ] Check rate limit (make 11 requests in 1 min)
- [ ] Test with 3MB audio (should reject with 413)

---

## 🧪 Local Testing (Before Deploy)

### Test 1: STT Rate Limit
```bash
# Make 11 requests quickly
for i in {1..11}; do
  curl -X POST http://localhost:5000/api/ai/stt \
    -H "Authorization: Bearer <token>" \
    -H "Content-Type: application/json" \
    -d '{"audio":"...","context":"orders"}' &
done
# Expected: 11th request returns 429
```

### Test 2: Payload Too Large
```bash
# Create 3MB base64 audio (will be rejected)
dd if=/dev/zero bs=1M count=3 | base64 > large_audio.txt
curl -X POST http://localhost:5000/api/ai/stt \
  -H "Authorization: Bearer <token>" \
  -d '{"audio":"'$(cat large_audio.txt)'","context":"orders"}'
# Expected: 413 Payload Too Large
```

### Test 3: Zero RAM (check process memory)
```bash
# Before STT request
ps aux | grep python | grep worker
# (should be empty)

# Make STT request via frontend or curl

# After STT request completes
ps aux | grep python | grep worker
# (should still be empty - subprocess exited)
```

### Test 4: Timeout Kill
```bash
# Set AI_WORKER_TIMEOUT_SECONDS=5
# Send very long audio (>30s)
# Expected: 504 timeout after ~5s, subprocess killed
```

---

## 📊 Monitoring (Railway)

**Metrics to watch**:
- **CPU Usage**: Spikes during STT (normal), should drop to ~0% after
- **RAM Usage**: 
  - Backend: ~200-300MB steady
  - AI Service: ~100MB idle, spikes to ~400MB during transcription, drops back
- **Response Times**: `/api/ai/stt` = 3-10s (normal)

**Cost alerts**:
- Set Railway budget alert at $20/month
- If CPU/RAM stays high constantly → check for zombie processes

---

## 🛠️ Troubleshooting

**"AI service unavailable" (503)**:
- Check AI service is running in Railway
- Verify `AI_SERVICE_URL` points to private network URL
- Check AI service logs

**"Timeout" (504)**:
- Audio too long (>30s)
- Increase `AI_WORKER_TIMEOUT_SECONDS` (max 30)

**"Rate limit exceeded" (429)**:
- Normal if user making many requests
- Increase `STT_RATE_LIMIT_PER_MIN` if needed for production load

**High RAM usage**:
- If AI service RAM doesn't drop after transcription → subprocess not exiting
- Check `ps aux` in Railway shell
- Verify `worker_transcribe.py` has `sys.exit()`

**ffmpeg errors**:
- Ensure apt package `ffmpeg` installed in AI service
- Check Railway build logs

---

## 📝 Features

✅ Multi-tenant with branch scoping  
✅ Products, Orders, Cash management  
✅ Fixed/Variable expenses tracking  
✅ Delivery addon with route management  
✅ STT (Speech-to-Text) for voice commands  
✅ Audit logging + granular permissions  

---

## 📄 License

MIT
