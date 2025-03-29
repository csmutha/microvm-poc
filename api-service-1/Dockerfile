# Use an official Node.js runtime as a parent image
# Choose a version compatible with NestJS and your Node version (v23.7.0)
# Using LTS version like 20-alpine is generally recommended for stability and smaller size
FROM node:20-alpine AS development

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (or yarn.lock)
# Use wildcard to copy both if either exists
COPY package*.json ./

# Install app dependencies
# Use --only=development for the development stage if needed,
# but for a simple build, installing all dependencies is fine.
RUN npm install

# Copy application source code
COPY . .

# Build the application
RUN npm run build

# --- Production Stage ---
FROM node:20-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production

# Copy the built application from the development stage
COPY --from=development /usr/src/app/dist ./dist
COPY --from=development /usr/src/app/node_modules ./node_modules

# Expose the port the app runs on (NestJS default is 3000)
EXPOSE 3000

# Define the command to run the application
# Use node directly to run the compiled JavaScript
CMD ["node", "dist/main"]
