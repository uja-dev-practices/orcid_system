# ── Build stage ────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build             # genera dist/ con base=/orcid2words/

# ── Serve stage ────────────────────────────────────────────────
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /app/dist

EXPOSE 5173
CMD ["nginx", "-g", "daemon off;"]
