FROM node:22-alpine
RUN apk update && apk upgrade --no-cache

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev && \
    npm audit fix 2>/dev/null || true && \
    npm cache clean --force && \
    rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/bin/npm \
           /usr/local/bin/npx

COPY . .

EXPOSE 8080

CMD ["node", "index.js"]
