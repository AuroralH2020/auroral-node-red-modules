// communication with auroral agent
const got = require('got');
const config = require('./config')

class Agent {
    constructor( baseUrl, ignoreCertificate, username, password ) {
        // create GOT options
        this.requestOptions = {
            prefixUrl: baseUrl,
            responseType: 'json',
            username,
            password,
            https: {
                rejectUnauthorized: ignoreCertificate? false : true,
            },
            timeout: {
                response: config.agentTimeout
            }
        };
    }
    // get all registrations from agent
    getRegistrations = async function () {
        try {
            const response = await got.get('api/registration/', this.requestOptions);
            return response.body
        } catch (error) {
            throw new Error('Error getting registrations: ' + error)
        }
    }
    // get properties for registration
    getRegistration = async function (id) {
        try {
            const response = await got.get('api/registration/' + id, this.requestOptions);
            return response.body
        } catch (error) {
            throw new Error('Error getting registration: ' + error)
        }
    }
    // get properties for registration
    getRegistrationByAdapterId = async function (adapterId) {
        // console.log('get registration by adapterId')
        try {
            if(!this.registeredDevices){
                const agentRegistrations = await this.getRegistrations()
                this.registeredDevices = await Promise.all(agentRegistrations.map(async (oid) => {
                    let returnObj = await this.getRegistration(oid)
                    returnObj.oid = oid
                    return returnObj
                }));
            }
            let registration
            this.registeredDevices.forEach(reg => {
                if(reg.adapterId === adapterId){
                    registration = reg
                }
            });
            if(registration){
                return registration
            } else {
                return null
            }
        } catch (error) {
            throw new Error('Error getting registration: ' + error)
        }
    }
    // returns thing description
    getTd = async function (id) {
        try {
            const response = await got.get('api/discovery/local/td/' + id, this.requestOptions);
            if(response.statusCode !== 200){
                throw new Error('Error getting TD from agent')
            }
            return response.body
        } catch (error) {
            throw new Error('Error getting TD from agent')
        }
    }
    // register object
    postRegistration = async function (obj) {
        console.log('registering thing')
        try {
            const response = await got.post('api/registration/', {...this.requestOptions, json: obj});
            if(response.statusCode >= 400){
                throw new Error(response.message)
            }
            return response.body
        } catch (error) {
            throw new Error('Error getting TD: ' + error)
        }
    }
    // register object
    putRegistration = async function (obj) {
        console.log('updating thing')
        try {
            const response = await got.put('api/registration/', {...this.requestOptions, json: obj});
            return response.body
        } catch (error) {
            throw new Error('Error getting TD: ' + error)
        }
    }
    // removing registration
    removeRegistrations = async function (oids) {
        // console.log('Removing registration: ' + oids)
        try {
            const response = await got.post('api/registration/remove' , {...this.requestOptions, json: {oids: oids}});
            return response.body
        } catch (error) {
            throw new Error('Error getting TD: ' + error)
        }
    }
    // removing registration
    getProperties = async function (id, oid, pid) {
        console.log('Getting property as ID:' + id + " OID:"+ oid + ' PID:' + pid)
        try {
            const response = await got.get('api/properties/'+id+'/'+oid+'/'+pid , {...this.requestOptions});
            // console.log(response)
            if(response.statusCode !== 200){
                throw new Error('Error getting properties from agent')
            }
            return response.body
        } catch (error) {
            throw new Error('Error getting TD: ' + error)
        }
    }
  }

module.exports =  Agent