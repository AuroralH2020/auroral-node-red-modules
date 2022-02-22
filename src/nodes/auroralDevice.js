module.exports = function(RED) {
    function AuroralDevice(config) {
        RED.nodes.createNode(this,config);
        const node = this
        node.config = config
        // get agent settings
        this.agentNode = RED.nodes.getNode(config.agent);
        let pids = []
        // TEST TD
        try {
            const td = JSON.parse(config.td)
        } catch (error) {
            node.status({ fill:"red", shape:"ring", text:"Error in TD" });
            node.error('TD needs to be JSON object')
            return
        }
        //TEST PIDS
        try {
            if(!Array.isArray(config.pids)){
                throw new Error('PIDS has to be array of strings');
            }
            config.pids.forEach(pid => {
                if(typeof pid != 'string'){
                    throw new Error('PIDS has to be array of strings');
                }
            })
            pids = config.pids
        } catch(err) {
            node.status({ fill:"red", shape:"ring", text:"Wrong PIDs" });
            node.error('PIDS has to be array of strings')
            return
        }
        //TEST NAME
        try {
            if(!(config.name && (typeof config.name == 'string' || config.name instanceof String))) {
                throw new Error()
            }
        } catch(err) {
            node.status({ fill:"red", shape:"ring", text:"Wrong TD" });
            node.error('TD is missing Title field')
            return
        }
        
        // change status for waiting
        this.status({ fill:"grey", shape:"ring", text:"waiting for registration response" });
        this.agentNode.emit('registerDevice', this.id , 'Device')

        // incoming request
        this.on('request', function(obj) {
            node.log('New request in node: ' + node.name)
            try{
                var toSend=[];
                // search for proper output by PID
                if(!this.config.mergeOutputs){
                    pids.forEach(pid => {
                        // create output message only for one output  [ [], [], msg, [] ]
                        if(pid == obj.pid){
                            // node.log('sending to: '+ obj.pid)
                            toSend.push(obj)
                        }
                        else{
                            toSend.push([])
                        }
                    });
                }
                else{
                    if(this.config.allowInput){
                        toSend=[obj,[]]
                    } else{
                        toSend.push(obj)
                    }
                }
                // send out 
                this.send(toSend);
            } catch {
                // unexpected error
                node.error("pid mismatch")
            }
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
        this.on('input', function(msg, send, done) {
            const node = this
            //  NOT READY
            if(this.oid == undefined){
                node.error('ERROR: Not yet registered ')
                done();
                return;
            }
            // Unknown OID and PID
            if(!msg.oid || !msg.pid) {
                node.error('ERROR: Set msg.oid and msg.pid')
                done()
                return;
            }
            // get requested data
            (async function() {
                try {
                    const requestedData = await node.agentNode.agent.getProperties(node.oid, msg.oid, msg.pid)
                    if(requestedData){
                        var toSend=[];
                        if(!node.config.mergeOutputs){
                            pids.forEach(pid => {
                                toSend.push([])
                            });
                            toSend.push({payload: requestedData})
                        }
                        else{
                            toSend.push([])
                            toSend.push({payload: requestedData})
                        }
                        send(toSend)
                    } else {
                        throw new Error('Timeout')
                    }
                } catch (error) {
                    node.error('ERROR:' + error)
                    done();
                    return;
                }
            })();
        });
        // closing flow, or removing node
        this.on('close', function(removed, done) {
            const node = this
            // if node removed and unregistering is enabled 
            if (removed && node.config.unregistering) {
                // call agent to unregister
                node.agentNode.emit('unregisterDevice', node.id)
            }
            done();
        });
    }
    RED.nodes.registerType("auroralDevice", AuroralDevice);
}
