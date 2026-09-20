# =========================
# STAGE 1: builder
# =========================
FROM node:22-bookworm AS builder

WORKDIR /app

# Strumenti per compilare moduli native (come better-sqlite3)
RUN apt-get update && apt-get install -y python3 g++ make && rm -rf /var/lib/apt/lists/*

# ---- FE: install + build ----
COPY FE/package*.json ./FE/
RUN cd FE && npm install

COPY FE ./FE
RUN cd FE && npm run build -- --configuration=production

# ---- BE: install dipendenze ----
COPY BE/package*.json ./BE/
RUN cd BE && npm install

# Copio il codice BE
COPY BE ./BE

# A questo punto:
# - FE buildato in /app/FE/dist/...
# - BE con node_modules in /app/BE/

# =========================
# STAGE 2: runtime
# =========================
FROM node:22-bookworm-slim

WORKDIR /app

# Copio il BE + node_modules
COPY --from=builder /app/BE ./BE

# Copio la build FE (dist)
COPY --from=builder /app/FE/dist ./FE/dist

# ENV di base
ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app/BE

# Assicurati che ts-node/ts siano in dependencies (non solo dev)
CMD ["npm", "start"]
