FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY .npmrc ./
COPY package*.json ./

RUN npm ci

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && npm run dev"]
