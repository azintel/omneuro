FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm i --omit=dev || npm i --omit=dev
COPY . .
EXPOSE 8080
CMD ["node", "server.js"]
