module.exports = function(RED) {
    function AuroralAgentNode(n) {
        RED.nodes.createNode(this,n);
        var http = require('http');
        var uuid = require('uuid');
        var stoppable = require('stoppable');
        const node = this

        // settings
        this.host = n.host;
        this.port = n.port;
        this.serverPort = n.serverPort;
        this.devices = new Array();
        this.unregisterRequests = new Array();

        // store node in context to allow registrations
        (node.context().global).set('auroral_agent',this);

        // get registrations
        (async function() {
            try{
                const registrationsResponse = await getAgent(node, '/admin/registrations')
                if(!registrationsResponse){
                    node.error('Agent is offline')
                    return
                }
                const registrations = JSON.parse(registrationsResponse)

                //get registrationData with pids and adapterId
                node.agentData = await Promise.all(registrations.map(async (reg) => {
                    var returnObj = JSON.parse(await getAgent(node, '/admin/registrations/' + reg))
                    returnObj.oid = reg
                    return returnObj
                }));
                // waiting 300 milisecond to gather all register calls from nodes
                await new Promise(r => setTimeout(r, 300));
                for (const device of node.devices) {
                    const oid = getOid(node,device.objectId)
                    if(oid == undefined){
                        //registering new device
                        const data = {
                            name: device.name,
                            adapterId: device.objectId,
                            properties: device.pids,
                            type: device.type
                        };
                        //send request
                        const response = (await postAgent(node, '/api/registration/', data))[0];

                        if(response) {
                            // emit message to node and store OID
                            node.log('Device: '+ device.name + ' - now registered [' + response.oid +']')
                            device.node.emit('registered', response.oid);
                            device.registered = true
                            device.oid = response.oid
                        }
                        else{
                            // registration error
                            node.log('Device: '+ device.name + ' - was not  registered ')
                        }
                    } else {
                        // device is already registered - emit to node
                        node.log('Device: '+ device.name + ' - already registered [' + oid +']')
                        device.oid = oid;
                        device.registered = true
                        device.node.emit('registered', oid);
                    }
                }
            } catch (error){
                // unexpected error
                node.error('Fatal error:' + error)
           } 
           })();

        // init server
        this.httpServer = stoppable(http.createServer(function (req, res) {
            const url = req.url.split('/')
            // proper url test '/property/api/:oid/:pid
            if( url.length < 5 || url[1] != 'api' || url[2] != 'property'){
                // Error
                node.error('Bad params: '+ url)
                res.writeHead(400, {'Content-Type': 'application/json'});
                res.write(JSON.stringify({'err': "Bad request"}));
                res.end();
                return
            }
            // get OID and PID from request
            const reqOid = url[3]
            const reqPid = url[4]
            var targetDevice = undefined
            // try to find OID in stored devices
            for (const device of node.devices) {
                if(device.oid == reqOid && device.pids.includes(reqPid)){
                    targetDevice = device
                }
            }
            // Device not found
            if(!targetDevice) {
                node.error('OID/PID not found ['+reqOid + ', ' + reqPid+']')
                res.writeHead(400, {'Content-Type': 'application/json'});
                res.write(JSON.stringify({'err': 'Combination of OID and PID not found ['+reqOid + ', ' + reqPid+']'}));
                res.end();
                return
            }
            // create record in requests
            const obj = { req, res }
            const reqId = uuid.v4()

            // store in shared context
            var auroral_requests = (node.context().global).get('auroral_requests') || {}
            auroral_requests[reqId] = obj;
            (node.context().global).set('auroral_requests', auroral_requests)

            // send message to request 
            node.log('Sending request to node ' + reqId)
            targetDevice.node.emit('request', {'_auroralReqId': reqId, pid: reqPid, oid: reqOid, 'adapterId': targetDevice.objectId})
            // timeout if request is not answered
            setTimeout(async function(){
                // get requests from global storage
                var auroral_requests = (node.context().global).get('auroral_requests')
                if(auroral_requests[reqId] !== undefined) {
                    // request was not answered
                    node.error('Auroral node-red ' + targetDevice.name + '-' + reqPid + ' does not reach response node in 5 seconds')
                    const res = auroral_requests[reqId].res
                    res.writeHead(400, {'Content-Type': 'application/json'});
                    res.write(JSON.stringify({err: 'Auroral node-red ' + targetDevice.name + ' pid: ' + reqPid + ' does not reach response node in 5 seconds'}));
                    res.end()
                     // remove from global variable
                    delete auroral_requests[reqId];
                    (node.context().global).set('auroral_requests', auroral_requests)
                } 
            }, 5000)
          }));

        // start server
        this.httpServer.listen(this.serverPort)
        
        // function for 'request' nodes
        this.on('registerDevice', function(obj, type) {
            obj.registered = false
            obj.type = type
            this.devices.push(obj)
        });
        // function for unregistering devices after removal
        this.on('unregisterDevice',  async function(id) {
            const got = require('got');
            this.unregisterRequests.push(id)
        });
        // when closing conenction to agent -> unregister removed items
        this.on('close', function(removed, done) {
            this.httpServer.stop()
            node.log('Closig agent connector')
            // waiting 500ms to get all unregistration requests
            setTimeout(async function(){
                try {
                    var oids = [];
                    for (const unregisterId of node.unregisterRequests) {
                        for (const device of node.devices) {
                            if(device.objectId == unregisterId){
                                oids.push(device.oid)
                                node.log('Unregistering: '+ device.name)
                            }
                        }
                    }
                    if(oids.length == 0){
                        done();
                        return
                    }
                    // send unregister request
                    await postAgent(node, '/api/registration/remove', { oids } )
                    } catch (error) {
                        node.error('ERROR')
                        node.error(error)
                    }
                    done();
                },500);
        });
        (this.context().global).set('auroral_agent', this);
    }
    RED.nodes.registerType("auroral-agent", AuroralAgentNode);
}

// get request with given URL, returns body or undefined
async function getAgent(node, url){
    const got = require('got');
    try {
        const response = await got.get('http://' + node.host + ':' + node.port + url);
        return response.body
    } catch (error) {
        node.error('Error getAgent: ' + error)
        return undefined
    }
}
// function returns oid from adapterId (called id)
function getOid(node, id){
    for (const agentDevice of node.agentData) {
        if(agentDevice.adapterId != undefined && agentDevice.adapterId == id ){
            return agentDevice.oid
        }
    }
    return undefined
}

// post request with given URL and objData, returns body or undefined
async function postAgent(node, url, objData){
        const got = require('got');
        try {
            const response = await got.post('http://' + node.host + ':' + node.port + url, 
            {
                json: objData,
                responseType: 'json'
            });
            return response.body
        } catch (error) {
            node.error('Error postAgent: ' + error)
            return undefined
        }
}
