# Use Node.js 20.5.0 LTS image from the official Docker Hub
FROM node:20.5.0-alpine3.18

# Set the working directory inside the container
WORKDIR /app

# Copy backend package.json and package-lock.json first to leverage Docker cache
COPY backend/package.json backend/package-lock.json ./
COPY backend/tsconfig.json ./

# Debug: List files to verify they were copied
RUN ls -la

# Install dependencies (including dev dependencies for build)
RUN npm ci

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
