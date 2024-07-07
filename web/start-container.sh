#!/bin/bash

# Build the container if it 
#docker build -t node-react:dev .
docker build -t node-react:experimental .
# Use this version to disable buildkit if proxy settings become an issue:
#DOCKER_BUILDKIT=0 docker build -t node-react:dev .
# Or, if connected to VPN and npm complains about self-signed certificates, 
#   uncomment the RUN npm config set strict-ssl line in the Dockerfile. 

# To run the basic, unmodified boilerplate app
#docker run -it --rm -v ${PWD}:/app -v /app/node_modules -p 127.0.0.1:3001:3000 -e CHOKIDAR_USEPOLLING=true node-react:boilerplate

# To run the in-development app
#docker run -it -d -v ${PWD}:/app -v /app/node_modules -p 127.0.0.1:3001:3000 -e CHOKIDAR_USEPOLLING=true node-react:dev
# Variations:
docker run -it --rm -v ${PWD}:/app -p 127.0.0.1:3001:3000 -e CHOKIDAR_USEPOLLING=true node-react:experimental

# To quit:
#docker stop <container_id>
