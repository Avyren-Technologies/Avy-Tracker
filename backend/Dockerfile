# Use Node.js 20.5.0 LTS image from the official Docker Hub
FROM node:20.5.0-alpine3.18

# Set the working directory inside the container
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files first to leverage Docker cache
COPY package*.json ./

# Install ALL dependencies (including dev dependencies for building)
RUN npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-factor 2 && \
    npm config set registry https://registry.npmjs.org/ && \
    npm ci && \
    npm cache clean --force

# Copy the TypeScript configuration file
COPY tsconfig.json ./

# Copy all source code
COPY . .

# Compile TypeScript to JavaScript
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Copy config folder to dist
COPY src/config ./dist/src/config

# Change ownership to nodejs user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port 8080
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/test', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the server
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]
