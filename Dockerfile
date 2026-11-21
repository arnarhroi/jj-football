# Static site: nginx serving the game files.
FROM nginx:1.27-alpine
COPY . /usr/share/nginx/html
