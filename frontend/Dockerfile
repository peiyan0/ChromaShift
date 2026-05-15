FROM node:20-slim AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies and explicitly add the linux-x64 rollup package
# to solve the cross-platform npm bug
RUN npm install && \
    npm install @rollup/rollup-linux-x64-gnu

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

FROM nginx:stable-alpine

COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
