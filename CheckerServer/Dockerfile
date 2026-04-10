FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN apk add --no-cache openssl
RUN npm install

COPY . .

RUN npx prisma generate

RUN chmod +x wait-for-postgres.sh

EXPOSE 3001

# CMD ["./wait-for-postgres.sh", "sh", "-c", "npx prisma db push && npx prisma db seed && npm run dev"]
# CMD ["./wait-for-postgres.sh", "sh", "-c", "npx prisma db push && npm start"]
CMD ["sh", "./wait-for-postgres.sh", "sh", "-c", "npx prisma db push && npm run dev"]