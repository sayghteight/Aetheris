import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useI18n } from '../../i18n';
import { useManuscriptStore } from '../../store/manuscriptStore';
import {
  Calendar,
  Plus,
  Edit2,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
} from 'lucide-react';

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

export const TimelinePanel: React.FC = () => {
  const { t } = useI18n();
  const { nodes } = useManuscriptStore();

  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    year: 1,
    month: 1,
    day: 1,
    hour: 0,
    minute: 0,
    sceneId: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [loadedEvents] = await Promise.all([
        invoke<TimelineEvent[]>('get_timeline_events'),
      ]);
      setEvents(loadedEvents);
      // Expand first year by default
      if (loadedEvents.length > 0) {
        const years = [...new Set(loadedEvents.map(e => e.year))];
        setExpandedYears(new Set([years[0]]));
      }
    } catch (error) {
      console.error('Error loading timeline:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingEvent) {
        await invoke('update_timeline_event', {
          id: editingEvent.id,
          year: formData.year,
          month: formData.month,
          day: formData.day,
          hour: formData.hour,
          minute: formData.minute,
          title: formData.title,
          description: formData.description || null,
        });
      } else {
        await invoke('create_timeline_event', {
          sceneId: formData.sceneId || null,
          calendarId: null,
          year: formData.year,
          month: formData.month,
          day: formData.day,
          hour: formData.hour,
          minute: formData.minute,
          title: formData.title,
          description: formData.description || null,
        });
      }
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving event:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await invoke('delete_timeline_event', { id });
      loadData();
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  const handleEdit = (event: TimelineEvent) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || '',
      year: event.year,
      month: event.month,
      day: event.day,
      hour: event.hour,
      minute: event.minute,
      sceneId: event.scene_id || '',
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingEvent(null);
    setFormData({
      title: '',
      description: '',
      year: 1,
      month: 1,
      day: 1,
      hour: 0,
      minute: 0,
      sceneId: '',
    });
  };

  const toggleYear = (year: number) => {
    const newExpanded = new Set(expandedYears);
    if (newExpanded.has(year)) {
      newExpanded.delete(year);
    } else {
      newExpanded.add(year);
    }
    setExpandedYears(newExpanded);
  };

  // Group events by year
  const eventsByYear = events.reduce((acc, event) => {
    if (!acc[event.year]) {
      acc[event.year] = [];
    }
    acc[event.year].push(event);
    return acc;
  }, {} as Record<number, TimelineEvent[]>);

  // Sort events within each year by date
  Object.values(eventsByYear).forEach(yearEvents => {
    yearEvents.sort((a, b) => {
      if (a.month !== b.month) return a.month - b.month;
      if (a.day !== b.day) return a.day - b.day;
      if (a.hour !== b.hour) return a.hour - b.hour;
      return a.minute - b.minute;
    });
  });

  const years = Object.keys(eventsByYear).map(Number).sort();

  const formatDate = (event: TimelineEvent) => {
    return `${event.year}/${event.month.toString().padStart(2, '0')}/${event.day.toString().padStart(2, '0')}`;
  };

  const formatTime = (event: TimelineEvent) => {
    if (event.hour === 0 && event.minute === 0) return '';
    return `${event.hour.toString().padStart(2, '0')}:${event.minute.toString().padStart(2, '0')}`;
  };

  const scenes = nodes.filter(n => n.type === 'scene');

  return (
    <div className="h-full flex flex-col pl-6 pt-4 pr-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Calendar className="w-6 h-6 text-violet-400" />
            {t('timeline.title')}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {events.length} {t('timeline.events') || 'eventos'}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('timeline.newEvent')}
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                {editingEvent ? t('timeline.editEvent') : t('timeline.newEvent')}
              </h3>
              <button onClick={resetForm} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  {t('timeline.eventTitle')} *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={t('timeline.eventTitlePlaceholder')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 outline-none focus:border-violet-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    {t('timeline.year')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    {t('timeline.month')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={formData.month}
                    onChange={(e) => setFormData({ ...formData, month: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    {t('timeline.day')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.day}
                    onChange={(e) => setFormData({ ...formData, day: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    {t('timeline.hour')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={formData.hour}
                    onChange={(e) => setFormData({ ...formData, hour: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    {t('timeline.minute')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={formData.minute}
                    onChange={(e) => setFormData({ ...formData, minute: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  {t('timeline.relatedScene')}
                </label>
                <select
                  value={formData.sceneId}
                  onChange={(e) => setFormData({ ...formData, sceneId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-violet-500"
                >
                  <option value="">{t('timeline.noScene')}</option>
                  {scenes.map((scene) => (
                    <option key={scene.id} value={scene.id}>{scene.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  {t('timeline.description')}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t('timeline.descriptionPlaceholder')}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-600 outline-none focus:border-violet-500 resize-none"
                />
              </div>

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
                  className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-semibold transition-colors"
                >
                  {editingEvent ? t('common.save') : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Timeline Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-slate-500">
            {t('common.loading')}
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-600">
            <Calendar className="w-12 h-12 mb-4 text-slate-700" />
            <p className="text-lg font-medium">{t('timeline.empty')}</p>
            <p className="text-sm mt-1">{t('timeline.emptyHint')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {years.map((year) => (
              <div key={year} className="rounded-2xl border border-slate-800/80 bg-slate-900/40 overflow-hidden">
                {/* Year Header */}
                <button
                  onClick={() => toggleYear(year)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/60 hover:bg-slate-900/80 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-violet-400">{year}</span>
                    <span className="text-sm text-slate-500">
                      {eventsByYear[year].length} {t('timeline.events') || 'eventos'}
                    </span>
                  </div>
                  {expandedYears.has(year) ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </button>

                {/* Events */}
                {expandedYears.has(year) && (
                  <div className="divide-y divide-slate-800/50">
                    {eventsByYear[year].map((event) => (
                      <div
                        key={event.id}
                        className="px-4 py-3 flex items-start gap-3 hover:bg-slate-800/30 transition-colors group"
                      >
                        <div className="w-24 shrink-0">
                          <div className="text-sm font-medium text-slate-300">
                            {formatDate(event)}
                          </div>
                          {formatTime(event) && (
                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              {formatTime(event)}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-white truncate">
                            {event.title}
                          </h4>
                          {event.description && (
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                              {event.description}
                            </p>
                          )}
                          {event.scene_id && (
                            <div className="text-xs text-violet-400 mt-1 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {scenes.find(s => s.id === event.scene_id)?.title || 'Escena'}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEdit(event)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(event.id)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/30 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
