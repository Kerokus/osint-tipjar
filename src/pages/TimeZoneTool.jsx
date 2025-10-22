import React, { useState } from 'react';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';

// A curated list of common IANA timezones.
// (list unchanged)
const timezones = [
  "UTC",
  "America/New_York",    // Eastern
  "America/Chicago",     // Central
  "America/Denver",      // Mountain
  "America/Los_Angeles", // Pacific
  "Asia/Tokyo",
  "Asia/Dubai",
  // Middle East
  "Asia/Baghdad",  // Iraq
  "Asia/Beirut",   // Lebanon
  "Asia/Damascus", // Syria
  "Asia/Jerusalem", // Israel
  "Asia/Kabul",    // Afghanistan
  "Asia/Kuwait",   // Kuwait
  "Asia/Qatar",    // Qatar
  "Asia/Riyadh",   // Saudi Arabia
  "Asia/Tehran",   // Iran  
  "Australia/Sydney",
  "Pacific/Auckland",
  "Europe/Istanbul", // Turkey
  "Europe/London",
  "Europe/Berlin",
  "Europe/Moscow",
  "Europe/Kiev",
];

// Helper to get today's date in YYYY-MM-DD format for the default state
// (function unchanged)
const getToday = () => {
  return new Date().toISOString().split('T')[0];
};

export default function TimeZoneTool() {
  const [date, setDate] = useState(getToday());
  const [time, setTime] = useState(''); // 24-hour HHmm format
  const [fromTz, setFromTz] = useState('UTC');
  const [toTz, setToTz] = useState('UTC');
  
  const [outputDate, setOutputDate] = useState('');
  const [outputTime, setOutputTime] = useState('');
  const [error, setError] = useState('');

  // (handleTimeChange function is unchanged)
  const handleTimeChange = (e) => {
    // Only allow 4 digits
    const val = e.target.value.replace(/[^0-9]/g, '');
    if (val.length <= 4) {
      setTime(val);
    }
  };

  const handleConvert = () => {
    // Reset outputs
    setOutputDate('');
    setOutputTime('');
    setError('');

    try {
      // --- 1. Validation ---
      if (!date) {
        throw new Error('Please select a date.');
      }
      if (!/^\d{4}$/.test(time)) {
        throw new Error('Time must be 4 digits (HHmm).');
      }
      
      const hour = time.substring(0, 2);
      const minute = time.substring(2, 4);
      if (parseInt(hour, 10) > 23 || parseInt(minute, 10) > 59) {
        throw new Error('Invalid time (HH must be 00-23, mm must be 00-59).');
      }
      const dateTimeString = `${date}T${hour}:${minute}:00`;

      const utcDate = fromZonedTime(dateTimeString, fromTz);

      const formattedDate = formatInTimeZone(utcDate, toTz, 'ddMMMyy').toUpperCase();
      
      const formattedTime = formatInTimeZone(utcDate, toTz, 'HHmm');

      setOutputDate(formattedDate);
      setOutputTime(formattedTime);

    } catch (err) {
      console.error(err);
      setError(err.message || 'Conversion failed. Check inputs.');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      
      {/* --- Row 1: Date and Time Inputs --- */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="tz-date" className="block text-xs mb-1 text-slate-400">Date</label>
          <input
            id="tz-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full h-9 rounded-md bg-slate-800 border border-slate-700 px-3 text-sm"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="tz-time" className="block text-xs mb-1 text-slate-400">Time (HHmm)</label>
          <input
            id="tz-time"
            type="text"
            value={time}
            onChange={handleTimeChange}
            className="w-full h-9 rounded-md bg-slate-800 border border-slate-700 px-3 text-sm"
            placeholder="1352"
          />
        </div>
      </div>

      {/* --- Row 2: Timezone Selectors --- */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="tz-from" className="block text-xs mb-1 text-slate-400">Timezone From</label>
          <select
            id="tz-from"
            value={fromTz}
            onChange={(e) => setFromTz(e.target.value)}
            className="w-full h-9 rounded-md bg-slate-800 border border-slate-700 px-2 text-sm"
          >
            {timezones.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label htmlFor="tz-to" className="block text-xs mb-1 text-slate-400">Timezone To</label>
          <select
            id="tz-to"
            value={toTz}
            onChange={(e) => setToTz(e.target.value)}
            className="w-full h-9 rounded-md bg-slate-800 border border-slate-700 px-2 text-sm"
          >
            {timezones.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>
      </div>
      
      {/* --- Row 3: Convert Button --- */}
      <button
        onClick={handleConvert}
        className="w-full h-9 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors"
      >
        Convert
      </button>

      {/* --- Row 4: Outputs --- */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="tz-out-date" className="block text-xs mb-1 text-slate-400">Output Date</label>
          <input
            id="tz-out-date"
            type="text"
            readOnly
            value={outputDate}
            className="w-full h-9 rounded-md bg-slate-950 border border-slate-700 px-3 text-sm text-slate-300"
            placeholder="DDMMMYY"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="tz-out-time" className="block text-xs mb-1 text-slate-400">Output Time</label>
          <input
            id="tz-out-time"
            type="text"
            readOnly
            value={outputTime}
            className="w-full h-9 rounded-md bg-slate-950 border border-slate-700 px-3 text-sm text-slate-300"
            placeholder="HHmm"
          />
        </div>
      </div>
      
      {/* --- Error Message --- */}
      {error && (
        <p className="text-xs text-red-400 text-center">{error}</p>
      )}
    </div>
  );
}