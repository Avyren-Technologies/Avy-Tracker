# Use Node.js 20.5.0 LTS image from the official Docker Hub
FROM node:20.5.0-alpine3.18

# Set the working directory inside the container
WORKDIR /app

# Copy backend package.json and package-lock.json first to leverage Docker cache
COPY backend/package.json backend/package-lock.json ./
COPY backend/tsconfig.json ./

# Debug: List files to verify they were copied
RUN ls -la
RUN echo "Checking if package files exist:"
RUN test -f package.json && echo "package.json found" || echo "package.json NOT found"
RUN test -f package-lock.json && echo "package-lock.json found" || echo "package-lock.json NOT found"

# Configure npm for better network handling and install dependencies
RUN npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-factor 2 && \
    npm config set registry https://registry.npmjs.org/ && \
    npm ci --verbose --no-optional --prefer-offline

# Copy all the backend source code into the container
COPY backend/ ./

# Debug: List files after copying
RUN ls -la

# Compile TypeScript to JavaScript (output will be in dist/ directory)
RUN npm run build

# Copy your config folder (including ca.pem) into the built dist output
COPY backend/src/config ./dist/src/config

# Expose port 8080 for Azure App Service
EXPOSE 8080

# Start the server
CMD ["npm", "start"]
