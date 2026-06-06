# Stage 1: Build the binary
FROM golang:1.26-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN --mount=type=cache,id=booking-gomod,target=/go/pkg/mod \
    go mod download
COPY . .
RUN --mount=type=cache,id=booking-gomod,target=/go/pkg/mod \
    --mount=type=cache,id=booking-gobuild,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -o booking-service .

# Stage 2: Minimal production image
FROM alpine:latest
WORKDIR /root/
COPY --from=builder /app/booking-service .
CMD ["./booking-service"]