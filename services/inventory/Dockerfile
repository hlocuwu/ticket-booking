# Stage 1: Build the binary
FROM golang:1.26-alpine AS builder

WORKDIR /app

# Copy dependency files and download
COPY go.mod go.sum ./
RUN --mount=type=cache,id=inventory-gomod,target=/go/pkg/mod \
    go mod download

# Copy the source code
COPY . .

# Build the Go app (CGO_ENABLED=0 ensures a static binary)
RUN --mount=type=cache,id=inventory-gomod,target=/go/pkg/mod \
    --mount=type=cache,id=inventory-gobuild,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -o inventory-service .

# Stage 2: Create a minimal production image
FROM alpine:latest

WORKDIR /root/

# Copy the binary from the builder stage
COPY --from=builder /app/inventory-service .

# Command to run the executable
CMD ["./inventory-service"]