# Use the official EGo builder image which comes with Go and SGX tools pre-installed.
FROM ghcr.io/edgelesssys/ego-dev:v1.8.1 AS builder

# Set working directory
WORKDIR /app

# Copy go.mod and go.sum first to leverage Docker layer caching
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the application source code
COPY . .

# Build the enclave executable
RUN ego-go build main.go

# Sign the enclave executable to create enclave.json
RUN ego sign main

# --- Final Stage ---
# Use a minimal image for the final executable.
# We need the EGo runtime and the SGX driver (or simulation library).
FROM ghcr.io/edgelesssys/ego-deploy:v1.8.1

WORKDIR /app

# Copy the built executable and the signature file from the builder stage
COPY --from=builder /app/main .
COPY --from=builder /app/enclave.json .

# Expose the port the service listens on
EXPOSE 8081

# The command to run the service. The simulation mode will be enabled via environment variable in docker-compose.
CMD ["ego", "run", "main"]