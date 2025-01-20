let selectedStartDate, selectedEndDate;
let calendar; // Global calendar variable
let currentEvent = null;
let currentReminderSettings = null;

// Add helper function for generating unique IDs
function generateUniqueId() {
    return 'evt_' + Math.random().toString(36).substr(2, 9);
}

function generateSeriesId() {
    return 'series_' + Math.random().toString(36).substr(2, 9);
}

document.addEventListener('DOMContentLoaded', function() {
    const calendarEl = document.getElementById('calendar');
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,dayGridWeek,dayGridDay'
        },
        editable: true,
        selectable: true,
        selectMirror: true,
        dayMaxEvents: true,
        
        select: function(info) {
            selectedStartDate = info.start;
            selectedEndDate = info.end;
            showEventModal();
            const modal = document.getElementById('eventAddModal');
            modal.style.display = 'block';
            
            document.getElementById('addEventForm').onsubmit = function(e) {
                e.preventDefault();
                const title = document.getElementById('eventTitleAdd').value;
                const recurrence = document.getElementById('eventRecurrence').value;
                
                if (recurrence === 'none') {
                    // Single event
                    const eventId = generateUniqueId();
                    calendar.addEvent({
                        id: eventId,
                        title: title,
                        start: info.start,
                        end: info.end,
                        extendedProps: {
                            seriesId: null
                        }
                    });
                } else {
                    // Recurring event
                    const seriesId = generateSeriesId();
                    const recurrenceEnd = document.getElementById('recurrenceEnd').value;
                    const endDate = new Date(recurrenceEnd);
                    
                    // Generate recurring events
                    let currentDate = new Date(info.start);
                    while (currentDate <= endDate) {
                        const eventId = generateUniqueId();
                        calendar.addEvent({
                            id: eventId,
                            title: title,
                            start: new Date(currentDate),
                            end: new Date(currentDate.getTime() + (info.end - info.start)),
                            extendedProps: {
                                seriesId: seriesId
                            }
                        });
                        
                        // Increment date based on recurrence pattern
                        switch(recurrence) {
                            case 'daily':
                                currentDate.setDate(currentDate.getDate() + 1);
                                break;
                            case 'weekly':
                                currentDate.setDate(currentDate.getDate() + 7);
                                break;
                            case 'biweekly':
                                currentDate.setDate(currentDate.getDate() + 14);
                                break;
                            case 'monthly':
                                currentDate.setMonth(currentDate.getMonth() + 1);
                                break;
                        }
                    }
                }
                
                modal.style.display = 'none';
                calendar.unselect();
            };
        },
        
        eventClick: function(info) {
            showEventEditModal(info.event);
            currentEvent = info.event;
            const modal = document.getElementById('eventEditModal');
            modal.style.display = 'block';
            
            document.getElementById('eventTitle').value = currentEvent.title;
            
            // Update delete handlers to use series ID
            document.querySelector('.delete-this-occurrence').onclick = function() {
                deleteEvent(currentEvent.id, false);
                closeEventEditModal();
            };
            
            // document.querySelector('.delete-all-occurrences').onclick = function() {
            //     const seriesId = currentEvent.extendedProps.seriesId;
            //     if (currentEvent.extendedProps.seriesId) {
            //         deleteEvent(currentEvent.id, true);
            //     } else {
            //         deleteEvent(currentEvent.id, false);
            //     }
            //     closeEventEditModal();
            // };

            // Update save handlers to use series ID
            document.querySelector('.save-this-occurrence').onclick = function() {
                updateEvent(currentEvent.id, false);
                closeEventEditModal();
            };

            document.querySelector('.save-all-occurrences').onclick = function() {
                const seriesId = currentEvent.extendedProps.seriesId;
                if (seriesId) {
                    updateEvent(currentEvent.id, true);
                } else {
                    // If no series ID, just update the single event
                    updateEvent(currentEvent.id, false);
                }
                closeEventEditModal();
            };
        },
        
        events: JSON.parse(localStorage.getItem('calendarEvents') || '[]')
    });
    
    calendar.render();
    
    // Add event listener for recurring checkbox
    document.getElementById('is-recurring').addEventListener('change', function(e) {
        document.getElementById('recurrence-options').style.display = 
            e.target.checked ? 'block' : 'none';
    });
    
    // Save events when changes occur
    ['eventAdd', 'eventChange', 'eventRemove'].forEach(function(e) {
        calendar.on(e, function() {
            saveEvents(calendar);
        });
    });
    
    // Get input elements using the correct IDs
    const groceryInput = document.getElementById('grocery-item');
    const todoInput = document.getElementById('todo-item');

    // Add event listeners for Enter key
    groceryInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addGroceryItem();
        }
    });

    todoInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTodoItem();
        }
    });

    addClearCalendarButton();
});

