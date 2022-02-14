#!/bin/bash
npm install

#PATHS
NODE_RED_PATH=~/.node-red
ADAPTER_PATH=$(pwd)

# copy to NODE-RED folder  
(cd $NODE_RED_PATH; npm install $ADAPTER_PATH)

# start node
node-red