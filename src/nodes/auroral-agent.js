module.exports = function(RED) {
    function AuroralAgentNode(n) {
        RED.nodes.createNode(this,n);
        var http = require('http');
        var uuid = require('uuid');
        const got = require('got');
        var stoppable = require('stoppable');
        const node = this

        // settings
        this.baseUrl = n.protocol + "://" + n.host + ":" + n.port + '/'
        this.auth = n.authentification
        this.serverPort = n.serverPort
        // console.log(n.customCertificateText)
        this.requestOptions = {
            prefixUrl: this.baseUrl,
            responseType: 'json',
            username: this.auth ? this.credentials.username : undefined,
            password: this.auth ? this.credentials.password : undefined,
            https: {
                rejectUnauthorized: n.ignoreCertificate? false : true,
            },
            timeout: {
                response: 7000
            }
        };
        this.devices = new Array();
        this.devicesAdapterIds = new Array();
        this.unregisterRequests = new Array();

        // store node in context to allow registrations
        (node.context().global).set('auroral_agent',this);

        // get registrations
        (async function() {
            try{
                const registrations = await getAgent(node, 'api/registration')
                if(!registrations){
                    node.error('Agent is offline')
                    return
                }

                //get registrationData with pids and adapterId
                node.agentData = await Promise.all(registrations.map(async (reg) => {
                    var returnObj = await getAgent(node, 'api/registration/' + reg)
                    returnObj.oid = reg
                    return returnObj
                }));
                // waiting 300 milisecond to gather all register calls from nodes
                await new Promise(r => setTimeout(r, 300));
                for (const device of node.devices) {
                    const agentDevice = getAgendeviceByAdapterId(node,device.objectId)
                    if(agentDevice == undefined && device.registering){
                        //registering new device 
                        const data = {
                            name: device.name,
                            adapterId: device.objectId,
                            properties: [...device.pids],
                            type: device.type
                        };
                        //send request
                        node.log('Sending registration request')
                        const response = (await postAgent(node, 'api/registration/', data))[0];

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
                    } else if(agentDevice != undefined){
                        // device is already registered - emit to node
                        if (await compareAndUpdate(node, device, agentDevice)){
                            node.log('Device: '+ device.name + ' - updated [' + agentDevice.oid +']')
                        } else{
                            node.log('Device: '+ device.name + ' - already registered [' + agentDevice.oid +']')
                        }
                        device.oid = agentDevice.oid;
                        device.registered = true
                        device.node.emit('registered', agentDevice.oid);
                    } else {
                        // unregistered device
                        node.log('Device: '+ device.name + ' - waiting for manual registration')
                        node.error('Device: '+ device.name + ' - please redeploy after manual registraion')
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
        this.httpServer.listen(this.serverPort).on('error', (err)=>{
            node.error('Server problem: ' + err.message)
                })
        
        // function for 'request' nodes
        this.on('registerDevice', function(obj, type) {
            obj.registered = false;
            obj.type = type;
            if(this.devicesAdapterIds.includes(obj.objectId) && type === 'Device' ){
                node.error('Multiple uses of same adapterId');
                setTimeout(function(){ 
                    obj.node.emit('registrationFailure', 'Multiple uses of this adapterId');
                }, 100);
            } else {
                this.devicesAdapterIds.push(obj.objectId)
                this.devices.push(obj)
            }
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
                    await postAgent(node, 'api/registration/remove', { oids } )
                    } catch (error) {
                        node.error('ERROR')
                        node.error(error)
                    }
                    done();
                },500);
        });
        (this.context().global).set('auroral_agent', this);
    }
    RED.nodes.registerType("auroral-agent", AuroralAgentNode,{
        credentials: {
            username: {type:"text"},
            password: {type:"password"},
        }
    })
}

// get request with given URL, returns body or undefined
async function getAgent(node, url){
    const got = require('got');
    try {
        const response = await got.get(url, node.requestOptions);
        return response.body
    } catch (error) {
        node.error('Error getAgent: ' + error)
        return undefined
    }
}
// function returns oid from adapterId (called id)
function getAgendeviceByAdapterId(node, id){
    for (const agentDevice of node.agentData) {
        if(agentDevice.adapterId != undefined && agentDevice.adapterId == id ){
            return agentDevice
        }
    }
    return undefined
}

// post request with given URL and objData, returns body or undefined
async function postAgent(node, url, objData){
        const got = require('got');
        try {
            const options = JSON.parse(JSON.stringify(node.requestOptions));
            options.json = objData
            const response = await got.post(url, options);
            return response.body
        } catch (error) {
            node.error('Error postAgent: ' + error)
            return undefined
        }
}

// post request with given URL and objData, returns body or undefined
async function putAgent(node, url, objData){
    const got = require('got');
    try {
        const options = JSON.parse(JSON.stringify(node.requestOptions));
        options.json = objData
        const response = await got.put(url, options);
        return response.body
    } catch (error) {
        node.error('Error putAgent: ' + error)
        return undefined
    }
}

// compare local registered item with one in agent
// if there are changes - it will update agent
async function compareAndUpdate(node, local, agent){
    try {
        // to be sure
        if(local.objectId != agent.adapterId){
            throw new Error ('unexpected error objectId != adapterId')
        }
        // update only devices
        if(agent.type !='Device'){
            return false
        }
        let toUpdate = false;
        let updateObject = {};
        if(local.name != agent.name){
            toUpdate = true;
            updateObject.name = local.name
        }
        if(JSON.stringify(local.pids)  != JSON.stringify(agent.properties)){
            toUpdate = true;
            updateObject.properties = [...local.pids]
        }
        if(toUpdate){
            updateObject.oid = agent.oid
            await putAgent(node, 'api/registration/', updateObject)
            return true
        }
        return false
    } catch (error) {
        node.error('Error comparing items: ' + error)
        return undefined
    }
}
