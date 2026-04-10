# Stage 1: Build the binary
FROM golang:1.26-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o auth-service .

# Stage 2: Minimal production image
FROM alpine:latest
WORKDIR /root/
COPY --from=builder /app/auth-service .
CMD ["./auth-service"]