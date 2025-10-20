FROM node:22-alpine
WORKDIR /app/worker
COPY worker/package*.json ./
RUN npm install
COPY worker .
CMD ["npm","run","start:worker"]
