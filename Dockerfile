# Multi-stage build for optimized production image

# Stage 1: Build
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install all dependencies (including devDependencies for building)
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript backend and Vite frontend
RUN bun run build

# Stage 2: Dependencies
FROM oven/bun:1-alpine AS deps

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install production dependencies only (skip scripts since husky is devDependency)
RUN bun install --frozen-lockfile --production --ignore-scripts

# Stage 3: Production (Bun slim)
FROM oven/bun:1-alpine AS runner

WORKDIR /app

# Set to production
ENV NODE_ENV=production
ENV PORT=3000

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy package.json for runtime
COPY package.json ./

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun run -e "await fetch('http://localhost:3000/health')" || exit 1

# Start the web server
CMD ["bun", "dist/server.js"]
