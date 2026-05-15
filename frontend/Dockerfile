# ── Build stage ────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# `env_file` en docker-compose solo inyecta variables en el contenedor al ARRANCAR
# (aquí nginx no usa Vite). `vite build` corre en esta fase y necesita `VITE_*`
# ya definidas: `.env` no entra en el contexto de build (.dockerignore).
ENV VITE_BASE_PATH=/orcid2sword/
RUN npm run build

# ── Serve stage ────────────────────────────────────────────────
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /app/dist

EXPOSE 5173
CMD ["nginx", "-g", "daemon off;"]
