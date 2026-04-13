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
