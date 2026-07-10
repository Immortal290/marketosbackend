# ─── MarketOS Frontend — Nginx static server ─────────────────────────────────
FROM nginx:1.27-alpine

# Remove default nginx page
RUN rm -rf /usr/share/nginx/html/*

# Copy static frontend files
COPY . /usr/share/nginx/html/

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
