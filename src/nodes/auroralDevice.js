module.exports = function(RED) {
    function AuroralDevice(config) {
        RED.nodes.createNode(this,config);
        const node = this
        node.config = config
        // get agent settings
        this.agentNode = RED.nodes.getNode(config.agent);
        // TEST TD
        try {
            const td = JSON.parse(config.td)
        } catch (error) {
            node.status({ fill:"red", shape:"ring", text:"Error in TD" });
            node.error('TD is not JSON')
            return
        }
        try {
            // test PIDS
            if(!Array.isArray(config.pids)){
                throw new Error('Pids is not array of string');
            }
            // test EIDS
            if(!Array.isArray(config.eids)){
                throw new Error('Pids is not array of string');
            }
            // test NAME
            if(!(config.name && (typeof config.name == 'string' || config.name instanceof String))) {
                throw new Error("TD.title missing")
            }
            // test subscribed events
            if(config.allowEventSubscription){
                if(!Array.isArray(config.subscribedEvents)){
                    throw new Error("Subscribed events needs to be array of {'oid':'', 'eid':''}")
                }
                config.subscribedEvents.forEach(event => {
                    if(!event.oid || !event.eid){
                        throw new Error("Subscribed events needs to be array of {'oid':'', 'eid':''}")
                    }
                });
            }
        } catch(err) {
            node.status({ fill:"red", shape:"ring", text:"Wrong settings" });
            node.error(err.message)
            return
        }
        this.type = 'Device'
        // change status for waiting
        this.status({ fill:"grey", shape:"ring", text:"waiting for registration response" });
        this.agentNode.emit('registerDevice', this.id , this.type)

        // incoming property request
        this.on('propertyRequest', function(obj) {
            const node = this
            node.log('Property request in node: ' + node.name)
            this.sendMessage(obj, undefined, undefined)
        });
        // incoming request
        this.on('eventRequest', function(obj) {
            const node = this
            node.log('Event request in node: ' + node.name)
            this.sendMessage(undefined, obj, undefined)
        });
        
        // device registration status has changed
        this.on('registrationStatus', function(status) {
            if(status.type === 'error'){
                node.status({fill:"red",shape:"ring",text: status.message});
            } else if (status.type === 'ok') {
                this.status({ fill:"green", shape:"dot", text: status.message });
            } else {
                this.status({ fill:"orange", shape:"dot", text: status.message });
            }
        });
        // msg on input
        this.on('input', async function(msg, send, done) {
            const node = this
            try {
                //  NOT READY
                if(!this.oid){
                    throw new Error('Not ready')
                }   
                // Unknown OID and PID
                if(!msg.type){
                    throw new Error('Set msg.type')
                }
                if(msg.type === 'property'){
                    if(!msg.oid){
                        throw new Error('Set msg.oid')
                    }
                    if(!node.config.allowInput){
                        throw new Error('Please allow getProperty')
                    }
                    if(!msg.pid){
                        throw new Error('Set msg.pid')
                    }
                    // get requested data
                    try {
                        let requestedData
                        if(msg.payload) {
                            requestedData = await node.agentNode.agent.putProperties(node.oid, msg.oid, msg.pid, msg.payload)
                        } else (
                            requestedData = await node.agentNode.agent.getProperties(node.oid, msg.oid, msg.pid)
                        )
                        if(requestedData){
                            node.sendMessage(undefined, undefined, {payload: requestedData, oid: msg.oid, pid: msg.pid})
                        } else {
                            throw new Error('Error requesting data from agent')
                        }
                    } catch (error) {
                        node.error('ERROR:' + error)
                        done();
                        return;
                    }
                } else if ( msg.type === 'event'){
                    if(!msg.eid){
                        throw new Error('Set msg.eid')
                    }
                    // test eid is registered
                    if(!node.config.eids.includes(msg.eid)){
                        throw new Error('Eid is not registered')
                    }
                    // send event
                    try {
                        const payload = node.agentNode.agent.responseMessageFormat(msg.payload) 
                        await node.agentNode.agent.sendEventToChannel(node.oid, msg.eid, payload)
                    } catch (error) {
                        node.error('ERROR:' + error)
                        done();
                        return;
                    }
                } else {
                    throw new Error('Unknown type')
                }
            } catch (error) {
                node.error('ERROR: ' + error.message)
                done()
                return
            }
        });
        // closing flow, or removing node
        this.on('close', function(removed, done) {
            const node = this
            if (node.config.allowEventSubscription && node.oid) {
                node.agentNode.emit('unsibscribeEvents', node.id)
            }
            // if node removed and unregistering is enabled 
            if (removed && node.config.unregistering) {
                // call agent to unregister
                node.agentNode.emit('unregisterDevice', node.id)
            }
            done();
        });
        // sending message to proper output  (based on nodes properties)
        this.sendMessage = function (propRequest, subEvent, reqPropResponse) {
            propRequest = propRequest ? propRequest : []
            subEvent = subEvent ? subEvent : []
            reqPropResponse = reqPropResponse ? reqPropResponse : []
            let msg = []
            if(this.config.pids.length > 0 ) {
                msg.push(propRequest)
            } 
            if(this.config.allowEventSubscription){
                msg.push(subEvent)
            }
            if(this.config.allowInput){
                msg.push(reqPropResponse)
            }
            this.send(msg)
        }
    }
    RED.nodes.registerType("auroralDevice", AuroralDevice);
}
