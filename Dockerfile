FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN \
  if [ -f pnpm-lock.yaml ]; then corepack enable && corepack prepare pnpm@latest --activate && pnpm i; \
  elif [ -f yarn.lock ]; then corepack enable && yarn install; \
  else npm install; fi

# Copy source
COPY . .

# Expose the Vite dev server port (default 5173)
EXPOSE 5173

# Run dev server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]