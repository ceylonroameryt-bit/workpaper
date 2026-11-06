# AWS Lambda container image: Next.js standalone server behind the Lambda Web Adapter.
FROM public.ecr.aws/docker/library/node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM public.ecr.aws/docker/library/node:22-alpine
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 AWS_LWA_READINESS_CHECK_PATH=/login
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# CA bundle for verify-full TLS to RDS (DATABASE_URL uses sslrootcert=/app/rds-ca.pem)
RUN wget -qO /app/rds-ca.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem \
 && ln -s /tmp/next-cache /app/.next/cache
CMD ["node", "server.js"]
