/* ---------- ICS (iCalendar) export for DVBC events ---------- */

function escapeICSText(text) {
  if (!text) return "";
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\n/g, "\\n");
}

function toICSDateTime(isoString) {
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function generateEventUID(eventId) {
  return `event-${eventId}@devocibelli-chorale.app`;
}

export function generateICS(events, title = "De Voci Belli Chorale Rehearsals") {
  const now = new Date();
  const dtstamp = toICSDateTime(now.toISOString());

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//De Voci Belli Chorale//NONSGML Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeICSText(title)}`,
    "X-WR-TIMEZONE:Africa/Lagos",
    "X-WR-CALDESC:Rehearsals and events for De Voci Belli Chorale",
  ];

  (events || []).forEach((event) => {
    const summary = escapeICSText(event.title || "Rehearsal");
    const description = escapeICSText(event.description || "");
    const location = escapeICSText(event.location || "");
    const startDT = toICSDateTime(event.start_time);
    const endDT = toICSDateTime(event.end_time);
    const uid = generateEventUID(event.id);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART:${startDT}`);
    lines.push(`DTEND:${endDT}`);
    lines.push(`SUMMARY:${summary}`);
    if (description) lines.push(`DESCRIPTION:${description}`);
    if (location) lines.push(`LOCATION:${location}`);
    lines.push("STATUS:CONFIRMED");
    lines.push("SEQUENCE:0");
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadICS(icsContent, filename = "dvbc-rehearsals.ics") {
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportEventsICS(events, title = "De Voci Belli Chorale Rehearsals") {
  return generateICS(events, title);
}
