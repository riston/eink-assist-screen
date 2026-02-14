# Stage 1: Build
FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

# Stage 2: Production
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json* ./
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
RUN npm ci --omit=dev

COPY --from=builder /app/dist/ dist/
COPY templates/ templates/
COPY config/ config/
COPY run.sh ./

RUN chmod +x run.sh && mkdir -p /data

ENV BASE_HOST=0.0.0.0
ENV BASE_PORT=8000
ENV TEMPLATES_DIR=/data/templates

EXPOSE 8000

ENTRYPOINT ["/app/run.sh"]
