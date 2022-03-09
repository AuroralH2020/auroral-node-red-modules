# Auroral adapter module for NODE-RED #

Node-red modules for AURORAL adapter

Developed for AURORAL H2020 project

## Disclaimer

Beta version still under testing
Extended documentation will follow

## Nodes ## 
There are three nodes:
- Device 
   - represents Auroral device
- Response
   - for sending requested data back to agent
- Registrations
   - for retrieving registration from agent

## Standard mesage format ##
Auroral message format will be added in future.  

## Development installation ##
 - First option:
    - Described in: https://nodered.org/docs/creating-nodes/first-node in part **Testing your node in Node-RED**
 - Second option:
    - npm install
    - npm pack -> generates tgz file
    - install through UI -> manage pallete and import .tgz

### Node-red docs ###
https://nodered.org/docs/

## Known limitations and bugs ##
- TD mismatch after depleoying preregistered device ( can be fixed in device properties with get TD from agent button )
- Changing adapterId after deployment is not allowed

## Who do I talk to? ##

Developed by bAvenir

jorge.almela@bavenir.eu
peter.drahovsky@bavenir.eu
