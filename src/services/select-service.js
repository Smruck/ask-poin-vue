const state = require('../services/state.js');
const bcrypt = require('bcryptjs');
const authService = require('../services/auth-service.js');
const errorService = require('../services/custom-error.js');
const selectService = require("../services/select-service.js");
const socketService = require("../services/socket-io-service.js");
const messageService = require("../services/message-service.js");

export async function getSuggestions(name) {

    if(state.eventNames.names.length > 0) { return state.eventNames.names.filter(x => x.toLowerCase().includes(name)).slice(0, 10); }
    return [];
}
export async function getAllEventNames() {

    const header = await authService.getHeader('GET');
    const result = await fetch(`${state.domain.url}/api/events`, header);
    if (result.ok) {
        const names = await result.json();
        state.eventNames.names = names;
    }
}
export async function saveNewEvent(name, password) {

    const event = { _id: authService.generateUuid(), name: name, password: await bcrypt.hash(password, 10), admin: state.userstate.key, date: new Date() };
    const hashedData = await authService.hashData(JSON.stringify(event));
    const body = JSON.stringify({ data: hashedData })
    const header = await authService.getHeader('POST', body);
    const response = await fetch(`${state.domain.url}/api/events`, header);
    const load = await response.json();
    console.log(load);
    if (response.ok) { setCurrentEvent(load); return true; }
    return false;
}
export async function checkEventPassword(data) {

    const dataJson = JSON.stringify(data); 
    const hashedData = await authService.hashData(dataJson);
    const body = JSON.stringify({ data: hashedData });
    const header = await authService.getHeader('POST', body);
    const response = await fetch(`${state.domain.url}/api/signinevent`, header);
    if (response.ok) { return await response.json(); }
    return false; 
}
export async function checkInputDataSelect(component) {

    component.clearErrors();
    if(!component.event) { errorService.setError("Please select your event", "event"); return; }
    if(!component.password) { errorService.setError("Please type event's password", "password"); return; }
    component.showLoader = true;
    const event = await checkEventPassword({ event: component.event, password: component.password }); 
    if(!event) { 
        errorService.setError("Event name and password do not match", "password"); 
        component.showLoader = false; 
        return;
    }
    else {
        setCurrentEvent(event);
        await messageService.loadMessages();
        if(state.userstate.key === state.eventstate.admin) { await messageService.loadDeleted(); }
        socketService.initializeConnection();
    }
    component.$router.push('messages');
}
export async function checkInputDataCreate(component) {
    
    component.clearErrors();
    if(!state.userstate.key) { errorService.setError("Please log in first in order to create an event", "btn"); return; }
    if(!component.event) { errorService.setError("Please select a name for your event", "event"); return; }
    if(!component.event.match('^[a-zA-Z0-9 ]+$')) { errorService.setError('Event name should contain letters numbers and spaces only', 'event'); return; }
    if(component.event.length > 30 || component.event.length < 3) { errorService.setError("Your event name should be between 3 and 30 symbols", "event"); return; }
    if(!component.password) { errorService.setError("Please choose a password for this event", "password"); return; }
    if(component.password.length > 30 || component.password.length < 3) { errorService.setError("Your password should be between 3 and 30 symbols", "password"); return; }
    if(state.eventNames.names.includes(component.event)) { errorService.setError("Sorry but this name is already taken", "event"); return; }
    component.showLoader = true;
    const resultSave = await selectService.saveNewEvent(component.event, component.password);
    if(resultSave) { 
        socketService.initializeConnection(state.eventstate.token);
        socketService.updateEventNames(component.event);
        component.$router.push('messages'); 
    }
}
function setCurrentEvent(event) {
    state.eventstate.key = event._id;
    state.eventstate.name = event.name;
    state.eventstate.date = event.date;
    state.eventstate.admin = event.admin;
    state.eventstate.token = event.token;
}