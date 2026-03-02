FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline
COPY . .
ARG INTERNAL_API_URL=http://localhost:8080
ENV INTERNAL_API_URL=$INTERNAL_API_URL
ARG OPTIMIZE=0
ENV OPTIMIZE=$OPTIMIZE
RUN --mount=type=cache,target=/root/.npm \
    if [ "$OPTIMIZE" = "1" ]; then npm run build; fi

FROM node:20-alpine
WORKDIR /app
ARG OPTIMIZE=0
ENV OPTIMIZE=$OPTIMIZE
COPY --from=builder /app ./
EXPOSE 3000
CMD ["sh", "-c", "if [ \"$OPTIMIZE\" = \"1\" ]; then NODE_ENV=production node .next/standalone/server.js; else npm run dev; fi"]