function showEventModal() {
    document.getElementById('event-modal').style.display = 'block';
    document.getElementById('event-title').focus();
    
    // Reset form
    document.getElementById('event-title').value = '';
    document.getElementById('is-recurring').checked = false;
    document.getElementById('recurrence-options').style.display = 'none';
    document.querySelectorAll('.weekday-selector input').forEach(cb => cb.checked = false);
}

function closeEventModal() {
    document.getElementById('event-modal').style.display = 'none';
}

function saveEvent() {
    const title = document.getElementById('event-title').value.trim();
    if (!title) {
        alert('Please enter an event title');
        return;
    }
    
    const isRecurring = document.getElementById('is-recurring').checked;
    let recurrencePattern = null;
    
    if (isRecurring) {
        const recurrenceType = document.querySelector('input[name="recurrence"]:checked').value;
        const recurWeeks = document.getElementById('recur-weeks').value;
        const selectedDays = Array.from(document.querySelectorAll('.weekday-selector input:checked'))
            .map(checkbox => checkbox.value);
            
        if (recurrenceType === 'weekly' && selectedDays.length === 0) {
            alert('Please select at least one day of the week');
            return;
        }
        
        recurrencePattern = {
            type: recurrenceType,
            interval: parseInt(recurWeeks),
            days: selectedDays
        };
    }
    
    addCalendarEvent(calendar, title, selectedStartDate, selectedEndDate, recurrencePattern);
    closeEventModal();
}

function addCalendarEvent(calendar, title, start, end, recurrencePattern) {
    if (!recurrencePattern) {
        calendar.addEvent({
            title: title,
            start: start,
            end: end,
            allDay: true
        });
    } else {
        const events = generateRecurringEvents(title, start, end, recurrencePattern, Date.now().toString());
        events.forEach(event => calendar.addEvent(event));
    }
    
    saveEvents(calendar);
}

function generateRecurringEvents(title, start, end, recurrencePattern, seriesId) {
    const events = [];
    const startDate = new Date(start);
    const endDate = new Date(end);
    const duration = endDate - startDate;
    
    // Generate events for the next year
    let currentDate = new Date(startDate);
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    
    while (currentDate < oneYearFromNow) {
        switch (recurrencePattern.type) {
            case 'daily':
                if (shouldAddEvent(currentDate, recurrencePattern)) {
                    addEventToArray(currentDate);
                }
                currentDate.setDate(currentDate.getDate() + recurrencePattern.interval);
                break;
                
            case 'weekly':
                if (recurrencePattern.days.includes(getDayName(currentDate))) {
                    addEventToArray(currentDate);
                }
                currentDate.setDate(currentDate.getDate() + 1);
                break;
                
            case 'monthly':
                if (shouldAddEvent(currentDate, recurrencePattern)) {
                    addEventToArray(currentDate);
                }
                currentDate.setMonth(currentDate.getMonth() + recurrencePattern.interval);
                break;
                
            case 'yearly':
                if (shouldAddEvent(currentDate, recurrencePattern)) {
                    addEventToArray(currentDate);
                }
                currentDate.setFullYear(currentDate.getFullYear() + recurrencePattern.interval);
                break;
        }
    }
    
    function addEventToArray(date) {
        const eventStart = new Date(date);
        const eventEnd = new Date(date.getTime() + duration);
        
        events.push({
            title: title,
            start: eventStart,
            end: eventEnd,
            allDay: true,
            extendedProps: {
                recurrence: true,
                seriesId: seriesId,
                pattern: recurrencePattern
            },
            backgroundColor: '#28a745', // Green color for recurring events
        });
    }
    
    return events;
}

