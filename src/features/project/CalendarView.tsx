import React, { useState, useEffect, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useI18n } from '../../i18n';
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  X,
  Calendar as CalendarIcon,
  Plus,
} from 'lucide-react';

interface CustomCalendar {
  id: string;
  name: string;
  months_json: string;
  days_per_week: number;
  era_name: string | null;
}

interface TimelineEvent {
  id: string;
  scene_id: string | null;
  calendar_id: string | null;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  title: string;
  description: string | null;
}

interface Month {
  name: string;
  days: number;
}

interface DayOfWeek {
  name: string;
  short: string;
}

interface CalendarViewProps {
  calendars: CustomCalendar[];
  onRefresh: () => void;
}

interface CalendarData {
  day_names?: DayOfWeek[];
  months?: Month[];
  starting_day?: number;
  base_year?: number;
  continuous_weeks?: boolean;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ calendars, onRefresh }) => {
  const { t } = useI18n();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState<CustomCalendar | null>(null);
  const [currentYear, setCurrentYear] = useState<number>(0);
  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(0);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<{ year: number; month: number; day: number } | null>(null);

  // Cumulative offset for continuous weeks
  const cumulativeOffsetRef = useRef<number>(0);

  // Initialize year and month when calendar changes
  useEffect(() => {
    if (calendars.length > 0 && !selectedCalendar) {
      const cal = calendars[0];
      const data = parseCalendarData(cal);
      setSelectedCalendar(cal);
      const baseYear = data.base_year || new Date().getFullYear();
      setCurrentYear(baseYear);
      setCurrentMonthIndex(0);
      cumulativeOffsetRef.current = data.starting_day || 0;
    }
  }, [calendars]);

  // When selected calendar changes, reset to base year
  useEffect(() => {
    if (selectedCalendar) {
      const data = parseCalendarData(selectedCalendar);
      const baseYear = data.base_year || new Date().getFullYear();
      setCurrentYear(baseYear);
      setCurrentMonthIndex(0);
      cumulativeOffsetRef.current = data.starting_day || 0;
    }
  }, [selectedCalendar]);
  const [isLoading, setIsLoading] = useState(true);

  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    hour: 0,
    minute: 0,
  });

  useEffect(() => {
    if (calendars.length > 0 && !selectedCalendar) {
      setSelectedCalendar(calendars[0]);
    } else if (!calendars.find(c => c.id === selectedCalendar?.id)) {
      setSelectedCalendar(calendars[0] || null);
    }
  }, [calendars]);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setIsLoading(true);
      const loadedEvents = await invoke<TimelineEvent[]>('get_timeline_events');
      setEvents(loadedEvents);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const parseCalendarData = (calendar: CustomCalendar): CalendarData => {
    try {
      return JSON.parse(calendar.months_json);
    } catch {
      return {};
    }
  };

  const calendarData = useMemo((): CalendarData => {
    if (!selectedCalendar) return { day_names: [], months: [] };
    return parseCalendarData(selectedCalendar);
  }, [selectedCalendar]);

  const dayNames = useMemo((): DayOfWeek[] => {
    if (calendarData.day_names && calendarData.day_names.length > 0) {
      return calendarData.day_names;
    }
    if (!selectedCalendar) return [];
    const defaults: DayOfWeek[] = [
      { name: 'Lunes', short: 'L' },
      { name: 'Martes', short: 'M' },
      { name: 'Miércoles', short: 'X' },
      { name: 'Jueves', short: 'J' },
      { name: 'Viernes', short: 'V' },
      { name: 'Sábado', short: 'S' },
      { name: 'Domingo', short: 'D' },
    ];
    const result: DayOfWeek[] = [];
    for (let i = 0; i < selectedCalendar.days_per_week; i++) {
      result.push(defaults[i % 7] || { name: `Día ${i + 1}`, short: `D${i + 1}` });
    }
    return result;
  }, [selectedCalendar, calendarData]);

  const months = useMemo((): Month[] => {
    return calendarData.months || [];
  }, [calendarData]);

  const currentMonth = months[currentMonthIndex];

  const getEventsForDate = (year: number, month: number, day: number) => {
    return events.filter(e => e.year === year && e.month === month && e.day === day);
  };

  const goToPrevMonth = () => {
    if (calendarData.continuous_weeks && selectedCalendar) {
      const daysInCurrentMonth = months[currentMonthIndex]?.days || 0;
      const daysPerWeek = selectedCalendar.days_per_week;
      cumulativeOffsetRef.current = ((cumulativeOffsetRef.current - daysInCurrentMonth) % daysPerWeek + daysPerWeek) % daysPerWeek;
    }
    if (currentMonthIndex === 0) {
      setCurrentMonthIndex(months.length - 1);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonthIndex(m => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (calendarData.continuous_weeks && selectedCalendar) {
      const daysInCurrentMonth = months[currentMonthIndex]?.days || 0;
      cumulativeOffsetRef.current = (cumulativeOffsetRef.current + daysInCurrentMonth) % selectedCalendar.days_per_week;
    }
    if (currentMonthIndex === months.length - 1) {
      setCurrentMonthIndex(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonthIndex(m => m + 1);
    }
  };

  const goToToday = () => {
    if (selectedCalendar) {
      const data = parseCalendarData(selectedCalendar);
      setCurrentYear(data.base_year || new Date().getFullYear());
      cumulativeOffsetRef.current = data.starting_day || 0;
    }
    setCurrentMonthIndex(0);
  };

  const handleDayClick = (day: number) => {
    setSelectedDate({ year: currentYear, month: currentMonthIndex + 1, day });
    setEditingEvent(null);
    setEventForm({ title: '', description: '', hour: 0, minute: 0 });
    setShowEventForm(true);
  };

  const handleEventClick = (event: TimelineEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEvent(event);
    setSelectedDate({ year: event.year, month: event.month, day: event.day });
    setEventForm({
      title: event.title,
      description: event.description || '',
      hour: event.hour,
      minute: event.minute,
    });
    setShowEventForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) return;
    try {
      if (editingEvent) {
        await invoke('update_timeline_event', {
          id: editingEvent.id, year: selectedDate.year, month: selectedDate.month, day: selectedDate.day,
          hour: eventForm.hour, minute: eventForm.minute, title: eventForm.title, description: eventForm.description || null,
        });
      } else {
        await invoke('create_timeline_event', {
          sceneId: null, calendarId: selectedCalendar?.id || null, year: selectedDate.year, month: selectedDate.month, day: selectedDate.day,
          hour: eventForm.hour, minute: eventForm.minute, title: eventForm.title, description: eventForm.description || null,
        });
      }
      setShowEventForm(false);
      loadEvents();
      onRefresh();
    } catch (error) {
      console.error('Error saving event:', error);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await invoke('delete_timeline_event', { id });
      setShowEventForm(false);
      loadEvents();
      onRefresh();
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  const closeForm = () => {
    setShowEventForm(false);
    setSelectedDate(null);
    setEditingEvent(null);
  };

  const buildMonthGrid = (month: Month, daysPerWeek: number, startOffset: number): (number | null)[][] => {
    const grid: (number | null)[][] = [];
    let currentRow: (number | null)[] = [];

    // Add padding at the start based on starting offset
    for (let i = 0; i < startOffset; i++) currentRow.push(null);

    for (let day = 1; day <= month.days; day++) {
      currentRow.push(day);
      if (currentRow.length === daysPerWeek) {
        grid.push(currentRow);
        currentRow = [];
      }
    }

    if (currentRow.length > 0) {
      while (currentRow.length < daysPerWeek) currentRow.push(null);
      grid.push(currentRow);
    }

    return grid;
  };

  if (isLoading) return <div className="flex items-center justify-center h-64 text-slate-500">{t('common.loading')}</div>;
  if (!selectedCalendar || !currentMonth) return (
    <div className="flex flex-col items-center justify-center h-64 text-slate-600">
      <CalendarIcon className="w-12 h-12 mb-4 text-slate-700" />
      <p className="text-lg font-medium">{t('calendars.empty')}</p>
      <p className="text-sm mt-1">{t('calendars.emptyHint')}</p>
    </div>
  );

  // Calculate offset for current month - use cumulative ref for continuous, or base offset for non-continuous
  const currentOffset = calendarData.continuous_weeks
    ? cumulativeOffsetRef.current
    : (calendarData.starting_day || 0);
  const grid = buildMonthGrid(currentMonth, selectedCalendar.days_per_week, currentOffset);
  const daysPerWeek = selectedCalendar.days_per_week;
  const eventsThisMonth = events.filter(e => e.year === currentYear && e.month === currentMonthIndex + 1);

  return (
    <div className="h-full flex flex-col bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/80">
        <div className="flex items-center justify-between mb-3">
          <select
            value={selectedCalendar.id}
            onChange={(e) => {
              const cal = calendars.find(c => c.id === e.target.value);
              if (cal) setSelectedCalendar(cal);
            }}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white outline-none"
          >
            {calendars.map(cal => <option key={cal.id} value={cal.id}>{cal.name}</option>)}
          </select>

          <div className="flex items-center gap-2">
            <button onClick={goToPrevMonth} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={goToNextMonth} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">{currentMonth.name} {currentYear}</h2>
            {selectedCalendar.era_name && <p className="text-xs text-slate-500">{selectedCalendar.era_name}</p>}
          </div>
          <button onClick={goToToday} className="px-3 py-1 text-xs text-slate-500 hover:text-white border border-slate-700 rounded-full transition-colors">
            Hoy
          </button>
        </div>
      </div>

      {/* Day names */}
      <div className="grid border-b border-slate-800" style={{ gridTemplateColumns: `repeat(${daysPerWeek}, 1fr)` }}>
        {dayNames.map((day, i) => (
          <div key={i} className="py-2 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            {day.short}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 p-2 overflow-hidden">
        <div className="grid gap-1 h-full" style={{ gridTemplateColumns: `repeat(${daysPerWeek}, 1fr)`, gridTemplateRows: `repeat(${grid.length}, 1fr)` }}>
          {grid.flatMap((row, rowIndex) =>
            row.map((day, dayIndex) => {
              if (day === null) return <div key={`${rowIndex}-${dayIndex}`} className="bg-slate-900/30 rounded" />;

              const dayEvents = getEventsForDate(currentYear, currentMonthIndex + 1, day);
              // Highlight first day of first month if viewing base year/month
              const calendarBaseYear = calendarData.base_year || currentYear;
              const isToday = calendarBaseYear === currentYear && currentMonthIndex === 0 && day === 1;

              return (
                <button
                  key={`${rowIndex}-${dayIndex}`}
                  onClick={() => handleDayClick(day)}
                  className={`relative rounded-lg flex flex-col items-center justify-center p-1 transition-all overflow-hidden ${
                    isToday
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                      : 'bg-slate-800/50 hover:bg-slate-700/70 text-slate-300 hover:text-white'
                  } ${dayEvents.length > 0 ? 'ring-1 ring-violet-500/40' : ''}`}
                >
                  <span className="text-sm font-medium">{day}</span>
                  {dayEvents.length > 0 && (
                    <div className="w-full mt-0.5 space-y-0.5">
                      {dayEvents.slice(0, 2).map((ev, i) => (
                        <div
                          key={i}
                          className={`px-1 py-0.5 rounded text-[9px] truncate leading-tight font-medium ${
                            isToday ? 'bg-white/20 text-white' : 'bg-violet-900/50 text-violet-200'
                          }`}
                        >
                          {ev.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className={`text-[9px] font-medium text-center ${isToday ? 'text-white/80' : 'text-slate-400'}`}>
                          +{dayEvents.length - 2}
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Events list */}
      <div className="border-t border-slate-800 p-3 bg-slate-900/50 max-h-40 overflow-auto">
        <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Eventos ({eventsThisMonth.length})
        </h3>
        {eventsThisMonth.length === 0 ? (
          <p className="text-xs text-slate-600 italic">Sin eventos este mes</p>
        ) : (
          <div className="space-y-1">
            {eventsThisMonth.sort((a, b) => a.day - b.day || a.hour - b.hour).map(event => (
              <button
                key={event.id}
                onClick={(e) => handleEventClick(event, e)}
                className="w-full flex items-center gap-2 px-2 py-1 rounded bg-slate-800/50 hover:bg-slate-800 text-left transition-colors"
              >
                <span className="text-xs font-mono text-emerald-400 w-6">{event.day}</span>
                <span className="text-xs text-slate-200 truncate">{event.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Event Modal */}
      {showEventForm && selectedDate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                {editingEvent ? t('timeline.editEvent') : `${selectedDate.day} ${currentMonth.name}`}
              </h3>
              <button onClick={closeForm} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text" required value={eventForm.title}
                onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                placeholder={t('timeline.eventTitlePlaceholder')}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase">{t('timeline.hour')}</label>
                  <input type="number" min="0" max="23" value={eventForm.hour}
                    onChange={(e) => setEventForm({ ...eventForm, hour: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-sm text-white outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase">{t('timeline.minute')}</label>
                  <input type="number" min="0" max="59" value={eventForm.minute}
                    onChange={(e) => setEventForm({ ...eventForm, minute: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-sm text-white outline-none focus:border-emerald-500" />
                </div>
              </div>
              <textarea value={eventForm.description}
                onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                placeholder={t('timeline.descriptionPlaceholder')}
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-500 resize-none" />
              <div className="flex gap-2 pt-1">
                {editingEvent && (
                  <button type="button" onClick={() => handleDeleteEvent(editingEvent.id)}
                    className="px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button type="button" onClick={closeForm}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium text-sm transition-colors">
                  {t('common.cancel')}
                </button>
                <button type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-sm transition-colors">
                  {editingEvent ? t('common.save') : <Plus className="w-4 h-4" />}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
