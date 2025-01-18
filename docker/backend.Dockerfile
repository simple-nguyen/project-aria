FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY src/backend/package*.json ./src/backend/
COPY src/shared/package*.json ./src/shared/

RUN npm install

COPY . .

EXPOSE 4000
EXPOSE 4001

CMD ["npm", "run", "dev:backend"]
