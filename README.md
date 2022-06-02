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
Auroral Agent is by default extending messages using mapping, which is generated from Thing description. This ensures sent message will be sent in standart Auroral format.
From Node-RED you just need to pass simple value [string, number, object or array], which was choosen during registration (in Thing description)

## Development installation ##
 - First option:
    - Described in: https://nodered.org/docs/creating-nodes/first-node in part **Testing your node in Node-RED**
 - Second option:
    - npm install
    - npm pack -> generates tgz file
    - install through UI -> manage pallete and import .tgz

## Example flow ##
![Example flow](https://github.com/AuroralH2020/auroral-node-red-modules/blob/master/resources/flow_caption.png?raw=true)

## Example of ThingDescription ##

``` JSON
{
  "@context": "https://www.w3.org/2019/wot/td/v1",
  "@type": "Ontology:DeviceType",
  "title": "Sensor1",
  "id": "000-111-222",
  "adapterId": "001-myinfrastructure",
  "description": "Sensor example for the node-red adapter",
  "securityDefinitions": {
    "nosec_sc": {
      "scheme": "nosec"
    }
  },
  "security": "nosec_sc",
  "properties": {
    "temp": {
      "title": "temp",
      "@type": "Ontology:PropertyType",
      "description": "Retrieve temperature of my device",
      "type": "number",
      "forms": [
        {
          "op": [
            "readproperty"
          ],
          "href": "http://localhost:1250/api/property/000-111-222/temp"
        }
      ]
    },
    "status": {
      "title": "status",
      "@type": "Ontology:PropertyType",
      "description": "Retrieve status of the device",
      "type": "string",
      "forms": [
        {
          "op": [
            "readproperty"
          ],
          "href": "http://localhost:1250/api/property/000-111-222/status"
        }
      ]
    }
  },
  "actions": {},
  "events": {
    "alert": {
      "title": "alert",
      "@type": "Ontology:PropertyType",
      "description": "Notifications that are pushed to AURORAL from my sensor",
      "forms": [
        {
          "op": [
            "subscribeevent"
          ],
          "href": "http://localhost:1250/api/event/000-111-222/alert"
        }
      ]
    }
  }
}
```

### Node-red docs ###
https://nodered.org/docs/

## Known limitations and bugs ##
- TD mismatch after depleoying preregistered device ( can be fixed in device properties with get TD from agent button )
- Changing adapterId after deployment is not allowed

## Who do I talk to? ##

Developed by bAvenir

jorge.almela@bavenir.eu
peter.drahovsky@bavenir.eu
