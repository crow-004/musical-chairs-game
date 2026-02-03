# Build stage
FROM node:18-alpine as build

WORKDIR /app

# Copy the package.json files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy the source code
COPY . .

# Declare build arguments (they will come from docker-compose)
ARG VITE_API_URL
ARG VITE_CONTRACT_ADDRESS
ARG VITE_CHAIN_ID
ARG VITE_RPC_URL

# Run the build (Vite will insert variables into the code)
RUN npm run build

# Startup stage (Nginx)
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
