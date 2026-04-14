FROM nginx:alpine

RUN apk add --no-cache openssl && \
    mkdir -p /etc/nginx/certs && \
    openssl req -x509 -nodes -days 365 \
      -newkey rsa:2048 \
      -keyout /etc/nginx/certs/selfsigned.key \
      -out /etc/nginx/certs/selfsigned.crt \
      -subj "/C=MA/ST=BenGuerir/L=BenGuerir/O=42/OU=ft_transcendence/CN=localhost"

COPY default.conf /etc/nginx/conf.d/default.conf

EXPOSE 443 80