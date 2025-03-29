# Use an official Node.js runtime as a parent image
FROM node:20-alpine AS development

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
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

# Expose the port the app runs on
EXPOSE 3000

# Define the command to run the application
CMD ["node", "dist/main"]
