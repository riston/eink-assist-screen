
FROM debian:bullseye-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Etc/UTC

RUN apt-get update && apt-get install -y \
  chromium \
  curl \
  fonts-noto-cjk \
  && curl -fsSL https://deb.nodesource.com/setup_23.x -o nodesource_setup.sh \
  && bash nodesource_setup.sh \
  && apt-get install -y nodejs \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json first
COPY ha-puppet/package*.json ./

# Skip Puppeteer's Chrome download since we use system Chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Ensure a clean state before installing
RUN npm ci --unsafe-perm

# Copy the rest of the project files
COPY ha-puppet/ .

# Set Puppeteer to use Alpine Chromium
# ENV PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium"

# Run the application
CMD ["node", "http.js"]
