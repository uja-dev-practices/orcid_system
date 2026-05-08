# ORCID SWORD System

<div align="center">

![FastAPI](https://img.shields.io/badge/FastAPI-109989?style=for-the-badge&logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-D82C20?style=for-the-badge&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-0db7ed?style=for-the-badge&logo=docker&logoColor=white)
![ORCID OAuth](https://img.shields.io/badge/OAuth2-ORCID-A6CE39?style=for-the-badge)

</div>

<div align="center">
  <strong>Full-stack platform for ORCID authentication, researcher synchronization, and publication export in SWORD XML / ZIP formats.</strong>
</div>

---

## ![certificate](https://www.readmecodegen.com/api/social-icon?name=certificate&size=20&color=%238b5cf6). Overview: What is this project meant

`orcid-system` is designed for research workflows where ORCID data must be ingested, normalized, and exported.

Core capabilities:

- ORCID OAuth 3-legged login
- researcher search and synchronization against ORCID
- publication export by selection or by researcher
- export formats: **SWORD XML** and **ZIP**
- dual access model: user JWT or service API key (for export)

> [!NOTE]
> The stack is local-first with Docker, but includes production-oriented hardening (CORS policy, trusted hosts, security headers, rate limiting, etc.).

---

## ![certificate](https://www.readmecodegen.com/api/social-icon?name=certificate&size=20&color=%238b5cf6). Tech Stack

### Backend
- FastAPI
- SQLAlchemy
- PostgreSQL
- Redis
- python-jose (JWT)
- slowapi (rate limit)
- APScheduler
- httpx

### Frontend
- React 19
- Vite 8
- React Router
- TailwindCSS 4
- Sonner (notifications)

### Infrastructure
- Docker / Docker Compose

---

## ![certificate](https://www.readmecodegen.com/api/social-icon?name=certificate&size=20&color=%238b5cf6). Quick Start

From the project root:

```bash
docker compose down
docker compose up --build
```

Default local URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`

> [!IMPORTANT]
> Current compose mapping uses loopback binding:
> - `127.0.0.1:5173:5173`
> - `127.0.0.1:8000:8000`  
> This means services are reachable from the host machine, not exposed publicly by default.

---

## ![certificate](https://www.readmecodegen.com/api/social-icon?name=certificate&size=20&color=%238b5cf6). Environment Configuration

Backend:
- Main file: `backend/.env`
- Reference: `backend/.env.example`

Frontend:
- Compose/dev file: `frontend/.env`
- Optional local override for host dev: `frontend/.env.local`

Important backend variables:

- `ORCID_CLIENT_ID`
- `ORCID_CLIENT_SECRET`
- `ORCID_REDIRECT_URI`
- `JWT_SECRET`
- `API_KEY_NAME`
- `API_KEY_VALUE`
- `CORS_ALLOWED_ORIGINS`
- `TRUSTED_HOSTS`
- `DATABASE_URL`
- `REDIS_URL`

Important frontend variables:

- `VITE_API_URL` (empty in Docker setup, so Vite proxy handles `/api`)
- `VITE_API_PROXY_TARGET` (defaults to `http://backend:8000` in compose network)
- `VITE_API_KEY` (must match backend `API_KEY_VALUE` when using API key mode)
- `VITE_USE_MOCKS`
- `VITE_ORCID_PUBLIC_API_BASE` (optional override)

> [!WARNING]
> Never commit real production secrets. Rotate `JWT_SECRET`, `API_KEY_VALUE`, and `ORCID_CLIENT_SECRET` before deployment.

---

## ![certificate](https://www.readmecodegen.com/api/social-icon?name=certificate&size=20&color=%238b5cf6). ngrok Bridge for Local OAuth Callback

To test OAuth callback from ORCID in local environments, compose can inject a public callback URL:

```yaml
environment:
  ORCID_REDIRECT_URI: https://jargon-supreme-palpable.ngrok-free.dev/callback
```

> [!NOTE]
> Values under `docker-compose.yml -> services.backend.environment` override `backend/.env` inside the container.

---

## ![certificate](https://www.readmecodegen.com/api/social-icon?name=certificate&size=20&color=%238b5cf6). API Endpoints

Base backend URL: `http://localhost:8000`

| Module | Method | Endpoint | Auth | Parameters | Body | Notes |
| :--- | :---: | :--- | :--- | :--- | :--- | ---: |
| Health | `GET` | `/health` | None | None | None | Liveness check |
| ORCID Auth | `GET` | `/api/auth/orcid/authorize` | None | None | None | Redirects to ORCID |
| ORCID Auth | `GET` | `/api/auth/orcid/callback` | None | `code`, `state` | None | Exchanges OAuth code for backend JWT |
| ORCID Auth | `GET` | `/callback` | None | `code`, `state` | None | Alias for callback flow |
| Researchers | `POST` | `/api/researchers/search` | Optional Bearer | None | `{"orcid_ids":[...]}` | Batch search/sync |
| Researchers | `POST` | `/api/researchers/{orcid_id}/sync` | Optional Bearer | `orcid_id` | None | Full sync of one researcher |
| Export SWORD | `POST` | `/api/export/sword/publications` | Bearer or API key | None | `["publication_uuid", ...]` | Export selected publications |
| Export SWORD | `GET` | `/api/export/sword/researcher/{orcid_id}` | Bearer or API key | `orcid_id` | None | Export all by researcher |
| Export ZIP | `POST` | `/api/export/zip/publications` | Bearer or API key | None | `["publication_uuid", ...]` | Export selected publications |
| Export ZIP | `GET` | `/api/export/zip/researcher/{orcid_id}` | Bearer or API key | `orcid_id` | None | Export all by researcher |

> [!IMPORTANT]
> `.../publications` endpoints require **publication IDs**, not `researcher.id`.

---

## ![certificate](https://www.readmecodegen.com/api/social-icon?name=certificate&size=20&color=%238b5cf6). Request Examples

### Health
```bash
curl http://localhost:8000/health
```

### Search one or more researchers
```bash
curl -X POST "http://localhost:8000/api/researchers/search" \
  -H "Content-Type: application/json" \
  -d "{\"orcid_ids\":[\"0009-0000-0793-5376\"]}"
```

### Sync one researcher
```bash
curl -X POST "http://localhost:8000/api/researchers/0009-0000-0793-5376/sync"
```

### Export SWORD by researcher (API key mode)
```bash
curl "http://localhost:8000/api/export/sword/researcher/0009-0000-0793-5376" \
  -H "X-API-Key: YOUR_API_KEY" \
  -o sword.xml
```

### Export ZIP by publication IDs (Bearer mode)
```bash
curl -X POST "http://localhost:8000/api/export/zip/publications" \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d "[\"04f6a2a6-b753-4432-982b-b88160f627fe\"]" \
  -o export.zip
```

---

## ![certificate](https://www.readmecodegen.com/api/social-icon?name=certificate&size=20&color=%238b5cf6). Security Controls

Implemented controls in backend:

- strict CORS allowlist
- trusted host filtering
- request body size limit
- OAuth `state` validation
- JWT validation with issuer/audience claims
- API key validation via constant-time comparison
- rate limiting
- security headers middleware
- non-root container and reduced privileges

> [!WARNING]
> For production, enforce HTTPS behind a reverse proxy and set concrete values for `CORS_ALLOWED_ORIGINS` and `TRUSTED_HOSTS`.

---

## ![certificate](https://www.readmecodegen.com/api/social-icon?name=certificate&size=20&color=%238b5cf6). Frontend Details

The frontend is a React SPA using route-based navigation and a centralized API client.

### Frontend routing

- `/` → landing page
- `/dashboard/:orcid` → researcher dashboard
- `/group` → multi-researcher results
- `/callback` → OAuth callback handler

### Frontend API behavior (`frontend/src/services/api.js`)

- central HTTP wrapper with `ApiError`
- includes `X-API-Key` on requests when configured
- includes `Authorization: Bearer <token>` when token exists in `localStorage`
- supports mock mode through `VITE_USE_MOCKS`
- supports Vite proxy mode when `VITE_API_URL` is empty

### Vite proxy (`frontend/vite.config.js`)

- `/api` proxied to `VITE_API_PROXY_TARGET` (`http://backend:8000` in compose)
- `/health` proxied to same target
- dev host settings allow tunnel scenarios (ngrok callback testing)

---

## ![certificate](https://www.readmecodegen.com/api/social-icon?name=certificate&size=20&color=%238b5cf6). Project Structure

```text
orcid-system/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth.py
│   │   │   ├── researchers.py
│   │   │   └── export.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── rate_limit.py
│   │   │   ├── security_headers.py
│   │   │   ├── error_handlers.py
│   │   │   └── body_size.py
│   │   ├── db/
│   │   │   ├── models.py
│   │   │   ├── session.py
│   │   │   └── repositories/
│   │   ├── security/
│   │   │   ├── jwt.py
│   │   │   ├── api_key.py
│   │   │   └── oauth_state.py
│   │   ├── services/
│   │   │   ├── orcid_client.py
│   │   │   ├── sword_generator.py
│   │   │   ├── zip_generator.py
│   │   │   └── sync_service.py
│   │   ├── utils/
│   │   └── main.py
│   ├── .env
│   ├── .env.example
│   ├── .env.production
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── dashboard/
│   │   │   ├── layout/
│   │   │   └── ui/
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── GroupResultsPage.jsx
│   │   │   └── AuthCallbackPage.jsx
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   └── mocks.js
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env
│   ├── package.json
│   ├── vite.config.js
│   └── eslint.config.js
├── docker-compose.yml
└── README.md
```

---

## ![certificate](https://www.readmecodegen.com/api/social-icon?name=certificate&size=20&color=%238b5cf6). Production Checklist

- [ ] `ENVIRONMENT=production`
- [ ] `DEBUG=false`
- [ ] rotate all secrets
- [ ] define strict `CORS_ALLOWED_ORIGINS`
- [ ] define strict `TRUSTED_HOSTS`
- [ ] enforce HTTPS via reverse proxy
- [ ] keep DB/Redis private
- [ ] configure monitoring and backups

---

## ![github](https://www.readmecodegen.com/api/social-icon?name=github&size=20&color=%238b5cf6). Authors and Team

This project is the result of the collaboration with the **University of Jaén**.

| Role | Developer | GitHub |
| :--- | :--- | :--- |
| **Frontend** | Alexis López Moral | [@AlexisLopez-Dev](https://github.com/AlexisLopez-Dev) |
| **Backend** | Mireya Cueto Garrido | [@MireyaCueto](https://github.com/MireyaCueto) |

### Direction
* **Proyect Supervisor:** Luis Martínez López

---

<p align="center">
  Built with professional care and ❤️ for secure research data workflows at the University of Jaén.
</p>
