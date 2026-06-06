# Stage 1: Build the React app
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm install
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine
# Remove default Nginx config
RUN rm /etc/nginx/conf.d/default.conf
# Copy our custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/
# Copy the built React files from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]