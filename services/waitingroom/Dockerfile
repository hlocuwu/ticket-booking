# Stage 1: Build the binary
FROM golang:1.26-alpine AS builder

WORKDIR /app

# Copy dependency files and download
COPY go.mod go.sum ./
RUN go mod download

# Copy the source code
COPY . .

# Build the Go app
RUN CGO_ENABLED=0 GOOS=linux go build -o waitingroom-service .

# Stage 2: Create a minimal production image
FROM alpine:latest

WORKDIR /root/

# Copy the binary from the builder stage
COPY --from=builder /app/waitingroom-service .

# Command to run the executable
CMD ["./waitingroom-service"]