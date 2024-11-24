let selectedStartDate, selectedEndDate;
let calendar; // Global calendar variable
let currentEvent = null;

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
        },
        
        eventClick: function(info) {
            showEventEditModal(info.event);
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