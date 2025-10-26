FROM node:22-alpine

# Set UTF-8 locale and environment
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
ENV LC_CTYPE=C.UTF-8

WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web .
EXPOSE 1500
CMD ["npm","run","dev","--","--host","0.0.0.0","--port","1500"]
