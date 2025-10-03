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

# Stage 3: Production
FROM node:23-alpine AS runner

WORKDIR /app

# Set to production
ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 ynabuser

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder --chown=ynabuser:nodejs /app/dist ./dist
COPY --from=builder --chown=ynabuser:nodejs /app/package*.json ./

# Switch to non-root user
USER ynabuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the web server
CMD ["npm", "run", "web"]
