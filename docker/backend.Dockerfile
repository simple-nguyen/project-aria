FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY src/backend/package*.json ./src/backend/
COPY src/shared/package*.json ./src/shared/

# Install dependencies
RUN npm install -w src/backend -w src/shared

# Copy source files
COPY src/shared ./src/shared
COPY src/backend ./src/backend

EXPOSE 4000
EXPOSE 4001

CMD ["npm", "run", "dev:backend"]