function shouldAddEvent(date, pattern) {
    if (pattern.type === 'weekly') {
        return pattern.days.includes(getDayName(date));
    }
    return true;
}

function getDayName(date) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
}

function saveEvents(calendar) {
    const events = calendar.getEvents().map(e => ({
        title: e.title,
        start: e.start,
        end: e.end,
        allDay: e.allDay,
        backgroundColor: e.backgroundColor,
        extendedProps: e.extendedProps
    }));
    localStorage.setItem('calendarEvents', JSON.stringify(events));
}

function showEventEditModal(event) {
    currentEvent = event;
    const modal = document.getElementById('event-edit-modal');
    const titleInput = document.getElementById('edit-event-title');
    const recurringOptions = document.getElementById('recurring-event-options');
    
    titleInput.value = event.title;
    
    // Show/hide recurring options based on event type
    recurringOptions.style.display = 
        event.extendedProps?.recurrence ? 'block' : 'none';
    
    modal.style.display = 'block';
}

function closeEventEditModal() {
    document.getElementById('event-edit-modal').style.display = 'none';
    currentEvent = null;
}

function showDeleteOptions() {
    document.getElementById('delete-options-modal').style.display = 'block';
}

function closeDeleteModal() {
    document.getElementById('delete-options-modal').style.display = 'none';
}

function editThisOccurrence() {
    const title = document.getElementById('edit-event-title').value.trim();
    if (!title) return;
    
    currentEvent.setProp('title', title);
    closeEventEditModal();
    saveEvents(calendar);
}

function editAllOccurrences() {
    const title = document.getElementById('edit-event-title').value.trim();
    if (!title) return;
    
    const seriesId = currentEvent.extendedProps.seriesId;
    const events = calendar.getEvents();
    
    events.forEach(event => {
        if (event.extendedProps?.seriesId === seriesId) {
            event.setProp('title', title);
        }
    });
    
    closeEventEditModal();
    saveEvents(calendar);
}

function deleteThisOccurrence() {
    currentEvent.remove();
    closeDeleteModal();
    closeEventEditModal();
    saveEvents(calendar);
}

function deleteAllOccurrences() {
    const seriesId = currentEvent.extendedProps.seriesId;
    const events = calendar.getEvents();
    
    events.forEach(event => {
        if (event.extendedProps?.seriesId === seriesId) {
            event.remove();
        }
    });
    
    closeDeleteModal();
    closeEventEditModal();
    saveEvents(calendar);
}

function addGroceryItem() {
    const input = document.getElementById('grocery-item');
    const list = document.getElementById('grocery-list');
    
    if (input.value.trim() !== '') {
        const li = document.createElement('li');
        
        // Add checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'grocery-checkbox';
        checkbox.onclick = function() {
            if (this.checked) {
                list.appendChild(li);
            }
        };
        
        // Add item text
        const span = document.createElement('span');
        span.textContent = input.value;
        
        // Add delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '×';
        deleteBtn.className = 'delete-item';
        deleteBtn.onclick = function() {
            list.removeChild(li);
        };
        
        li.appendChild(checkbox);
        li.appendChild(span);
        li.appendChild(deleteBtn);
        list.appendChild(li);
        input.value = '';
    }
}

function addTodoItem() {
    const input = document.getElementById('todo-item');
    const list = document.getElementById('todo-list');
    
    if (input.value.trim() !== '') {
        const li = document.createElement('li');
        
        // Add checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'todo-checkbox';
        checkbox.onclick = function() {
            if (this.checked) {
                list.appendChild(li);
            }
        };
        
        // Add item text with reminder info if set
        const span = document.createElement('span');
        span.textContent = input.value;
        if (currentReminderSettings) {
            const reminderInfo = document.createElement('small');
            reminderInfo.className = 'reminder-info';
            reminderInfo.textContent = ` (${formatReminderText(currentReminderSettings)})`;
            span.appendChild(reminderInfo);
            
            // Add to calendar
            addToCalendar(input.value, currentReminderSettings);
        }
        
        // Add delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '×';
        deleteBtn.className = 'delete-item';
        deleteBtn.onclick = function() {
            list.removeChild(li);
        };
        
        li.appendChild(checkbox);
        li.appendChild(span);
        li.appendChild(deleteBtn);
        list.appendChild(li);
        
        // Reset input and reminder settings
        input.value = '';
        currentReminderSettings = null;
        document.querySelector('.reminder-setup-btn').classList.remove('has-reminder');
    }
}

