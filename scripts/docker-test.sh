#!/bin/bash
set -e

echo "=== Local Docker Test ==="

echo "Building Docker image locally (no cache)..."
docker build --no-cache -t family-picnic:test .

echo "Done. Image built successfully. To run with postgres:"
echo "  docker run --rm -e DATABASE_URL='postgresql://user:password@host.docker.internal:5432/family-picnic' family-picnic:test"
