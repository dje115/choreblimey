FROM node:22-alpine
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web .
EXPOSE 1500
CMD ["npm","run","dev","--","--host","0.0.0.0","--port","1500"]
