# Deep Agent Monorepo

Bu repo başlangıçta `frontend/` ve `backend/` klasörlerini birlikte içerir.
Bu adımda backend'i ayrı bir repoya taşımayı kolaylaştırmak için bir ayırma (split)
script'i eklendi.

## Klasör yapısı

- `frontend/`: React uygulaması
- `backend/`: FastAPI servisi
- `scripts/split_backend_repo.sh`: `backend/` klasörünü geçmişiyle ayrı repoya çıkarır

## 1) Backend'i ayrı repoya çıkarma

Önce yeni backend reposunu oluşturun (ör. GitHub: `deep-agent-backend`), sonra:

```bash
scripts/split_backend_repo.sh <NEW_BACKEND_REPO_URL>
```

Örnek:

```bash
scripts/split_backend_repo.sh git@github.com:your-org/deep-agent-backend.git
```

Bu script:

1. `backend/` klasörünü geçmişiyle `git subtree split` ile ayırır,
2. geçici bir repoya import eder,
3. hedef remote'a `main` branch olarak push eder.

## 2) Frontend'i yeni backend URL'ine bağlama

`frontend/.env` dosyası oluşturun:

```bash
REACT_APP_BACKEND_URL=https://your-backend-domain
```

Eğer bu değer yoksa uygulama default olarak `http://localhost:8000` kullanır.

## 3) Railway önerilen kurulum

- Railway Project A: `deep-agent-backend` (FastAPI)
- Railway Project B: `deep-agent-frontend` (React build + serve)
- Frontend env var: `REACT_APP_BACKEND_URL=<backend-public-url>`
- Backend CORS: frontend domain'ini allow list'e ekleyin

## Lokal geliştirme

Backend:

```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm start
```
