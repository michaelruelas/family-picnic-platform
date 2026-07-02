'use client';

import { useState } from 'react';
import { CalendarEventChip } from './CalendarEventChip';
import { EventStatus } from '~/lib/generated/enums';

interface CalendarProps {
  events: Array<{
    id: string;
    name: string;
    date: Date | string;
    status: EventStatus;
  }>;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function Calendar({ events }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startingDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getEventsForDay = (day: number) => {
    return events.filter((event) => {
      const eventDate = new Date(event.date);
      return (
        eventDate.getDate() === day &&
        eventDate.getMonth() === month &&
        eventDate.getFullYear() === year
      );
    });
  };

  const calendarDays: (number | null)[] = [];

  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={prevMonth}
            className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-lg font-medium text-stone-700 transition-colors hover:bg-stone-50 active:bg-stone-100"
            aria-label="Previous month"
          >
            ‹
          </button>
          <h2 className="text-xl font-semibold text-stone-900">
            {MONTHS[month]} {year}
          </h2>
          <button
            onClick={nextMonth}
            className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-lg font-medium text-stone-700 transition-colors hover:bg-stone-50 active:bg-stone-100"
            aria-label="Next month"
          >
            ›
          </button>
        </div>
        <button
          onClick={goToToday}
          className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50 active:bg-stone-100"
        >
          Today
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-stone-200 bg-stone-200">
        {DAYS_OF_WEEK.map((day) => (
          <div
            key={day}
            className="bg-stone-100 px-2 py-3 text-center text-sm font-semibold text-stone-600"
          >
            {day}
          </div>
        ))}

        {calendarDays.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="min-h-24 bg-white p-2 md:min-h-32" />;
          }

          const dayEvents = getEventsForDay(day);
          const isCurrentDay = isToday(day);

          return (
            <div
              key={day}
              className={`min-h-24 bg-white p-2 md:min-h-32 ${isCurrentDay ? 'ring-2 ring-green-500 ring-inset' : ''}`}
            >
              <div
                className={`mb-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium ${
                  isCurrentDay ? 'bg-green-600 text-white' : 'text-stone-700'
                }`}
              >
                {day}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <CalendarEventChip key={event.id} event={event} />
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-stone-500">+{dayEvents.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-sm text-stone-600">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-green-500" />
          <span>Today</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded border border-green-300 bg-green-200" />
          <span>Published</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded border border-amber-300 bg-amber-200" />
          <span>Draft</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded border border-stone-300 bg-stone-200" />
          <span>Closed</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded border border-red-300 bg-red-200" />
          <span>Cancelled</span>
        </div>
      </div>
    </div>
  );
}
