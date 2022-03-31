module.exports = function(RED) {
    function Registrations(config) {
        RED.nodes.createNode(this,config);
        this.agent = RED.nodes.getNode(config.agent);
        
        // incoming message
        this.on('input',  async function(msg, send, done) {
            const node = this
            try {
                const agentNode = RED.nodes.getNode(config.agent);
                const registrations = await agentNode.agent.getRegistrations()
                if(!registrations){
                    node.error('Agent is offline')
                    return
                }
                //get registrationData with pids and adapterId
                let regDetails = await Promise.all(registrations.map(async (reg) => {
                    const returnObj = await agentNode.agent.getRegistration(reg)
                    // var returnObj = await getAgent(node, 'api/registration/' + reg)
                    returnObj.oid = reg
                    return returnObj
                }));
                if(regDetails){
                    send({payload: regDetails})
                }
            } catch (error) {
                node.error(error)
                done();
            }
        });
    }
    RED.nodes.registerType("registrations",Registrations);
}