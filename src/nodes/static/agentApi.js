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
        try{
            const response = await got.get('api/registration/oid/' + adapterId,  {...this.requestOptions, responseType: 'text'});
            if(response.body){
                const device = await this.getRegistration(response.body)
                return {...device, oid: response.body}
            } else {
               return null
            }
        } catch(error) {
            throw new Error('Error getting registration by adapterId: ' + error)
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
            throw new Error('Error new registration: ' + error)
        }
    }
    // register object
    putRegistration = async function (obj) {
        try {
            if(!obj.td.id){
                throw new Error('TD update - ID is missing')
            }
            console.log('Updating TD: ' + obj.id )
            const response = await got.put('api/registration/', {...this.requestOptions, json: obj});
            return response.body
        } catch (error) {
            throw new Error('Error updating registration: ' + error)
        }
    }
    // removing registration
    removeRegistrations = async function (oids) {
        // console.log('Removing registration: ' + oids)
        try {
            const response = await got.post('api/registration/remove' , {...this.requestOptions, json: {oids: oids}});
            return response.body
        } catch (error) {
            throw new Error('Error removing registration: ' + error)
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
            throw new Error('Error getting properties: ' + error)
        }
    }

    sendEventToChannel = async function (oid, eid, data) {
        console.log('Sending event to channel: ' + " OID:"+ oid + ' EID:' + eid + ' DATA: '+ data)
        try {
            const response = await got.put('api/events/local/' + oid + '/' + eid , {json: data, ...this.requestOptions});
            // console.log(response)
            if(response.statusCode !== 200){
                throw new Error('Error sending event')
            }
            return response.body
        } catch (err) {
            throw new Error(err.message)
        }
    }

    createEventChannel = async function (oid, eid) {
        console.log('Create event channel: ' + " OID:"+ oid + ' EID:' + eid)
        try {
            const response = await got.post('api/events/local/' + oid + '/' + eid , {...this.requestOptions});
            // console.log(response)
            if(response.statusCode !== 200){
                throw new Error('Error creating event channel')
            }
            return response.body
        } catch (err) {
            throw new Error(err.message)
        }
    }

    removeEventChannel = async function (oid, eid) {
        console.log('Removing event channel: ' + " OID:"+ oid + ' EID:' + eid)
        try {
            const response = await got.delete('api/events/local/' + oid + '/' + eid , {...this.requestOptions});
            // console.log(response)
            if(response.statusCode !== 200){
                throw new Error('Error removing event channel')
            }
            return response.body
        } catch (err) {
            throw new Error(err.message)
        }
    }

    subscribeToEventChannel = async function (id, oid, eid) {
        console.log('Subscribing to event channel ID: ' + id + " OID: "+ oid + ' EID:' + eid)
        try {
            const response = await got.post('api/events/remote/' + id + '/' + oid + '/' + eid , {...this.requestOptions});
            if(response.statusCode !== 200){
                throw new Error('Error subscribing event channel')
            }
            return response.body
        } catch (err) {
            throw new Error(err.message)
        }
    }
    unSubscribeFromEventChannel = async function (id, oid, eid) {
        console.log('Unsubscribing from event channel: ' + " OID:"+ oid + ' EID:' + eid)
        try {
            const response = await got.delete('api/events/remote/' + id + '/' + oid + '/' + eid , {...this.requestOptions});
            if(response.statusCode !== 200){
                throw new Error('Error unsubscribing event channel')
            }
            return response.body
        } catch (err) {
            throw new Error(err.message)
        }
    }
    eventChannelStatus = async function (id, eid) {
        try {
            const response = await got.get('api/events/remote/' + id + '/' + eid , {...this.requestOptions});
            if(response.statusCode !== 200){
                throw new Error('Error getting event channel status')
            }
            return response.body
        } catch (err) {
            throw new Error(err.message)
        }
    }
    responseMessageFormat = function (data) {
        return typeof data != 'object' ? {'value': data } : data
    }
  }

module.exports =  Agent