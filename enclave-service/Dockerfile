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

# Install gosu for secure user switching and clean up apt cache
RUN apt-get update && apt-get install -y gosu curl && rm -rf /var/lib/apt/lists/*

# Create a non-root user 'ego'
RUN useradd -m -s /bin/bash ego

WORKDIR /app

# Copy the built executable and signature with correct ownership
COPY --from=builder --chown=ego:ego /app/main .
COPY --from=builder --chown=ego:ego /app/enclave.json .

# Copy the entrypoint script
COPY --chown=ego:ego run.sh .
RUN chmod +x run.sh

# Ensure the entire app directory is owned by the non-root user for security.
RUN chown -R ego:ego /app

# Expose the port the service listens on
EXPOSE 8081

# Add Healthcheck to verify the service is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:8081/api/attestation?nonce=healthcheck || exit 1

# Use the entrypoint script to configure the environment and drop root privileges before execution.
ENTRYPOINT ["/app/run.sh"]