FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci && npx prisma generate
COPY . .
EXPOSE 4000
CMD ["sh", "-c", "if [ \"$NODE_ENV\" = \"production\" ]; then npx prisma migrate deploy; else npx prisma db push; fi && node index.js"]
