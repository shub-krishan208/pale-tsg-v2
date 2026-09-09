FROM oven/bun:1-alpine

WORKDIR /app

# Copy package files
COPY package*.json bun.lock* ./

# Install dependencies
RUN bun install

# Copy project files
COPY . .

# Build Next.js
RUN bun run build

EXPOSE 3000

# Start Next.js server
CMD ["bun", "run", "start"]
