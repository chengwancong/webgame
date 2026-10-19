FROM node:24-alpine
WORKDIR /gate
COPY deploy/web-gate/ /gate/
COPY apps/web/src/ui/tokens.css /gate/tokens.css
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
