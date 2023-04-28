const config = require('./static/config');

module.exports = function(RED) {
    function AuroralAgent(config) {
        RED.nodes.createNode(this,config);
        var http = require('http');
        const Agent = require('./static/agentApi');
        var stoppable = require('stoppable');
        const node = this

        // settings
        this.serverPort = config.serverPort
        // create agent api object
        this.agent = new Agent(config.protocol + "://" + config.host + ":" + config.port + '/',
            config.ignoreCertificate, config.authentification ? this.credentials.username : undefined,
            config.authentification ? this.credentials.password : undefined )
        this.devices = new Array();
        this.nodeIds = new Array();
        this.unregisterRequests = new Array();
        this.unsubscribeRequest = new Array();

        // get registrations
        // waiting 300 milisecond to gather all register calls from nodes
        (async function() {
            await new Promise(r => setTimeout(r, 300));
            //get registrations, compare them with nodes, send statuses and errors
            await processThings(RED, node)
        })();

        // init server
        this.httpServer = stoppable(http.createServer( (req, res) => {
            if (req.method === 'POST' || req.method === 'PUT') {
                let body = '';
                req.on('data', chunk => {
                    body += chunk.toString();
                });
                req.on('end', () => {
                    req.body = body
                    incomingServerRequest(req, res, node)
                });
            } else {
                incomingServerRequest(req, res, node)
            }
        }));

        // start server
        this.httpServer.listen(this.serverPort).on('error', (err)=>{
            node.error('Server problem: ' + err.message)
                })
        
        // registering nodes
        this.on('registerDevice', async function(id, type) {
            if (type === 'Device') {
                this.nodeIds.push(id)
            } else if (type === 'Service'){
                node.log('ERROR: Service is trying to register')
            }
        });

        // unregistering nodes after removal
        this.on('unregisterDevice',  async function(id) {
            const node = this
            node.unregisterRequests.push(id)
        });
        // unsubscribe all subscribed events
        this.on('unsibscribeEvents',  async function(id) {
            const node = this
            node.unsubscribeRequest.push(id)
        });

        // when closing conenction to agent -> unregister removed items
        this.on('close', function(removed, done) {
            node.log('Closig agent connector')
            // stop server
            this.httpServer.stop()
            // waiting 500ms to get all requests
            setTimeout(async function(){
                try {
                    //event unsubscribing
                    for (const unsubscribeId of node.unsubscribeRequest) {
                        for (const device of node.devices) {
                            if(device.nodeId == unsubscribeId){
                                for (const event of device.subscribedEvents) {
                                    await node.agent.unSubscribeFromEventChannel(device.oid, event.oid, event.eid )
                                }
                            }
                        }
                    }
                    // unregistering 
                    var oids = [];
                    for (const unregisterId of node.unregisterRequests) {
                        for (const device of node.devices) {
                            if(device.nodeId == unregisterId){
                                // if eventChannel
                                if(device.events.length > 0){
                                    //close event channel
                                    for (const eid of device.events) {
                                        await node.agent.removeEventChannel(device.oid, eid) 
                                    }
                                }
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
                    await node.agent.removeRegistrations(oids)
                    } catch (error) {
                        node.error('ERROR')
                        node.error(error)
                    }
                    done();
                },500);
        });
    }

    RED.nodes.registerType("auroralAgent", AuroralAgent,{
        credentials: {
            username: { type: "text" },
            password: { type: "password" },
        }
    })

    RED.httpAdmin.get("/getTd/:agentId/:adapterId", RED.auth.needsPermission('auroralAgent.read'), async function(req,res) {
        try {
            const agentNode = RED.nodes.getNode(req.params.agentId)
            if(!agentNode){
                throw new Error('Please first deploy configuration node')
            }
            const oid = (await agentNode.agent.getRegistrationByAdapterId(req.params.adapterId)).oid
            const td = await agentNode.agent.getTd(oid)
            res.json({ 'error': false, td })
        } catch (error) {
            res.json({ 'error': true, 'message': error.message })
        }
        
    });
    RED.httpAdmin.post("/updateTd/:agentId/:adapterId", RED.auth.needsPermission('auroralAgent.read'), async function(req,res) {
        try {
            const agentNode = RED.nodes.getNode(req.params.agentId)
            if(!agentNode){
                throw new Error('Please first deploy configuration node')
            }
            if(!req.body.td){
                throw new Error('Bad params')
            }
            const reg = (await agentNode.agent.getRegistrationByAdapterId(req.params.adapterId))
            const update = {td:{...JSON.parse(req.body.td), adapterId: reg.adapterId, id: reg.oid}}
            await agentNode.agent.putRegistration(update)
            res.json({ 'error': false })
        } catch (error) {
            // node.log(error.message) //display ERROR?
            res.status(400).json({ 'error': true, 'message': error.message })
        }
    });
    RED.httpAdmin.get("/deployed/:agentId/", RED.auth.needsPermission('auroralAgent.read'), async function(req,res) {
        try {
            const agentNode = RED.nodes.getNode(req.params.agentId)
            if(!agentNode){
                res.json({ value: false })
                return
            }
            res.json({ value: true, oid: agentNode.oid })
        } catch (error) {
            res.json({ value: false })
        }
    });
}

// compare local registered item with one in agent
// if there are changes return true
async function compareAndUpdate(local, agent){
    try {
        // to be sure
        if(local.adapterId != agent.adapterId){
            throw new Error ('unexpected error objectId != adapterId')
        }
        // update only devices
        if(agent.type !='Device'){
            return false
        }
        if(local.name != agent.name){
            console.log("Diff is :" + local.name + " " + agent.name)
            return true;
        }
        if(!agent.properties){
            agent.properties=[]
        }
        
        const localProps = JSON.stringify(local.properties, Object.keys(local.properties).sort())
        const remoteProps = JSON.stringify(agent.properties, Object.keys(agent.properties).sort())
        if( localProps != remoteProps ){
            console.log("Diff is :" + localProps + " " + remoteProps)
            return true;
        }
        // if(JSON.stringify(local.properties)  != JSON.stringify(agent.properties)){
        //     console.log("Diff is :" + JSON.stringify(local.properties) + " " + JSON.stringify(agent.properties))
        //     return true;
        // }
        if(!agent.events){
            agent.events=[]
        }
        if(JSON.stringify(local.events)  != JSON.stringify(agent.events)){
            console.log("Diff is :" + JSON.stringify(local.events) + " " + JSON.stringify(agent.events))
            return true;
        }
        return false
    } catch (error) {
        throw new Error('Error comparing items: ' + error)
    }
}

function incomingServerRequest(req, res, node) {
    // imports
    var uuid = require('uuid');
    var url = require('url');
    
    try {
        // /api/property/:oid/:pid
        // /api/event/:oid/:eid
        const urlObject = url.parse(req.url, true)
        const path = urlObject.pathname.split('/')
        
        if( path.length < 5 || path[1] != 'api'){
            // Error
            node.error('Bad params: '+ path)
            res.writeHead(400, {'Content-Type': 'application/json'});
            res.write(JSON.stringify({'err': "Bad request"}));
            res.end();
            return
        }
        
        if(req.method === 'PUT' && path[2] === 'event') {
            const reqOid = path[3]
            const reqEid = path[4]
            let targetDevice = undefined
            let sourceOid = undefined
            for (const device of node.devices) {
                if(device.oid === reqOid){
                    const result = device.subscribedEvents.filter(event => {
                        return event.eid === reqEid
                    })
                    if (result) {
                        sourceOid = result[0].oid
                        targetDevice = device
                        break
                    }
                }
            }
            if(!targetDevice){
                res.writeHead(400, {'Content-Type': 'application/json'});
                res.end();
                return
            }
            targetDevice.node.emit('eventRequest', { 'type': 'event', 'eid': reqEid, sourceOid, payload: JSON.parse(req.body) })
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end();
            return
        } else if ((req.method === 'GET' || req.method === 'PUT' ) && path[2] === 'property') {
            // get OID and PID from request
            const reqOid = path[3]
            const reqPid = path[4]
            let targetDevice = undefined
            // try to find OID in stored devices
            for (const device of node.devices) {
                // test if OID & PID matches (including getAll + getHistorical)
                if(device.oid == reqOid && [...device.properties, 'getAll', 'getHistorical'].includes(reqPid)){
                    targetDevice = device
                }
            }
            // Device not found
            if(!targetDevice) {
                node.error('OID/PID not found ['+reqOid + ', ' + reqPid+']')
                res.writeHead(400, {'Content-Type': 'application/json'});
                res.write(JSON.stringify({'err': 'Combination of OID and PID not found ['+ reqOid + ', ' + reqPid+']'}));
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
            if(req.method === 'PUT'){
                targetDevice.node.emit('propertyRequest', {'_auroralReqId': reqId, pid: reqPid, oid: reqOid, adapterId: targetDevice.adapterId, payload: JSON.parse(req.body), queryParams: urlObject.query} )
            } else {
                targetDevice.node.emit('propertyRequest', {'_auroralReqId': reqId, pid: reqPid, oid: reqOid, adapterId: targetDevice.adapterId, queryParams: urlObject.query} )
            }

            // timeout if request is not answereds
            setTimeout(async function(){
                // get requests from global storage
                var auroral_requests = (node.context().global).get('auroral_requests')
                if(auroral_requests[reqId] !== undefined) {
                    // request was not answered
                    node.error('Auroral node-red ' + targetDevice.name + '-' + reqPid + ' does not reach response node in given time')
                    const res = auroral_requests[reqId].res
                    // Send timeout
                    res.writeHead(408, {'Content-Type': 'application/json'});
                    res.write(JSON.stringify({err: 'Auroral node-red ' + targetDevice.name + ' pid: ' + reqPid + ' does not reach response node in given time'}));
                    res.end()
                    // remove from global variable
                    delete auroral_requests[reqId];
                    (node.context().global).set('auroral_requests', auroral_requests)
                } 
            }, config.localTimeout)
        } else {
            res.writeHead(400, {'Content-Type': 'application/json'});
            res.end();
            return
        }
    } catch (err) {
        node.error('Problem with request: ' + err.message)
    }
    
}

// process nodes, compare them with agent devices, displays errror and status
async function processThings(RED, node){
    try{
        node.log('Processing things')
        // get local node informations
        node.devices = await Promise.all((node.nodeIds).map(async (nodeId) => {
            const n = RED.nodes.getNode(nodeId)
            return {
                nodeId: n.id,
                adapterId: n.config.adapterId,
                name: n.config.name,
                type: n.config.devicetype,
                td: JSON.parse(n.config.td),
                properties: n.config.pids,
                events: n.config.eids,
                subscribedEvents: n.config.allowEventSubscription ? n.config.subscribedEvents : new Array(),
                regType: n.config.regType,
                // emit: n.emit,
                node: n
            }
        }));

        let devicesWithEventSubscription = new Array()
        // process all nodes that tries to register
        for (const device of node.devices) {
            try {
                const agentDevice = await node.agent.getRegistrationByAdapterId(device.adapterId)
                if(!agentDevice) { // device is not registered in agent
                    if(device.regType == 'newItem'){
                        // newItem -> register device
                        node.log('Registering device: ' + device.name)
                        const response = await node.agent.postRegistration({ td: { type: device.type, adapterId:device.adapterId, ...device.td}})
                        if(response[0].oid) {
                            node.log('Device: '+ device.adapterId + ' - now registered [' + response[0].oid +']')
                            device.oid = response[0].oid
                            device.node.oid=response[0].oid
                            // device.node.emit('registrationStatus', {type: 'ok', message: 'Registered'});
                            // Disabled by default
                            device.node.emit('registrationStatus', {type: 'warn', message: 'Registered - not enabled'});
                        }
                    } else {
                        // preregistration -> send error and does not process
                        node.log('Preregistered device is not registered: ' + device.adapterId + " - waiting")
                        device.node.emit('registrationStatus', {type: 'error', message: 'Please register thing in agent' });
                    }
                } else {
                    // device is registered in agent
                    // test if something changed
                    device.node.emit('registrationStatus', {type: 'info', message: 'Checking TD changes'});
                    if(await compareAndUpdate(device, agentDevice)){
                        // update of TD needed
                        node.log('Device: '+ device.name + ' - needs to fix TD')
                        device.node.emit('registrationStatus', {type: 'error', message: 'Please fix TD mismatch (agent/local)'});
                    } else {
                        device.oid = agentDevice.oid
                        device.node.oid=agentDevice.oid
                        node.log('Device: '+ device.name + ' - ready')
                        if(agentDevice.status == 'Enabled'){
                            device.node.emit('registrationStatus', {type: 'ok', message: 'Registered'});
                        } else {
                            device.node.emit('registrationStatus', {type: 'warn', message: 'Registered - not enabled'});
                        }
                    }
                }
                // register events
                if(device.events.length > 0 && device.oid) {
                    await Promise.all((device.events).map(async (event) => {
                        const eventResponse = await node.agent.createEventChannel(device.oid, event)
                    }))
                }
                if(device.subscribedEvents.length > 0) {
                    devicesWithEventSubscription.push(device)
                }
            } catch (error) {
                node.log(error.message)
            }
            for (const device of devicesWithEventSubscription) {
                try{
                    await Promise.all((device.subscribedEvents).map(async (event) => {
                        if(device.oid){
                            const eventResponse = await node.agent.subscribeToEventChannel(device.oid, event.oid, event.eid)
                        }
                    }))
                } catch(err) {
                    device.node.emit('registrationStatus', {type: 'error', message: 'Event is not subscribable'});
                    node.error(err)
                }
                
            }
        }
    } catch (error){
        // unexpected error
        node.error('Problem with agent: ' + error)
   } 
}
