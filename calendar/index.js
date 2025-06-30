/*

 index.js - companion to the org-hyperscheduler.el

 Copyright © 2022 Dmitry Markushevich

 Author: Dmitry Markushevich <dmitrym@gmail.com>
 Edited by: Diego Rivera Garrido (github: driverag22)
 Keywords: org-mode, calendar
 URL: https://github.com/dmitrym0/org-hyperscheduler

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

 More info https://github.com/dmitrym0/org-hyperscheduler

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

// Initialize calendar in readonly mode (no creation, editing, or popups)
const calendar = new tui.Calendar('#calendar', {
  calendars: [
    { id: '1', name: 'Scheduled Items', color: '#ffffff', bgColor: '#9e5fff', dragBgColor: '#9e5fff', borderColor: '#9e5fff' },
    { id: '2', name: 'Timestamped Items', color: '#ffffff', bgColor: '#00a9ff', dragBgColor: '#00a9ff', borderColor: '#00a9ff' }
  ],
  defaultView: 'week',
  taskView: false,
  usageStatistics: false,
  isReadOnly: true,       // force readonly mode
  useCreationPopup: false,
  useDetailPopup:   false,
  week: { narrowWeekend: true, startDayOfWeek: 1, hourStart: 8 },
  day:  { startDayOfWeek: 1, hourStart: 8 },
  scheduleView: ['allday', 'time']
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

socket.onopen = () => getAgenda();

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
    const isAllDay = item.allDay === 'true';
    const calId    = item.SCHEDULED ? '1' : '2';
    return {
      id:         item.ID,
      calendarId: calId,
      title:      item.ITEM.replace(/\[\[.*?:.*?\]\[|\]\]/g, ''),
      category:   isAllDay ? 'allday' : 'time',
      start:      item.startDate,
      end:        item.endDate
    };
  });

  // Render and persist
  calendar.createSchedules(schedules);
  window.localStorage.setItem('schedule', JSON.stringify(schedules));
};

socket.onclose =     () => console.warn('Connection closed; calendar remains readonly.');
socket.onerror =     (e) => console.error('WebSocket error:', e);

// Start the periodic refresh
refreshCalendar();


