FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY src/frontend/package*.json ./src/frontend/
COPY src/shared/package*.json ./src/shared/

# Install dependencies
RUN npm install -w src/frontend -w src/shared

# Copy source files
COPY src/shared ./src/shared
COPY src/frontend ./src/frontend

EXPOSE 3000

CMD ["npm", "run", "dev:frontend"]
