# Multi-stage build for optimized production image

# Stage 1: Build
FROM node:23-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for building)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript backend and Vite frontend
RUN npm run build

# Stage 2: Dependencies
FROM node:23-alpine AS deps

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev --ignore-scripts

# Stage 3: Production (distroless)
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runner

WORKDIR /app

# Set to production
ENV NODE_ENV=production
ENV PORT=3000

# Copy dependencies from deps stage
COPY --from=deps --chown=nonroot:nonroot /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder --chown=nonroot:nonroot /app/dist ./dist

# Expose port
EXPOSE 3000

# Note: Distroless doesn't support shell-based healthchecks
# Use external health check or Kubernetes liveness probes

# Start the web server directly (distroless uses nonroot user by default)
CMD ["--no-deprecation", "dist/server.js"]
