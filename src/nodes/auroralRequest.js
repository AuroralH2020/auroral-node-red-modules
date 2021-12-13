module.exports = function(RED) {
    function AuroralRequest(config) {
        RED.nodes.createNode(this,config);
        // get agent settings
        this.agent = RED.nodes.getNode(config.agent);
        const pids = JSON.parse(config.pids)
        const node = this
        // get agent node and emit registration event
        this.agentNode = (node.context().global).get('auroral_agent')
        this.agentNode.emit('registerDevice', { "objectId": config.objectId, "name": config.name, pids,"node": this }, 'Device')
        // change status for waiting
        this.status({fill:"red",shape:"ring",text:"waiting"});
        // const auroral_objects = (node.context().global).get('auroral_objects');

        // incoming request
        this.on('request', function(obj) {
            node.log('New request in node: ' + node.name)
            try{
                var toSend=[];
                // search for proper output by PID
                pids.forEach(pid => {
                    // create message containing only one output [ [], [], msg, [] ]
                    if(pid == obj.pid){
                        // node.log('sending to: '+ obj.pid)
                        toSend.push(obj)
                    }
                    else{
                        toSend.push([])
                    }
                });
                // send out 
                this.send(toSend);
            } catch{
                // unexpected error
                node.error("pid mismatch")
            }
        });
        
        // device is registered -> change status to green
        this.on('registered', function(removed, done) {
            this.status({fill:"green",shape:"dot",text:"registered"});
        });

        // closing flow, or removing node
        this.on('close', function(removed, done) {
            if (removed) {
                // if node is removed, call agent to unregister
                this.agentNode.emit('unregisterDevice', config.objectId)
            }
            done();
        });
    }
    RED.nodes.registerType("auroralRequest",AuroralRequest);
}
