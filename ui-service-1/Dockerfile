# Use Nginx directly for serving static files
FROM nginx:alpine

# Copy static HTML files directly to Nginx's html directory
COPY ./public /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start Nginx server
CMD ["nginx", "-g", "daemon off;"]
