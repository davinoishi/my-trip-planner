#!/bin/sh
set -e

# Wait for MinIO to be ready
until mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"; do
  echo "Waiting for MinIO..."
  sleep 2
done

echo "MinIO is ready. Creating buckets..."

# Create buckets
mc mb --ignore-existing local/documents
mc mb --ignore-existing local/raw-emails
mc mb --ignore-existing local/exports

# Set document bucket policy (private — accessed via presigned URLs only)
mc anonymous set none local/documents
mc anonymous set none local/raw-emails
mc anonymous set none local/exports

# Set lifecycle: delete raw emails older than 1 year
mc ilm rule add --expire-days 365 local/raw-emails

echo "MinIO initialization complete."
echo "  Buckets: documents, raw-emails, exports"
