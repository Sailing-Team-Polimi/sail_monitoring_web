# Local development workspace. GitHub Pages is built separately by GitHub Actions.
FROM node:24-bookworm-slim
WORKDIR /app/FE
# Use the project's Angular CLI without a separate global installation.
ENV PATH="/app/FE/node_modules/.bin:${PATH}"
COPY Docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh && chmod +x /usr/local/bin/entrypoint.sh
EXPOSE 4200
ENTRYPOINT ["entrypoint.sh"]
# Keep the workspace available; the developer starts Angular manually.
CMD ["sleep", "infinity"]