function addToCalendar(title, reminderSettings) {
    let events = [];
    const startDate = new Date();  // Today's date
    const eventId = generateEventId(); // Generate unique ID for this event series
    
    if (reminderSettings.isRecurring) {
        const recurrenceType = reminderSettings.type;
        
        if (recurrenceType === 'daily') {
            for (let i = 0; i < 365; i++) {
                const date = new Date(startDate);
                date.setDate(date.getDate() + i);
                events.push({
                    title: title,
                    start: date,
                    allDay: true,
                    eventSeriesId: eventId  // Add series ID to each event
                });
            }
        } 
        else if (recurrenceType === 'weekly') {
            const selectedDays = reminderSettings.days;
            const weeks = parseInt(reminderSettings.frequency);
            
            for (let i = 0; i < 52; i += weeks) {
                selectedDays.forEach(day => {
                    const date = new Date(startDate);
                    date.setDate(date.getDate() + (getDayNumber(day) - date.getDay() + 7) % 7 + (i * 7));
                    events.push({
                        title: title,
                        start: date,
                        allDay: true,
                        eventSeriesId: eventId
                    });
                });
            }
        }
        else if (recurrenceType === 'monthly') {
            for (let i = 0; i < 12; i++) {
                const date = new Date(startDate);
                date.setMonth(date.getMonth() + i);
                events.push({
                    title: title,
                    start: date,
                    allDay: true,
                    eventSeriesId: eventId
                });
            }
        }
        else if (recurrenceType === 'yearly') {
            for (let i = 0; i < 5; i++) {
                const date = new Date(startDate);
                date.setFullYear(date.getFullYear() + i);
                events.push({
                    title: title,
                    start: date,
                    allDay: true,
                    eventSeriesId: eventId
                });
            }
        }
    } else {
        events.push({
            title: title,
            start: startDate,
            allDay: true,
            eventSeriesId: eventId
        });
    }

    // Add all events to calendar
    events.forEach(event => calendar.addEvent(event));
    return eventId; // Return the ID for future reference
}

