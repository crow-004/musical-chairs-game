#!/bin/bash
set -e

# 1. Generating PCCS configuration from environment variables
# This ensures flexibility without rebuilding the enclave image.
USE_SECURE=${USE_SECURE_CERT:-true}
PCCS=${PCCS_URL:-"https://muschairs.com:8082/sgx/certification/v4/"}

mkdir -p /etc/intel

# Construct the QCNL configuration file.
echo '{"use_secure_cert": '$USE_SECURE', "collateral_service": "'$PCCS'", "pccs_url": "'$PCCS'"}' > /etc/sgx_default_qcnl.conf

cp /etc/sgx_default_qcnl.conf /etc/intel/sgx_default_qcnl.conf

# Debugging: Show the generated config in the container logs.
echo "Generated QCNL config:"
cat /etc/sgx_default_qcnl.conf

# 2. Setting up access rights to the SGX device
# Dynamically add user 'ego' to the SGX device group.
if [ -e /dev/sgx_enclave ]; then
    SGX_GRP_ID=$(stat -c "%g" /dev/sgx_enclave)
    groupadd -g "$SGX_GRP_ID" sgx_grp 2>/dev/null || true
    usermod -aG "$SGX_GRP_ID" ego
fi

# 3. Intelligent "Lazy Loading" Wait Loop
# Instead of a fixed sleep or limited retries, we poll the endpoint indefinitely 
# so that the container stays 'Running' and doesn't cycle through restarts.
echo "Waiting for PCCS endpoint ($PCCS) to become available..."

# Temporarily disable 'exit on error' so curl failures don't kill the script.
set +e

while true; do
    # -k: Ignore SSL errors during the wait phase (useful if certs are still loading)
    # --connect-timeout: Fast fail if Nginx is not responding at all
    curl -k -s --connect-timeout 3 --output /dev/null "$PCCS"pckcert
    
    if [ $? -eq 0 ]; then
        echo "PCCS is reachable! Nginx is ready."
        break
    else
        echo "PCCS is not reachable yet (Nginx might be starting)... retrying in 5s"
        sleep 5
    fi
done

# Re-enable 'exit on error' for the main application launch.
set -e

# 4. Run the application as user 'ego' (Drop privileges)
# gosu ensures the app runs as PID 1 to handle Docker signals correctly.
echo "Starting the application via EGo..."
exec gosu ego ego run main