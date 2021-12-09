module.exports = function(RED) {
    function AuroralRequest(config) {
        RED.nodes.createNode(this,config);
        this.agent = RED.nodes.getNode(config.agent);
        const node = this
        // this.config.outputs = 2
        this.agentNode = (node.context().global).get('auroral_agent')
        const pids = JSON.parse(config.pids)
        this.agentNode.emit('registerDevice', { "objectId": config.objectId, "name": config.name, pids,"node": this })
        this.status({fill:"red",shape:"ring",text:"waiting"});
        const auroral_objects = (node.context().global).get('auroral_objects');
        this.outputs = 2;
        this.on('request', function(obj) {
            try{
                var toSend=[];
                pids.forEach(pid => {
                    if(pid == obj.pid){
                        toSend.push(obj)
                    }
                    else{
                        toSend.push([])
                    }
                });
                this.send(toSend);
            } catch{
                node.error("pid mismatch")
            }
        });

        this.on('registered', function(removed, done) {
            // TODO change status to green
            this.status({fill:"green",shape:"dot",text:"registered"});

        });
        this.on('close', function(removed, done) {
            if (removed) {
            this.agentNode.emit('unregisterDevice', config.objectId)
            }
            done();
        });
        
    }
    RED.nodes.registerType("auroralRequest",AuroralRequest);
}
