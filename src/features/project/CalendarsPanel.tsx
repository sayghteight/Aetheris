import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useI18n } from '../../i18n';
import { CalendarView } from './CalendarView';
import {
  Calendar,
  Plus,
  Edit2,
  Trash2,
  X,
  Globe,
  Clock,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface DayOfWeek {
  name: string;
  short: string;
}

interface Month {
  name: string;
  days: number;
}

interface CustomCalendar {
  id: string;
  name: string;
  months_json: string;
  days_per_week: number;
  era_name: string | null;
}

interface CalendarFormData {
  name: string;
  era_name: string;
  days_per_week: number;
  day_names: DayOfWeek[];
  months: Month[];
  starting_day: number;
  base_year: number;
  continuous_weeks: boolean;
}

// Spanish day names
const DEFAULT_DAY_NAMES: DayOfWeek[] = [
  { name: 'Lunes', short: 'L' },
  { name: 'Martes', short: 'M' },
  { name: 'Miércoles', short: 'X' },
  { name: 'Jueves', short: 'J' },
  { name: 'Viernes', short: 'V' },
  { name: 'Sábado', short: 'S' },
  { name: 'Domingo', short: 'D' },
];

// Spanish month names
const DEFAULT_MONTHS: Month[] = [
  { name: 'Enero', days: 31 },
  { name: 'Febrero', days: 28 },
  { name: 'Marzo', days: 31 },
  { name: 'Abril', days: 30 },
  { name: 'Mayo', days: 31 },
  { name: 'Junio', days: 30 },
  { name: 'Julio', days: 31 },
  { name: 'Agosto', days: 31 },
  { name: 'Septiembre', days: 30 },
  { name: 'Octubre', days: 31 },
  { name: 'Noviembre', days: 30 },
  { name: 'Diciembre', days: 31 },
];

export const CalendarsPanel: React.FC = () => {
  const { t } = useI18n();
  const [calendars, setCalendars] = useState<CustomCalendar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCalendar, setEditingCalendar] = useState<CustomCalendar | null>(null);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [expandedMonths, setExpandedMonths] = useState(false);
  const [expandedDays, setExpandedDays] = useState(false);

  const [formData, setFormData] = useState<CalendarFormData>({
    name: '',
    era_name: '',
    days_per_week: 7,
    day_names: DEFAULT_DAY_NAMES,
    months: DEFAULT_MONTHS,
    starting_day: 0,
    base_year: new Date().getFullYear(),
    continuous_weeks: false,
  });

  useEffect(() => {
    loadCalendars();
  }, []);

  const loadCalendars = async () => {
    try {
      setIsLoading(true);
      const loaded = await invoke<CustomCalendar[]>('get_calendars');
      setCalendars(loaded);
    } catch (error) {
      console.error('Error loading calendars:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const parseCalendarData = (calendar: CustomCalendar) => {
    try {
      return JSON.parse(calendar.months_json);
    } catch {
      return { day_names: DEFAULT_DAY_NAMES, months: DEFAULT_MONTHS, starting_day: 0, base_year: new Date().getFullYear(), continuous_weeks: false };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const calendarData = JSON.stringify({
        day_names: formData.day_names,
        months: formData.months,
        starting_day: formData.starting_day,
        base_year: formData.base_year,
        continuous_weeks: formData.continuous_weeks,
      });

      if (editingCalendar) {
        await invoke('update_calendar', {
          id: editingCalendar.id,
          name: formData.name,
          monthsJson: calendarData,
          daysPerWeek: formData.days_per_week,
          eraName: formData.era_name || null,
        });
      } else {
        await invoke('create_calendar', {
          name: formData.name,
          monthsJson: calendarData,
          daysPerWeek: formData.days_per_week,
          eraName: formData.era_name || null,
        });
      }
      resetForm();
      loadCalendars();
    } catch (error) {
      console.error('Error saving calendar:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await invoke('delete_calendar', { id });
      loadCalendars();
    } catch (error) {
      console.error('Error deleting calendar:', error);
    }
  };

  const handleEdit = (calendar: CustomCalendar) => {
    const data = parseCalendarData(calendar);
    setEditingCalendar(calendar);
    setFormData({
      name: calendar.name,
      era_name: calendar.era_name || '',
      days_per_week: calendar.days_per_week,
      day_names: data.day_names || DEFAULT_DAY_NAMES,
      months: data.months || DEFAULT_MONTHS,
      starting_day: data.starting_day || 0,
      base_year: data.base_year || new Date().getFullYear(),
      continuous_weeks: data.continuous_weeks ?? false,
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingCalendar(null);
    setExpandedDays(false);
    setExpandedMonths(false);
    setFormData({
      name: '',
      era_name: '',
      days_per_week: 7,
      day_names: DEFAULT_DAY_NAMES,
      months: DEFAULT_MONTHS,
      starting_day: 0,
      base_year: new Date().getFullYear(),
    continuous_weeks: false,
  });
  };

  const totalDays = (months: Month[]) => {
    return months.reduce((sum, m) => sum + m.days, 0);
  };

  const updateDayName = (index: number, field: 'name' | 'short', value: string) => {
    const newDayNames = [...formData.day_names];
    newDayNames[index] = { ...newDayNames[index], [field]: value };
    setFormData({ ...formData, day_names: newDayNames });
  };

  const updateMonth = (index: number, field: 'name' | 'days', value: string | number) => {
    const newMonths = [...formData.months];
    newMonths[index] = { ...newMonths[index], [field]: value };
    setFormData({ ...formData, months: newMonths });
  };

  const addMonth = () => {
    setFormData({
      ...formData,
      months: [...formData.months, { name: `Mes ${formData.months.length + 1}`, days: 30 }],
    });
  };

  const removeMonth = (index: number) => {
    if (formData.months.length > 1) {
      const newMonths = formData.months.filter((_, i) => i !== index);
      setFormData({ ...formData, months: newMonths });
    }
  };

  const getDayNamesDisplay = (calendar: CustomCalendar) => {
    const data = parseCalendarData(calendar);
    return data.day_names?.map((d: DayOfWeek) => d.short).join(', ') || 'L, M, X, J, V, S, D';
  };

  return (
    <div className="h-full flex flex-col p-6 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Globe className="w-6 h-6 text-emerald-400" />
            {t('calendars.title')}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {calendars.length} {calendars.length === 1 ? 'calendario' : 'calendarios'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex rounded-lg border border-slate-700 overflow-hidden">
            <button
              onClick={() => setView('list')}
              className={`px-4 py-2 text-xs font-medium transition-colors ${
                view === 'list' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Globe className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`px-4 py-2 text-xs font-medium transition-colors ${
                view === 'calendar' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('calendars.newCalendar')}
          </button>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                {editingCalendar ? t('calendars.editCalendar') : t('calendars.createCalendar')}
              </h3>
              <button onClick={resetForm} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    {t('calendars.name')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t('calendars.namePlaceholder')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    {t('calendars.eraName')}
                  </label>
                  <input
                    type="text"
                    value={formData.era_name}
                    onChange={(e) => setFormData({ ...formData, era_name: e.target.value })}
                    placeholder={t('calendars.eraPlaceholder')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Days per week */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  {t('calendars.daysPerWeek')}
                </label>
                <div className="flex gap-2">
                  {[5, 6, 7, 8, 10, 14].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => {
                        const newDayNames: DayOfWeek[] = [];
                        for (let i = 0; i < num; i++) {
                          newDayNames.push(DEFAULT_DAY_NAMES[i % 7] || { name: `Día ${i + 1}`, short: `D${i + 1}` });
                        }
                        setFormData({ ...formData, days_per_week: num, day_names: newDayNames });
                      }}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                        formData.days_per_week === num
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Base year & continuous weeks */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    {t('calendars.baseYear') || 'Año base'}
                  </label>
                  <input
                    type="number"
                    value={formData.base_year}
                    onChange={(e) => setFormData({ ...formData, base_year: parseInt(e.target.value) || new Date().getFullYear() })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Semanas continuas
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, continuous_weeks: !formData.continuous_weeks })}
                    className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      formData.continuous_weeks
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {formData.continuous_weeks ? 'Sí' : 'No'}
                  </button>
                </div>
              </div>

              {/* Day Names (collapsible) */}
              <div className="border border-slate-800 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedDays(!expandedDays)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/50 hover:bg-slate-800 transition-colors"
                >
                  <span className="text-sm font-medium text-white">{t('calendars.dayNames') || 'Nombres de los días'}</span>
                  {expandedDays ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                {expandedDays && (
                  <div className="p-4 bg-slate-900/50 grid grid-cols-7 gap-2">
                    {formData.day_names.map((day, index) => (
                      <div key={index} className="space-y-1">
                        <input
                          type="text"
                          value={day.name}
                          onChange={(e) => updateDayName(index, 'name', e.target.value)}
                          placeholder="Nombre"
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white text-center outline-none focus:border-emerald-500"
                        />
                        <input
                          type="text"
                          value={day.short}
                          onChange={(e) => updateDayName(index, 'short', e.target.value)}
                          placeholder="Abrev"
                          maxLength={2}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-400 text-center outline-none focus:border-emerald-500"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Months (collapsible) */}
              <div className="border border-slate-800 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedMonths(!expandedMonths)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/50 hover:bg-slate-800 transition-colors"
                >
                  <span className="text-sm font-medium text-white">
                    {t('calendars.months') || 'Meses'} ({formData.months.length})
                  </span>
                  {expandedMonths ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                {expandedMonths && (
                  <div className="p-4 bg-slate-900/50 space-y-2 max-h-64 overflow-y-auto">
                    {formData.months.map((month, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={month.name}
                          onChange={(e) => updateMonth(index, 'name', e.target.value)}
                          placeholder="Nombre del mes"
                          className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white outline-none focus:border-emerald-500"
                        />
                        <input
                          type="number"
                          value={month.days}
                          onChange={(e) => updateMonth(index, 'days', parseInt(e.target.value) || 1)}
                          min={1}
                          max={100}
                          className="w-16 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white text-center outline-none focus:border-emerald-500"
                        />
                        <span className="text-xs text-slate-500">días</span>
                        {formData.months.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeMonth(index)}
                            className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addMonth}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800/50 hover:bg-slate-800 rounded text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      {t('calendars.addMonth') || 'Añadir mes'}
                    </button>
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="bg-slate-950/50 rounded-lg px-4 py-3 text-xs text-slate-500">
                Total: {totalDays(formData.months)} días · {formData.months.length} meses · {formData.days_per_week} días/semana
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition-colors"
                >
                  {editingCalendar ? t('common.save') : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Calendar View */}
      {view === 'calendar' && <CalendarView calendars={calendars} onRefresh={loadCalendars} />}

      {/* Calendars List */}
      {view === 'list' && (
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-slate-500">
              {t('common.loading')}
            </div>
          ) : calendars.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-600">
              <Globe className="w-12 h-12 mb-4 text-slate-700" />
              <p className="text-lg font-medium">{t('calendars.empty')}</p>
              <p className="text-sm mt-1">{t('calendars.emptyHint')}</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {calendars.map((calendar) => {
                const data = parseCalendarData(calendar);
                return (
                  <div
                    key={calendar.id}
                    className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 hover:bg-slate-900/60 transition-colors group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-900/30 flex items-center justify-center">
                          <Calendar className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">{calendar.name}</h3>
                          {calendar.era_name && (
                            <p className="text-xs text-slate-500">{calendar.era_name}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEdit(calendar)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(calendar.id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/30 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {totalDays(data.months || DEFAULT_MONTHS)} {t('calendars.days')}
                      </span>
                      <span>{calendar.days_per_week} {t('calendars.daysPerWeekShort')}</span>
                    </div>

                    <div className="mt-2 text-xs text-slate-600">
                      <div className="truncate">{getDayNamesDisplay(calendar)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
