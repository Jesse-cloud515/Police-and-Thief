# Police & Thief: Naija Streets — one container serves the game and runs online matches
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN cd server && npm ci --omit=dev || (cd server && npm install --omit=dev)
ENV PORT=8080 DATA_DIR=/data
EXPOSE 8080
CMD ["node", "server/server.mjs"]
