FROM node:22-alpine
RUN apk update && apk upgrade --no-cache && npm install -g npm@latest

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev && npm audit fix 2>/dev/null || true

COPY . .

EXPOSE 8080

CMD ["npm", "start"]
