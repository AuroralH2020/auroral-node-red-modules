#!/bin/bash
export NODE_RED_VERSION=$(grep -oE "\"node-red\": \"(\w*.\w*.\w*.\w*.\w*.)" package.json | cut -d\" -f4)

echo "#########################################################################"
echo "node-red version: ${NODE_RED_VERSION}"
echo "#########################################################################"

PLATFORMS=linux/amd64,linux/arm64,linux/arm/v7

# Github configuration
ENV=2.1 # CHANGE ME IF NEEDED!!!
REGISTRY=ghcr.io
IMAGE_NAME=auroralh2020/auroral-node-red

# Do login
docker login ${REGISTRY}

# Multiarch builder
docker buildx use multiplatform

# Build images & push to private registry + latest
docker buildx build --platform ${PLATFORMS} \
                    --tag ${REGISTRY}/${IMAGE_NAME}:${ENV} \
                    --tag ${REGISTRY}/${IMAGE_NAME}:latest \
                    --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
                    --build-arg BUILD_VERSION=${VERSION} \
                    --build-arg NODE_VERSION=14 \
                    --build-arg NODE_RED_VERSION=${NODE_RED_VERSION} \
                    -f Dockerfile . --push

