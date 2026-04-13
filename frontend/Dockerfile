FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json /app/package.json
RUN npm install

COPY . /app
ARG REACT_APP_BACKEND_URL=http://localhost
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
RUN npm run build

FROM nginx:1.27-alpine

COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
