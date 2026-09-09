FROM node:lts-trixie-slim

# Create working directory
WORKDIR /app

# Copy app files
COPY . /app

# Install only production packages without updating dependencies. Ignore 3rd-party scripts.
RUN npm config set update-notifier false && npm install --omit=dev --ignore-scripts

# Compile SASS (can't do this when running in pod since it's readonly)
RUN node_modules/.bin/sass scss/index.scss:public/styles.css

# Expose ports
EXPOSE 3000

USER node

# Start project and code-server with HTTPS
CMD ["node", "server.js"]