// Generate unique ID for event series
function generateEventId() {
    return 'event_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Helper function to convert day names to numbers
function getDayNumber(day) {
    const days = {
        'Sunday': 0,
        'Monday': 1,
        'Tuesday': 2,
        'Wednesday': 3,
        'Thursday': 4,
        'Friday': 5,
        'Saturday': 6
    };
    return days[day];
}

function showReminderModal() {
    const modal = document.getElementById('reminder-modal');
    modal.style.display = 'block';
}

function saveReminder() {
    const isRecurring = document.getElementById('reminder-is-recurring').checked;
    const reminderBtn = document.querySelector('.reminder-setup-btn');
    
    if (isRecurring) {
        currentReminderSettings = {
            isRecurring: true,
            type: document.querySelector('input[name="reminder-recurrence"]:checked').value,
            frequency: document.getElementById('reminder-recur-weeks').value,
            days: Array.from(document.querySelectorAll('.weekday-selector input:checked'))
                      .map(input => input.value)
        };
        reminderBtn.classList.add('has-reminder');
    } else {
        currentReminderSettings = {
            isRecurring: false,
            type: 'once',
            start: new Date()
        };
        reminderBtn.classList.add('has-reminder');
    }
    
    closeReminderModal();
}

function closeReminderModal() {
    const modal = document.getElementById('reminder-modal');
    modal.style.display = 'none';
}

function clearGroceryList() {
    const list = document.getElementById('grocery-list');
    list.innerHTML = '';
}

function formatReminderText(settings) {
    if (settings.type === 'daily') return 'Daily';
    if (settings.type === 'weekly') {
        return `Weekly on ${settings.days.join(', ')}`;
    }
    if (settings.type === 'monthly') return 'Monthly';
    return 'Yearly';
}

// Add this to handle showing/hiding recurrence options
document.addEventListener('DOMContentLoaded', function() {
    const recurringCheckbox = document.getElementById('reminder-is-recurring');
    const recurrenceOptions = document.getElementById('reminder-recurrence-options');
    
    recurringCheckbox.addEventListener('change', function() {
        recurrenceOptions.style.display = this.checked ? 'block' : 'none';
    });
});

function clearTodoList() {
    const list = document.getElementById('todo-list');
    list.innerHTML = '';
}

// Update deleteAllOccurrences function
function deleteAllOccurrences(eventSeriesId) {
    const events = calendar.getEvents();
    events.forEach(event => {
        if (event.extendedProps.eventSeriesId === eventSeriesId) {
            event.remove();
        }
    });
}

// Update the event click handler in your calendar initialization
calendar.setOption('eventClick', function(info) {
    const eventSeriesId = info.event.extendedProps.eventSeriesId;
    // ... your existing modal code ...
    
    // Update delete handler
    document.querySelector('.delete-btn').onclick = function() {
        deleteAllOccurrences(eventSeriesId);
        closeEventEditModal();
    };
});

async function deleteEvent(eventId) {
    try {
        const response = await fetch('/api/events/delete', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                eventId: eventId
            })
        });

        if (response.ok) {
            currentEvent.remove();
        }
    } catch (error) {
        console.error('Error deleting event:', error);
    }
}

// Update the event click handler
calendar.setOption('eventClick', function(info) {
    currentEvent = info.event;
    const modal = document.getElementById('eventEditModal');
    modal.style.display = 'block';
    
    document.getElementById('eventTitle').value = currentEvent.title;
    
    // Single delete handler
    document.querySelector('.delete-this-occurrence').onclick = function() {
        deleteEvent(currentEvent.id);
        closeEventEditModal();
    };

    // ... rest of the event click handler ...
});

// Update the event creation/edit handling
function handleEventSubmit(event) {
    event.preventDefault();
    
    const title = document.getElementById('eventTitle').value;
    const isRecurring = document.getElementById('recurring').checked;
    
    let eventData = {
        title: title,
        start: selectedStartDate,
        end: selectedEndDate,
        isRecurring: isRecurring
    };

    if (isRecurring) {
        const recurrenceType = document.querySelector('input[name="recurrence-type"]:checked').value;
        eventData.recurrence = {
            type: recurrenceType,
            interval: document.getElementById('recurrence-interval').value
        };

        // Add recurrence end options
        const endType = document.querySelector('input[name="end-type"]:checked')?.value;
        if (endType === 'after') {
            eventData.recurrence.endAfter = document.getElementById('occurrence-count').value;
        } else if (endType === 'on') {
            eventData.recurrence.endDate = document.getElementById('end-date').value;
        }

        if (recurrenceType === 'weekly') {
            const selectedDays = Array.from(document.querySelectorAll('input[name="weekday"]:checked'))
                .map(checkbox => checkbox.value);
            eventData.recurrence.weekdays = selectedDays;
        }
    }

    // ... rest of your event creation logic ...
}

// Add event listener for recurring checkbox
document.getElementById('recurring').addEventListener('change', function() {
    const recurrenceOptions = document.getElementById('reminder-recurrence-options');
    recurrenceOptions.style.display = this.checked ? 'block' : 'none';
});

// Add this after your calendar initialization
function addClearCalendarButton() {
    const clearButton = document.createElement('button');
    clearButton.className = 'clear-calendar-btn';
    clearButton.textContent = 'Clear Calendar';
    
    clearButton.addEventListener('click', function() {
        if (confirm('Are you sure you want to clear all events from the calendar?')) {
            const allEvents = calendar.getEvents();
            allEvents.forEach(event => event.remove());
        }
    });
    
    // Add button at the end of the container
    const container = document.querySelector('.container');
    container.appendChild(clearButton);
} 