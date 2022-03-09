#!/bin/bash
export NODE_RED_VERSION=$(grep -oE "\"node-red\": \"(\w*.\w*.\w*.\w*.\w*.)" package.json | cut -d\" -f4)

echo "#########################################################################"
echo "node-red version: ${NODE_RED_VERSION}"
echo "#########################################################################"

PLATFORMS=linux/amd64,linux/arm64,linux/arm/v7
ENV=dev
REGISTRY=registry.bavenir.eu
IMAGE_NAME=auroral-node-red


# Do login
docker login ${REGISTRY}

# Multiarch builder
docker buildx use multiplatform

# Build images & push to private registry
docker buildx build --platform ${PLATFORMS} \
                    --tag ${REGISTRY}/${IMAGE_NAME}:${ENV} \
                    --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
                    --build-arg BUILD_VERSION=${VERSION} \
                    --build-arg NODE_VERSION=14 \
                    --build-arg NODE_RED_VERSION=${NODE_RED_VERSION} \
                    --build-arg OS=alpine3.12 \
                    --build-arg BUILD_DATE="$(date +"%Y-%m-%dT%H:%M:%SZ")" \
                    --build-arg TAG_SUFFIX=default \
                    -f Dockerfile.custom . --push

# docker build --rm --no-cache \
#     --build-arg NODE_VERSION=14 \
#     --build-arg NODE_RED_VERSION=${NODE_RED_VERSION} \
#     --build-arg OS=alpine3.12 \
#     --build-arg BUILD_DATE="$(date +"%Y-%m-%dT%H:%M:%SZ")" \
#     --build-arg TAG_SUFFIX=default \
#     --file Dockerfile.custom \
#     --tag testing:node-red-build .
