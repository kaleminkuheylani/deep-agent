# Deep Agent

PyTorch odaklı interaktif eğitim platformu:
- Kod editörü + lint
- AI asistan
- WebSocket ile training/event stream
- FastAPI backend + React frontend

## Yayına Alma (Docker Compose)

### 1) Ortam değişkenleri
```bash
cp .env.example .env
```

Gerekli alanları düzenleyin:
- `EMERGENT_LLM_KEY` (AI asistan için)
- `CORS_ORIGINS` (prod domain ile sınırlayın)

### 2) Build + up
```bash
docker compose up -d --build
```

### 3) Health kontrolü
```bash
curl http://localhost/api/healthz
```

Beklenen cevap:
```json
{"status":"ok","service":"backend","time":"..."}
```

## Mimari (container)
- `frontend` (Nginx)
  - React build dosyalarını sunar
  - `/api/*` ve `/ws/*` isteklerini backend'e proxyler
- `backend` (FastAPI/Uvicorn)
  - REST + WebSocket endpointleri
- `mongo` (MongoDB)
  - training session verileri

## Notlar (Prod)
- `CORS_ORIGINS=*` yerine domain listesi kullanın.
- Nginx önüne TLS (Let’s Encrypt / Cloudflare) ekleyin.
- Backend için log toplama ve uptime monitörü ekleyin.

## Vercel (Frontend) + Railway (Backend) Ayrı Deploy

### Railway (Backend)
1. Railway'de yeni proje açın ve bu repo'yu bağlayın.
2. Root deploy yerine backend için start command kullanın (repo içinde hazır): `railway.json`.  
3. Railway Variables:
   - `MONGO_URL` (Railway Mongo ya da harici Mongo URI)
   - `DB_NAME` (örn: `deep_agent`)
   - `EMERGENT_LLM_KEY` (opsiyonel ama AI asistan için gerekli)
   - `CORS_ORIGINS` (`https://<vercel-domain>`)
4. Health check: `/api/healthz` (railway.json içinde tanımlı).

### Vercel (Frontend)
1. Vercel'de aynı repo için yeni proje açın, **Root Directory** olarak `frontend` seçin.
2. Vercel env variable ekleyin:
   - `REACT_APP_BACKEND_URL=https://<railway-backend-domain>`
3. Deploy edin.

### Kritik Ayarlar
- Frontend, event/training socket için otomatik `ws/wss` dönüşümü yapar; `REACT_APP_BACKEND_URL` değeri HTTPS ise `wss` kullanılır.
- Railway backend domain değişirse Vercel env’i güncelleyip redeploy yapın.
