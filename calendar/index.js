/*

 index.js - companion to the org-hyperscheduler.el

 Copyright © 2022 Dmitry Markushevich

 Author: Dmitry Markushevich <dmitrym@gmail.com>
 Edited by: Diego Rivera Garrido (github: driverag22)
 Keywords: org-mode, calendar
 URL: https://github.com/driverag22/org-hyperscheduler

 This file is NOT part of GNU Emacs.

 This program is free software; you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation; either version 3, or (at your option)
 any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with GNU Emacs; see the file COPYING.  If not, write to the
 Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor,
 Boston, MA 02110-1301, USA.


 Commentary:

 This is the javascript code that talks to Emacs via websockets to render agenda.

 More info https://github.com/dmitrym0/org-hyperscheduler (original repo)
 More info https://github.com/driverag22/org-hyperscheduler (fork)

*/

// Retrieve stored schedule (not rendered immediately)
let schedule = window.localStorage.getItem('schedule') || '[]';
let agenda;

// Periodically re-render to update the current-time indicator
function refreshCalendar() {
  setTimeout(refreshCalendar, 300000);
  calendar.render();
}

document.addEventListener('keydown', function(event) {
  if (['INPUT','TEXTAREA'].includes(event.target.tagName)) return;
  switch (event.key) {
    case 'k': calendar.prev(); break;
    case 'j': calendar.next(); break;
    case 't': calendar.today(); break;
    case 'd': calendar.changeView('day', true); break;
    case 'w': calendar.changeView('week', true); break;
    case 'm': calendar.changeView('month', true); break;
  }
});

const monthNames = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

// Get today's date in YYYY-MM-DD format for comparison
function getTodayDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0'); // Months are 0-indexed
    const day = today.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const todayDateString = getTodayDateString();

// Define the theme configuration object
const themeConfig = {
    common: {
        backgroundColor: '#020202', // Main background of the calendar layout
        border: '1px solid #444444', // General border color
        dayName: { color: '#ffffff' },
        saturday: { color: '#0074D9' },
        holiday: { color: '#FF4136' },
        today: { color: '#ffffff' }, // Text color for "today" indicator
    },
    week: {
        dayName: {
            borderLeft: '1px solid #444444',
            borderBottom: '1px solid #444444',
            borderTop: '1px solid #ffffff',
            backgroundColor: '#020202',
        },
        dayGrid: {
            borderRight: '1px solid #ffffff',
            backgroundColor: '#020202',
        },
        dayGridLeft: {
            borderRight: '1px solid #444444',
            backgroundColor: '#020202',
            width: '60px',
        },
        timeGrid: { 
            borderRight: '1px solid #ffffff' 
        },
        timeGridLeft: {
            borderRight: '1px solid #444444',
            backgroundColor: '#020202',
            width: '60px',
        },
        timeGridHourLine: { borderBottom: '1px solid #e5e5e5' },
        nowIndicatorLabel: { color: '#CA509C' },
        nowIndicatorPast: { border: '1px dashed #CA509C' },
        nowIndicatorBullet: { backgroundColor: '#CA509C' },
        nowIndicatorToday: { border: '1px solid #CA509C' },
        nowIndicatorFuture: { border: '1px dashed #CA509C' },
        pastTime: { color: '#88ffff' },
        futureTime: { color: '#ffffff' },
        weekend: { backgroundColor: 'rgba(50, 50, 50, 0.5)' },
        today: {
            color: '#ffffff', // Text color for today's header in week view (e.g., "Mon 29")
            backgroundColor: 'rgba(202, 80, 156, 0.1)', // Background for today's column/header
            border: '2px solid #CA509C' // Border for today's column
        },
        pastDay: { color: '#ffffff' },
        panelResizer: { border: '1px solid #555555' },
        gridSelection: { color: '#ffffff' },
    },

    month: {
        // dayExceptThisMonth: { color: '#888888' },
        dayName: {
            borderLeft: '1px solid #444444',
            borderBottom: '1px solid #ffffff',
            borderTop: '1px solid #ffffff',
            backgroundColor: '#020202',
        },
        holidayExceptThisMonth: { color: '#FF4136' },
        moreView: {
            backgroundColor: '#333333',
            border: '1px solid #CA509C',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
            width: null,
            height: null,
        },
        moreViewTitle: {
            backgroundColor: '#444444',
        },
        weekend: { backgroundColor: 'rgba(50, 50, 50, 0.5)' },
        gridCell: {
            headerHeight: 42, // Height of month view day header (e.g., "Mon", "Tue")
            footerHeight: 24,
        },
        pastDay: { color: '#ffffff' },
    }
};

const container = document.querySelector('#container');
// Initialize calendar in readonly mode (no creation, editing, or popups)
const calendar = new tui.Calendar(container, {
  calendars: [
    { id: '1', name: 'Tasks' },
    { id: '2', name: 'Schedule' },
  ],
  defaultView: 'week',
  gridSelection: false,
  isReadOnly: true,       // force readonly mode
  usageStatistics: false,
  week: { 
    narrowWeekend: true, 
    startDayOfWeek: 1, 
    hourStart: 7, 
    hourEnd: 20, 
    taskView: false,
  },
  month:  { 
    startDayOfWeek: 1,
    narrowWeekend: true, 
    isAlways6Weeks: false,
  },
  theme: themeConfig,
  template: {
    // Get month name on 1st day of month
    monthGridHeader(model) {
      // model.date is "YYYY-MM-DD"
      const dateObj   = new Date(model.date);
      const day       = dateObj.getDate();
      const monthName = dateObj.toLocaleString('default', { month: 'long' });

      // Only prepend the month name when it's the 1st of the month
      if (day === 1) {
        return `<span>${monthName} ${day}</span>`;
      }
      return `<span>${day}</span>`;
    },
  },
});

// Fetch and render agenda data via WebSocket
function getAgenda() {
  fetchNewAgenda();
}

function fetchNewAgenda() {
  socket.send(JSON.stringify({ command: 'get-agenda' }));
}

// WebSocket for Emacs communication
const socket = new WebSocket('ws://127.0.0.1:44445');

socket.onopen = () => {
  getAgenda();
}

socket.onmessage = function(event) {
  // Clear any existing schedules before rendering new ones
  calendar.clear();

  try {
    agenda = JSON.parse(event.data);
  } catch (err) {
    console.error('Invalid agenda data:', event.data);
    return;
  }

  // Map agenda items to schedules
  const schedules = agenda.map(item => {
    const isAllDay = (item.allDay === 'true');
    const isTask = (item.CATEGORY === 'tasks');
    let bColor;
    if (isAllDay) {
        bColor = '#CA509C';
    } else if (isTask) {
        bColor = '#32A9A6';
    } else {
        bColor = '#5F4FB7';
    }
    return {
      id:         item.ID,
      calendarId: isTask ? '1' : '2',
      title:      item.ITEM.replace(/\[\[.*?:.*?\]\[|\]\]/g, ''),
      category:   isAllDay ? 'allday' : 'time',
      color:      '#ffffff',
      backgroundColor: bColor,
      start:      item.startDate,
      end:        item.endDate
    };
  });

  // Render and persist
  calendar.createEvents(schedules);
  window.localStorage.setItem('schedule', JSON.stringify(schedules));
};

socket.onclose =     () => console.warn('Connection closed; calendar remains readonly.');
socket.onerror =     (e) => console.error('WebSocket error:', e);

// Start the periodic refresh
refreshCalendar();
