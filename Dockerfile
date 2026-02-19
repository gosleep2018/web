FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install --omit=dev
EXPOSE 10000
ENV PORT=10000
ENV HOST=0.0.0.0
CMD ["node", "scripts/azure-tts-proxy.js"]
