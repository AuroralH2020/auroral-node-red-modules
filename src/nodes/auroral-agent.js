module.exports = function(RED) {
    function AuroralAgentNode(n) {
        var http = require('http');
        var uuid = require('uuid');
        var stoppable = require('stoppable');
        RED.nodes.createNode(this,n);
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
                const registrations = JSON.parse(await getAgent(node, '/admin/registrations'))
                if(!registrations){
                    node.error('Can not connect to agent')
                    return
                }
                node.agentData = await Promise.all(registrations.map(async (reg) => {
                    var returnObj = JSON.parse(await getAgent(node, '/admin/registrations/' + reg))
                    
                    returnObj.oid = reg
                    return returnObj
                }));
                // node.log('Waiting 1 second')
                await new Promise(r => setTimeout(r, 1000));
                for (const device of node.devices) {
                    const oid = getOid(node,device.objectId)
                    if(oid == undefined){
                        node.log('Registering '+ device.name )
                        //register 
                        const data = {
                            name: device.name,
                            adapterId: device.objectId,
                            properties: device.pids,
                            type: 'Device'
                        };
                        const response = (await postAgent(node, '/api/registration/', data))[0];
                        if(response) {
                            node.log('Registered '+ device.name + ' ' + response.oid)
                            device.registered = true
                            device.oid = response.oid
                        }
                        else{
                            node.error('Device was not registered')
                        }
                    } else {
                        node.log('Device: '+ device.name + '\t - already registered [' + oid +']')
                        device.oid = oid;
                        device.registered = true
                        device.node.emit('registered');
                    }
                }
            } catch (error){
                node.error('Fatal error:' + error)
           } 
           })();

        // init server
        this.httpServer = stoppable(http.createServer(function (req, res) {
            const url = req.url.split('/')
            if( url.length<3 ){
                // Error
                node.error('Bad params')
                res.writeHead(400, {'Content-Type': 'application/json'});
                res.write(JSON.stringify({'err': "Bad request"}));
                res.end();
                return
            }
            const reqOid = url[1]
            const reqPid = url[2]
            var targetDevice = undefined
            for (const device of node.devices) {
                if(device.oid == reqOid && device.pids.includes(reqPid)){
                    targetDevice = device
                }
            }
            if(!targetDevice){
                // Error
                node.error('OID/PID not found ')
                res.writeHead(400, {'Content-Type': 'application/json'});
                res.write(JSON.stringify({'err': "Combination of OID and PID not found"}));
                res.end();
                return
            }
            // create record in requests
            const obj = {
                req,
                res,
            }
            const objId = uuid.v4()
            // store in shared context
            var auroral_requests = (node.context().global).get('auroral_requests') || {}
            auroral_requests[objId] = obj;
            (node.context().global).set('auroral_requests', auroral_requests)
            // send message to request 

            node.log('Asking:' + objId)
            targetDevice.node.emit('request', {'_auroralReqId': objId, pid: reqPid})
          }));
        this.httpServer.listen(this.serverPort)

        this.on('registerDevice', function(obj) {
            obj.registered = false
            this.devices.push(obj)
            node.log('Register device:' + obj.objectId)
        });

        this.on('unregisterDevice',  async function(id) {
            const got = require('got');
            this.unregisterRequests.push(id)
        });

        this.on('close', function(removed, done) {
            this.httpServer.stop()
            node.log('Closig agent connector')
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
                    if(oids == []){
                        // node.log('Nothing to unregister')
                        done();
                        return
                    }
                    const got = require('got')
                    const response = await got.post('http://' + node.host + ':' + node.port + '/api/registration/remove', 
                    {
                        json: { oids },
                    });
                    } catch (error) {
                        node.error('ERROR')
                        node.error(error)
                    }
                    done();
                },1000);
        });
        (this.context().global).set('auroral_agent', this);
    }
    RED.nodes.registerType("auroral-agent", AuroralAgentNode);
}

// return registrations from AGENT
async function getAgent(node, url){
    try {
        const http = require('http');
        const res = await new Promise(resolve => {
            http.get('http://' + node.host + ':' + node.port + url, resolve);
        });
        let data = await new Promise((resolve, reject) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('error', err => reject(err));
            res.on('end', () => resolve(data));
            
        });
        return data
    } catch (error) {
        node.error('ERROR')
        node.error(error)
    }
}
function getOid(node, id){
    for (const agentDevice of node.agentData) {
        if(agentDevice.adapterId != undefined && agentDevice.adapterId == id ){
            return agentDevice.oid
        }
    }
    return undefined
}

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
            node.error('ERROR')
            node.error(error)
            return
        }
        
}
