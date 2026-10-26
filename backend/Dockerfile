# =========================================================================
# DataForge Backend — Production Alpine Container
# Base Image: Node.js 20 on Alpine Linux (Minimal CVE footprint)
# =========================================================================

FROM node:20-alpine

# Create application directory
WORKDIR /usr/src/app

# Install production dependencies with caching
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy application source code with unprivileged user ownership
COPY --chown=node:node . .

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Switch to unprivileged node user
USER node

# Expose application port
EXPOSE 5000

# Built-in zero-dependency container health check using Node.js fetch
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 5000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Launch DataForge Express server
CMD ["node", "server.js"]
