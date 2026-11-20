// Reminders: one recurring calendar event per time-slot, for the length of the course.
const pad = (n) => String(n).padStart(2, '0');
const stamp = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

export const SLOT_LABEL = { morning: 'Morning', afternoon: 'Afternoon', night: 'Night' };

// slots: [{ slot, time: "08:00", meds: [{name, dose}], days }]
export function buildEvents(slots, startDate = new Date()) {
  return slots.filter((s) => s.meds.length).map((s) => {
    const [h, m] = s.time.split(':').map(Number);
    const start = new Date(startDate); start.setHours(h, m, 0, 0);
    if (start < new Date()) start.setDate(start.getDate() + 1);
    const end = new Date(start.getTime() + 10 * 60000);
    const title = `💊 ${s.meds.map((x) => x.name.split(' ')[0]).join(', ')}`;
    const details = s.meds.map((x) => `• ${x.name}: ${x.dose}`).join('\n') + '\n\nMade with Parchi. Always follow your doctor’s advice.';
    return { title, details, start, end, days: s.days };
  });
}

export function googleLink(ev) {
  const p = new URLSearchParams({
    action: 'TEMPLATE', text: ev.title, details: ev.details,
    dates: `${stamp(ev.start)}/${stamp(ev.end)}`, ctz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  if (ev.days) p.set('recur', `RRULE:FREQ=DAILY;COUNT=${ev.days}`);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function icsFile(events) {
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Parchi//EN', 'CALSCALE:GREGORIAN'];
  events.forEach((ev, i) => {
    lines.push('BEGIN:VEVENT', `UID:parchi-${Date.now()}-${i}@parchi`, `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(ev.start)}`, `DTEND:${stamp(ev.end)}`, `SUMMARY:${esc(ev.title)}`, `DESCRIPTION:${esc(ev.details)}`);
    if (ev.days) lines.push(`RRULE:FREQ=DAILY;COUNT=${ev.days}`);
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Time for your medicine', 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
