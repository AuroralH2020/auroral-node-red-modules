module.exports = function(RED) {
    function AuroralRequest(config) {
        RED.nodes.createNode(this,config);
        const node = this
        node.config = config
        // get agent settings
        this.agent = RED.nodes.getNode(config.agent);
        let pids = []
        //check if PIDS is array of string
        try {
            const pidsParsed = JSON.parse(config.pids);
            if(!Array.isArray(pidsParsed)){
                throw new Error('PIDS has to be array of strings');
                
            }
            pidsParsed.forEach(pid => {
                if(typeof pid != 'string'){
                    throw new Error('PIDS has to be array of strings');
                }
            })
            pids = pidsParsed
        } catch(err) {
            node.status({fill:"red",shape:"ring",text:"Wrong PIDs"});
            node.error('PIDS has to be array of strings')
            return
        }
        
        // change status for waiting
        this.status({fill:"grey",shape:"ring",text:"waiting for registration response"});

        // get agent node and emit registration event
        this.agentNode = (node.context().global).get('auroral_agent')
        this.agentNode.emit('registerDevice', { "objectId": config.objectId, "name": config.name, pids, "registering": config.registering,"node": this }, 'Device')
        
        // const auroral_objects = (node.context().global).get('auroral_objects');

        // incoming request
        this.on('request', function(obj) {
            node.log('New request in node: ' + node.name)
            try{
                var toSend=[];
                // search for proper output by PID
                if(this.config.separateOutputs){
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
                    toSend.push(obj)
                }
                // send out 
                this.send(toSend);
            } catch{
                // unexpected error
                node.error("pid mismatch")
            }
        });
        
        // device is registered -> change status to green
        this.on('registered', function(oid) {
            this.status({ fill:"green", shape:"dot", text:"registered" });
        });
        this.on('registrationFailure', function(text) {
            node.status({fill:"red",shape:"ring",text});
        });

        // closing flow, or removing node
        this.on('close', function(removed, done) {
            const node = this
            // if node removed and unregistering is enabled 
            if (removed && node.config.unregistering) {
                // call agent to unregister
                this.agentNode.emit('unregisterDevice', config.objectId)
            }
            done();
        });
    }
    RED.nodes.registerType("auroralRequest",AuroralRequest);
}
