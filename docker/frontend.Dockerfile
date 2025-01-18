FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY src/frontend/package*.json ./src/frontend/
COPY src/shared/package*.json ./src/shared/

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev:frontend"]
