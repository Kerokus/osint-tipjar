# Stage 1: Build the Vite application
# Use a specific version of Node for reproducibility
FROM node:20-alpine AS build

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy the rest of the application source code
COPY . .


RUN npm run build


FROM nginx:stable-alpine


COPY --from=build /app/dist /usr/share/nginx/html

# Copy a custom Nginx configuration file
# This is important for single-page applications (SPAs) like those made with React or Vue
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 to the outside world
EXPOSE 80

# Command to run Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]