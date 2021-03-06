const state = require('../services/state.js');
const bcrypt = require('bcryptjs');
const authService = require('../services/auth-service.js');
const errorService = require('../services/custom-error.js');
const selectService = require("../services/select-service.js");
const socketService = require("../services/socket-io-service.js");
const messageService = require("../services/message-service.js");
const customRouter = require("../services/custom-router.js");

export async function getSuggestions(name) {

    if(state.eventNames.names.length > 0) { return state.eventNames.names.filter(x => x.toLowerCase().includes(name)).slice(0, 10); }
    return [];
}
export async function getAllEventNames() {

    const header = await authService.getHeader('GET');
    const response = await fetch(`${state.domain.url}/api/events`, header);
    if (response.ok) {
        const names = await response.json();
        state.eventNames.names = names;
    }
}
export async function saveNewEvent(name, password) {

    const event = { _id: authService.generateUuid(), name: name, password: await bcrypt.hash(password, 10), admin: state.userstate.key, date: new Date() };
    const hashedData = await authService.hashData(JSON.stringify(event));
    const body = JSON.stringify({ data: hashedData })
    const header = await authService.getHeader('POST', body);
    const response = await fetch(`${state.domain.url}/api/events`, header);
    if (response.ok) { 
        const responseEvent = await response.json();
        return responseEvent; 
    }
    else { return false; }
}
export async function checkEventPassword(data) {

    const dataJson = JSON.stringify(data); 
    const hashedData = await authService.hashData(dataJson);
    const body = JSON.stringify({ data: hashedData });
    const header = await authService.getHeader('POST', body);
    const response = await fetch(`${state.domain.url}/api/signinevent`, header);
    if (response.ok) { return await response.json(); }
    else { return false; }
}
export async function proceedSelectEvent(component) {

    if(!component.event) { errorService.setError("Please select your event", "event"); return; }
    if(!component.password) { errorService.setError("Please type event's password", "password"); return; }
    component.showLoader = true;
    const event = await checkEventPassword({ event: component.event, password: component.password }); 
    if(event) { 
        await setCurrentEvent(event);
        await socketService.initializeConnection();
        await messageService.loadMessages();
        if(state.userstate.key === state.eventstate.admin) { await messageService.loadDeleted(); }
        customRouter.navigate('messages', component);
    }
    else {
        errorService.setError("Event name and password do not match", "password"); 
        component.showLoader = false; 
        return;
    }
}
export async function proceedCreateEvent(component) {
    
    if(!state.userstate.key) { 
        memorizeFields(component);
        errorService.setError("Please log in first in order to create an event", "btn"); 
        return; 
    }
    if(!component.event) { errorService.setError("Please select a name for your event", "event"); return; }
    if(!component.event.match('^[a-zA-Z0-9 ]+$')) { errorService.setError('Event name should contain letters numbers and spaces only', 'event'); return; }
    if(component.event.length > 30 || component.event.length < 3) { errorService.setError("Your event name should be between 3 and 30 symbols", "event"); return; }
    if(!component.password) { errorService.setError("Please choose a password for this event", "password"); return; }
    if(component.password.length > 30 || component.password.length < 3) { errorService.setError("Your password should be between 3 and 30 symbols", "password"); return; }
    if(state.eventNames.names.includes(component.event)) { errorService.setError("Sorry but this name is already taken", "event"); return; }
    console.log('after input filters')
    component.showLoader = true;
    const event = await selectService.saveNewEvent(component.event, component.password);

    if(event) {
        resetFields(); 
        await setCurrentEvent(event); 
        await socketService.initializeConnection();
        await socketService.updateEventNames(event.name);
        component.$router.push('messages'); 
    }
}
export function modalSection() {
    setTimeout(() => {
        const element = document.getElementById("modal");
        if (element) { element.style.display = "none"; }
        state.message.mess = null;
      }, 3000);
}
async function setCurrentEvent(event) {
    state.eventstate.key = event._id;
    state.eventstate.name = event.name;
    state.eventstate.date = event.date;
    state.eventstate.admin = event.admin;
    state.eventstate.token = event.token;
    state.eventstate.deleted = [];
    state.eventstate.messages = [];
}
function memorizeFields(component) {
    state.selectFields.event = component.event;
    state.selectFields.password = component.password;
}
function resetFields() {
    state.selectFields.event = null;
    state.selectFields.password = null;
}