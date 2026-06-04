import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, BarChart3, Plus, X,
  ChevronDown, Settings, Download, Bell, Edit2, Trash2,
  Check, MessageCircle, Calendar, Search, Filter, RefreshCw,
  TrendingUp, Target, UserCheck, Copy, CheckCheck,
  Globe, GraduationCap, Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import WhatsAppInbox from './WhatsAppInbox';
import { io } from 'socket.io-client';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';

// ─── Tipos ─────────────────────────────────────────────────────────────────────
interface CrmConfigItem {
  id: string; tipo: string; valor: string; orden: number;
  color: string; es_ganado: boolean; es_perdido: boolean;
  es_sistema?: boolean; descripcion?: string; accion_sugerida?: string;
  icono?: string; recordatorio_horas?: number; id_plantilla_recordatorio?: string;
  inactividad_dias_descarte?: number;
}
interface CrmConfig {
  estados: CrmConfigItem[]; origenes: CrmConfigItem[];
  cursos: CrmConfigItem[]; operadoras: CrmConfigItem[];
  plantillas: Plantilla[];
}
interface HistorialEntry {
  id: string; fecha_contacto: string; tipo_contacto: string;
  nota?: string; fecha_proximo_aviso?: string;
}
export interface Prospecto {
  id: string; nombre: string; apellido: string; telefono?: string;
  email?: string; pais?: string; curso_interes?: string;
  origen: string; estado: string; asignado_a?: string;
  fue_alumno: boolean; fecha_ingreso: string; notas_generales?: string;
  historial?: HistorialEntry[];
}
interface Stats {
  total: number; inscriptos: number; descartados: number; activos: number;
  tasaConversion: number;
  porEstado: { estado: string; color: string; es_ganado: boolean; es_perdido: boolean; count: number }[];
  porOrigen: { origen: string; color: string; count: number }[];
  alertasSeguimiento: { id: string; prospecto_id: string; nombre: string; telefono?: string; fecha_proximo_aviso: string; nota?: string }[];
}
type SubView = 'dashboard' | 'kanban' | 'lista' | 'whatsapp' | 'plantillas';
type ConfigTab = 'estados' | 'origenes' | 'cursos' | 'operadoras';

// ─── Plantillas de mensajes ───────────────────────────────────────────────────
export interface Plantilla {
  id: string;
  titulo: string;
  categoria: string;
  curso?: string | null;
  estado_sugerido?: string | null;
  texto: string;
  orden: number;
  activa: boolean;
}

// Las plantillas ahora se obtienen de la BD

const CATEGORIAS_COLOR: Record<string, string> = {
  'Primer Contacto': '#8B5CF6',
  'Información': '#3B82F6',
  'Conversión': '#F59E0B',
  'Inscripción': '#22C55E',
  'Seguimiento': '#F97316',
  'Cierre': '#6B7280',
};

// Las descripciones ahora vienen de la base de datos en config.estados

const TIPOS_CONTACTO = ['WhatsApp', 'Llamada', 'Email', 'Reunión', 'Otro'];

function bgLighten(hex: string) { return hex + '22'; }

// ─── Helpers de actividad ────────────────────────────────────────────────────
function getLastContact(p: Prospecto): Date | null {
  if (!p.historial || p.historial.length === 0) return null;
  const sorted = [...p.historial].sort((a, b) =>
    new Date(b.fecha_contacto).getTime() - new Date(a.fecha_contacto).getTime()
  );
  return new Date(sorted[0].fecha_contacto);
}

function getDaysAgo(date: Date | null): number | null {
  if (!date) return null;
  const diff = Date.now() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function ActivityBadge({ p }: { p: Prospecto }) {
  const last = getLastContact(p);
  const days = getDaysAgo(last);
  if (days === null) {
    return <span className="text-[10px] text-slate-400 italic">Sin contacto</span>;
  }
  const color = days === 0 ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
    : days <= 3 ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
    : days <= 7 ? 'text-amber-600 bg-amber-50 border-amber-200'
    : 'text-red-600 bg-red-50 border-red-200';
  const label = days === 0 ? 'Hoy' : days === 1 ? 'Ayer' : `Hace ${days}d`;
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${color}`}>
      {label}
    </span>
  );
}

function EstadoBadge({ estado, config }: { estado: string; config: CrmConfig }) {
  const item = config.estados.find(e => e.valor === estado);
  const color = item?.color || '#6B7280';
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ backgroundColor: bgLighten(color), color, border: `1px solid ${color}44` }}>
      {estado}
    </span>
  );
}

function OrigenBadge({ origen, config }: { origen: string; config: CrmConfig }) {
  const item = config.origenes.find(o => o.valor === origen);
  const color = item?.color || '#6B7280';
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ backgroundColor: bgLighten(color), color, border: `1px solid ${color}44` }}>
      {origen}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={handleCopy} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${copied ? 'bg-green-100 text-green-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>
      {copied ? <><CheckCheck className="w-3.5 h-3.5" /> Copiado!</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
function renderPlantillaText(text: string, prospecto?: Prospecto, fallbackCurso?: string | null) {
  const nombreCompleto = [prospecto?.nombre, prospecto?.apellido].filter(Boolean).join(' ').trim();
  const curso = prospecto?.curso_interes || fallbackCurso || 'la carrera/curso de interés';

  return text
    .replace(/\{\{\s*nombre\s*\}\}/gi, nombreCompleto || prospecto?.nombre || '')
    .replace(/\[Nombre\]/gi, nombreCompleto || prospecto?.nombre || '[Nombre]')
    .replace(/\{\{\s*curso\s*\}\}/gi, curso)
    .replace(/\[Curso\]/gi, curso)
    .replace(/Carrera de Entrenador de Fútbol/gi, curso);
}

interface CrmProps {
  apiUrl: string;
  isSuperadmin: boolean;
  userPermissions?: Record<string, string>;
  subView: SubView;
  onNavigate?: (view: SubView) => void;
}

export default function CrmModule({ apiUrl, isSuperadmin, userPermissions, subView, onNavigate }: CrmProps) {
  const canEdit = isSuperadmin || userPermissions?.['crm'] === 'editor';
  const [config, setConfig] = useState<CrmConfig>({ estados: [], origenes: [], cursos: [], operadoras: [], plantillas: [] });
  const [prospectos, setProspectos] = useState<Prospecto[]>([]);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [showNewProspecto, setShowNewProspecto] = useState(false);
  const [selectedProspecto, setSelectedProspecto] = useState<Prospecto | null>(null);
  const [waInitialId, setWaInitialId] = useState<string | undefined>();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterOrigen, setFilterOrigen] = useState('');
  const [filterAsignado, setFilterAsignado] = useState('');
  const [filterCurso, setFilterCurso] = useState('');

  const fetchConfig = useCallback(async () => {
    const r = await fetch(`${apiUrl}/api/crm/config`);
    if (r.ok) setConfig(await r.json());
  }, [apiUrl]);

  const fetchProspectos = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterEstado) params.set('estado', filterEstado);
    if (filterOrigen) params.set('origen', filterOrigen);
    if (filterAsignado) params.set('asignado_a', filterAsignado);
    if (filterCurso) params.set('curso', filterCurso);
    const r = await fetch(`${apiUrl}/api/crm/prospectos?${params}`);
    if (r.ok) setProspectos(await r.json());
  }, [apiUrl, filterEstado, filterOrigen, filterAsignado, filterCurso]);

  const fetchStats = useCallback(async () => {
    const r = await fetch(`${apiUrl}/api/crm/stats`);
    if (r.ok) setStats(await r.json());
  }, [apiUrl]);

  const fetchPlantillas = useCallback(async () => {
    const r = await fetch(`${apiUrl}/api/crm/plantillas`);
    if (r.ok) setPlantillas(await r.json());
  }, [apiUrl]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchConfig(), fetchProspectos(), fetchStats(), fetchPlantillas()]);
    setLoading(false);
  }, [fetchConfig, fetchProspectos, fetchStats, fetchPlantillas]);

  useEffect(() => { refreshAll(); }, [refreshAll]);
  useEffect(() => { fetchProspectos(); }, [filterEstado, filterOrigen, filterAsignado, filterCurso]);

  useEffect(() => {
    const socket = io(apiUrl, { transports: ['websocket', 'polling'] });

    socket.on('whatsapp:message', () => {
      fetchProspectos();
      fetchStats();
    });

    socket.on('whatsapp:status', () => {
      fetchProspectos();
    });

    return () => {
      socket.disconnect();
    };
  }, [apiUrl, fetchProspectos, fetchStats]);

  useEffect(() => {
    if (!stats?.alertasSeguimiento?.length) return;
    
    const interval = setInterval(() => {
      const now = new Date();
      stats.alertasSeguimiento.forEach((a: any) => {
        const alertTime = new Date(a.fecha_proximo_aviso);
        const diffMs = alertTime.getTime() - now.getTime();
        
        // Trigger if the alert is due within a +/- 1 minute window
        if (diffMs > -60000 && diffMs <= 60000) {
          toast.success(`⏰ Seguimiento pendiente: ${a.nombre}\n${a.nota}`, {
            icon: '🔔',
            id: `alert-seguimiento-${a.id}`, // Previene duplicados
            duration: 15000,
            style: {
              border: '1px solid #00968f',
              padding: '16px',
              color: '#002d2b',
              fontWeight: 'bold',
            },
          });
        }
      });
    }, 30000); // Chequear cada 30 segundos

    return () => clearInterval(interval);
  }, [stats]);

  const handleExport = () => {
    const params = new URLSearchParams();
    if (filterEstado) params.set('estado', filterEstado);
    if (filterOrigen) params.set('origen', filterOrigen);
    if (filterAsignado) params.set('asignado_a', filterAsignado);
    window.open(`${apiUrl}/api/crm/export?${params}`, '_blank');
  };

  const handleUpdateEstado = async (id: string, estado: string) => {
    // Confirmar si es un estado terminal
    const estadoConfig = config.estados.find(e => e.valor === estado);
    if (estadoConfig && (estadoConfig.es_ganado || estadoConfig.es_perdido)) {
      const icono = estadoConfig.es_ganado ? '🎉' : '⚠️';
      const msg = estadoConfig.es_ganado
        ? `${icono} ¿Confirmar como INSCRIPTO? Esta acción marca al prospecto como convertido.`
        : `${icono} ¿Confirmar como DESCARTADO? Esta acción marca al prospecto como perdido.`;
      if (!window.confirm(msg)) return;
    }
    const r = await fetch(`${apiUrl}/api/crm/prospectos/${id}/estado`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado })
    });
    if (r.ok) {
      setProspectos(prev => prev.map(p => p.id === id ? { ...p, estado } : p));
      if (selectedProspecto?.id === id) setSelectedProspecto(prev => prev ? { ...prev, estado } : null);
      fetchStats();
      if (estadoConfig?.es_ganado) toast.success('🎉 ¡Prospecto marcado como Inscripto!');
      if (estadoConfig?.es_perdido) toast('Prospecto descartado', { icon: '📁' });
    } else toast.error('Error al actualizar estado');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este prospecto?')) return;
    await fetch(`${apiUrl}/api/crm/prospectos/${id}`, { method: 'DELETE' });
    setProspectos(prev => prev.filter(p => p.id !== id));
    if (selectedProspecto?.id === id) setSelectedProspecto(null);
    fetchStats();
    toast.success('Prospecto eliminado');
  };

  const openProspecto = async (id: string) => {
    const r = await fetch(`${apiUrl}/api/crm/prospectos/${id}`);
    if (r.ok) setSelectedProspecto(await r.json());
  };

  const filtered = prospectos.filter(p => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.nombre.toLowerCase().includes(term) ||
      p.apellido.toLowerCase().includes(term) ||
      (p.telefono || '').includes(term) ||
      (p.email || '').toLowerCase().includes(term) ||
      (p.pais || '').toLowerCase().includes(term)
    );
  });

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-[#00968f] border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 font-medium">Cargando CRM...</p>
      </div>
    </div>
  );

  return (
    <div className={`h-full flex flex-col ${subView === 'whatsapp' ? '' : 'gap-4 p-4 animate-in fade-in slide-in-from-bottom-4 duration-500'}`}>

      {/* HEADER — oculto en Bandeja WA para máximo espacio */}
      {subView !== 'whatsapp' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900">CRM Prospectos</h2>
            <p className="text-slate-500 text-sm mt-0.5">Gestión de leads y seguimiento comercial</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-sm transition-all shadow hover:-translate-y-0.5">
              <Download className="w-4 h-4" /> Exportar Excel
            </button>
            {canEdit && (
              <button onClick={() => setShowNewProspecto(true)} className="flex items-center gap-2 px-4 py-2.5 bg-[#002d2b] hover:bg-[#00968f] text-white rounded-xl font-medium text-sm transition-all shadow hover:-translate-y-0.5">
                <Plus className="w-4 h-4" /> Nuevo Prospecto
              </button>
            )}
            {isSuperadmin && (
              <button onClick={() => setShowConfig(true)} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-sm transition-all">
                <Settings className="w-4 h-4" /> Configurar
              </button>
            )}
            <button onClick={refreshAll} className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* CONTENIDO */}
      {subView === 'whatsapp' ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <WhatsAppInbox apiUrl={apiUrl} estados={config.estados.map(item => item.valor)} canEdit={canEdit} onCrmChanged={() => { fetchProspectos(); fetchStats(); }} initialId={waInitialId} plantillas={plantillas} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pb-4">
          {subView === 'dashboard' && <DashboardView stats={stats} config={config} onOpenProspecto={async (id) => { await openProspecto(id); onNavigate?.('lista'); }} />}
          {subView === 'kanban' && <KanbanView prospectos={filtered} config={config} canEdit={canEdit} onEstadoChange={handleUpdateEstado} onOpen={openProspecto} onDelete={handleDelete} searchTerm={searchTerm} setSearchTerm={setSearchTerm} />}
          {subView === 'lista' && <ListaView prospectos={filtered} config={config} canEdit={canEdit} onEstadoChange={handleUpdateEstado} onOpen={openProspecto} onDelete={handleDelete} searchTerm={searchTerm} setSearchTerm={setSearchTerm} filterEstado={filterEstado} setFilterEstado={setFilterEstado} filterOrigen={filterOrigen} setFilterOrigen={setFilterOrigen} filterAsignado={filterAsignado} setFilterAsignado={setFilterAsignado} filterCurso={filterCurso} setFilterCurso={setFilterCurso} />}
          {subView === 'plantillas' && <PlantillasView plantillas={plantillas} config={config} canEdit={canEdit} apiUrl={apiUrl} onRefresh={fetchPlantillas} />}
        </div>
      )}

      {/* DRAWER DETALLE */}
      {selectedProspecto && (
        <DrawerDetalle
          prospecto={selectedProspecto}
          plantillas={plantillas}
          config={config}
          canEdit={canEdit}
          apiUrl={apiUrl}
          onClose={() => setSelectedProspecto(null)}
          onOpenInWA={(id) => { setSelectedProspecto(null); setWaInitialId(id); onNavigate?.('whatsapp'); }}
          onEstadoChange={handleUpdateEstado}
          onSave={async (id, data) => {
            const r = await fetch(`${apiUrl}/api/crm/prospectos/${id}`, {
              method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
            });
            if (r.ok) {
              const updated = await r.json();
              setSelectedProspecto(updated);
              setProspectos(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p));
              toast.success('Guardado correctamente');
            } else toast.error('Error al guardar');
          }}
          onAddSeguimiento={async (id, data) => {
            const r = await fetch(`${apiUrl}/api/crm/prospectos/${id}/seguimiento`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
            });
            if (r.ok) {
              const fresh = await fetch(`${apiUrl}/api/crm/prospectos/${id}`);
              if (fresh.ok) { setSelectedProspecto(await fresh.json()); fetchStats(); }
              toast.success('Seguimiento registrado');
            }
          }}
          onDeleteSeguimiento={async (pid, sid) => {
            await fetch(`${apiUrl}/api/crm/prospectos/${pid}/seguimiento/${sid}`, { method: 'DELETE' });
            const fresh = await fetch(`${apiUrl}/api/crm/prospectos/${pid}`);
            if (fresh.ok) setSelectedProspecto(await fresh.json());
          }}
        />
      )}

      {showNewProspecto && (
        <NuevoProspectoModal config={config} apiUrl={apiUrl} onClose={() => setShowNewProspecto(false)}
          onCreated={(p) => { setProspectos(prev => [p, ...prev]); setShowNewProspecto(false); fetchStats(); toast.success('Prospecto creado'); }} />
      )}

      {showConfig && (
        <ConfigModal config={config} apiUrl={apiUrl} onClose={() => { setShowConfig(false); fetchConfig(); }} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD KPIs
// ═══════════════════════════════════════════════════════════════════════════════
function DashboardView({ stats, config, onOpenProspecto }: { stats: Stats | null; config: CrmConfig; onOpenProspecto: (id: string) => void }) {
  const [showEstados, setShowEstados] = useState(false);
  if (!stats) return <div className="text-center text-slate-400 py-20">Cargando estadísticas...</div>;

  const maxEstado = Math.max(...stats.porEstado.map(e => e.count), 1);
  const maxOrigen = Math.max(...stats.porOrigen.map(o => o.count), 1);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Leads', value: stats.total, icon: Users, color: 'var(--kpi-leads-color)', bg: 'var(--kpi-leads-bg)' },
          { label: 'Activos', value: stats.activos, icon: TrendingUp, color: 'var(--kpi-activos-color)', bg: 'var(--kpi-activos-bg)' },
          { label: 'Inscriptos', value: stats.inscriptos, icon: UserCheck, color: 'var(--kpi-inscriptos-color)', bg: 'var(--kpi-inscriptos-bg)' },
          { label: 'Tasa Conversión', value: `${stats.tasaConversion}%`, icon: Target, color: 'var(--kpi-tasa-color)', bg: 'var(--kpi-tasa-bg)' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl shrink-0" style={{ backgroundColor: bg }}>
              <Icon className="w-6 h-6" style={{ color }} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
              <p className="text-3xl font-extrabold" style={{ color }}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Guía de estados */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <button onClick={() => setShowEstados(s => !s)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50"><Info className="w-5 h-5 text-blue-600" /></div>
            <div className="text-left">
              <h3 className="font-bold text-slate-800 text-sm">Guía de Estados del Embudo</h3>
              <p className="text-xs text-slate-500">Qué significa cada etapa y qué acción tomar</p>
            </div>
          </div>
          <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showEstados ? 'rotate-180' : ''}`} />
        </button>
        {showEstados && (
          <div className="border-t border-slate-100 divide-y divide-slate-50">
            {config.estados.map((estado) => {
              return (
                <div key={estado.id} className="px-6 py-4 flex items-start gap-4">
                  <div className="flex items-center gap-3 w-48 shrink-0">
                    <div className="w-3 h-3 rounded-full mt-1" style={{ backgroundColor: estado.color }} />
                    <span className="font-bold text-sm" style={{ color: estado.color }}>{estado.valor}</span>
                    {estado.es_ganado && <span className="text-[9px] font-black text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">GANADO</span>}
                    {estado.es_perdido && <span className="text-[9px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">PERDIDO</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    {estado.descripcion ? (
                      <p className="text-sm text-slate-700">{estado.icono} {estado.descripcion}</p>
                    ) : (
                      <p className="text-sm text-slate-400 italic">Sin descripción configurada</p>
                    )}
                    {estado.accion_sugerida && (
                      <p className="text-xs text-slate-500 mt-1 flex items-start gap-1.5">
                        <span className="font-bold text-[#00968f] shrink-0">Acción:</span>
                        {estado.accion_sugerida}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Funnel */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#00968f]" /> Embudo de Leads
          </h3>
          <div className="space-y-3">
            {stats.porEstado.map(e => (
              <div key={e.estado}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-semibold text-slate-800 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                    {e.estado}
                  </span>
                  <span className="font-bold text-slate-900">{e.count}</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(e.count / maxEstado) * 100}%`, backgroundColor: e.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Por origen */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
            <Filter className="w-5 h-5 text-[#00968f]" /> Fuentes de Captación
          </h3>
          <div className="space-y-3">
            {stats.porOrigen.filter(o => o.count > 0).map(o => (
              <div key={o.origen}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-semibold text-slate-700">{o.origen}</span>
                  <span className="font-bold text-slate-900">{o.count} <span className="text-slate-400 font-normal">({stats.total > 0 ? Math.round(o.count / stats.total * 100) : 0}%)</span></span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(o.count / maxOrigen) * 100}%`, backgroundColor: o.color }} />
                </div>
              </div>
            ))}
            {stats.porOrigen.every(o => o.count === 0) && (
              <p className="text-slate-400 text-sm text-center py-8">Sin datos aún</p>
            )}
          </div>
        </div>
      </div>

      {/* Alertas seguimiento */}
      {stats.alertasSeguimiento.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-amber-700 mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5" /> Seguimientos pendientes ({stats.alertasSeguimiento.length})
          </h3>
          <div className="divide-y divide-slate-100">
            {stats.alertasSeguimiento.map(a => (
              <div key={a.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-bold text-slate-800">{a.nombre}</p>
                  <p className="text-xs text-slate-500">{a.nota || 'Sin nota'}</p>
                </div>
                <div className="flex items-center gap-3">
                  {a.telefono && (
                    <a href={`https://wa.me/${a.telefono.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="p-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-all">
                      <MessageCircle className="w-4 h-4" />
                    </a>
                  )}
                  <button onClick={() => onOpenProspecto(a.prospecto_id)} className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 px-3 py-1.5 rounded-lg font-semibold transition-all">
                    Ver detalle
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLANTILLAS WA
// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// PLANTILLAS WA
// ═══════════════════════════════════════════════════════════════════════════════
function PlantillasView({ plantillas, config, canEdit, apiUrl, onRefresh }: { plantillas: Plantilla[]; config: CrmConfig; canEdit: boolean; apiUrl: string; onRefresh: () => void }) {
  const [catActiva, setCatActiva] = useState<string>('Todos');
  const [cursoActivo, setCursoActivo] = useState<string>('Todos');
  const [showModal, setShowModal] = useState<Partial<Plantilla> | null>(null);
  const categorias = ['Todos', ...Object.keys(CATEGORIAS_COLOR)];
  const cursos = ['Todos', 'Generales', ...config.cursos.map(c => c.valor)];

  const filtradas = plantillas.filter(p => {
    const coincideCategoria = catActiva === 'Todos' || p.categoria === catActiva;
    const coincideCurso = cursoActivo === 'Todos'
      || (cursoActivo === 'Generales' ? !p.curso : p.curso === cursoActivo);
    return coincideCategoria && coincideCurso;
  });

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Eliminar esta plantilla?')) return;
    const r = await fetch(`${apiUrl}/api/crm/plantillas/${id}`, { method: 'DELETE' });
    if (r.ok) { toast.success('Plantilla eliminada'); onRefresh(); }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-green-50 shrink-0"><MessageCircle className="w-6 h-6 text-green-600" /></div>
          <div>
            <h3 className="font-bold text-slate-800">Plantillas de mensajes WhatsApp</h3>
            <p className="text-slate-500 text-sm mt-0.5">Mensajes listos por curso y etapa. Los campos entre [corchetes] deben completarse antes de enviar.</p>
          </div>
        </div>
        {canEdit && (
          <button onClick={() => setShowModal({ titulo: '', categoria: 'Primer Contacto', curso: null, texto: '', activa: true })} className="flex items-center gap-2 px-4 py-2.5 bg-[#002d2b] hover:bg-[#00968f] text-white rounded-xl font-bold text-sm transition-all shadow hover:-translate-y-0.5">
            <Plus className="w-4 h-4" /> Nueva Plantilla
          </button>
        )}
      </div>

      {/* Filtro por categoría */}
      <div className="flex flex-wrap gap-2">
        {categorias.map(cat => (
          <button key={cat} onClick={() => setCatActiva(cat)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all border ${catActiva === cat ? 'bg-[#002d2b] text-white border-[#002d2b]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
            style={catActiva !== cat && CATEGORIAS_COLOR[cat] ? { borderColor: CATEGORIAS_COLOR[cat] + '66', color: CATEGORIAS_COLOR[cat] } : {}}>
            {cat}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Curso / carrera</label>
        <select value={cursoActivo} onChange={e => setCursoActivo(e.target.value)} className="min-w-[240px] px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-[#00968f] outline-none">
          {cursos.map(curso => <option key={curso} value={curso}>{curso}</option>)}
        </select>
        {(catActiva !== 'Todos' || cursoActivo !== 'Todos') && (
          <button onClick={() => { setCatActiva('Todos'); setCursoActivo('Todos'); }} className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold">
            Limpiar filtros
          </button>
        )}
        <span className="text-sm text-slate-500 font-medium">{filtradas.length} plantillas</span>
      </div>

      {/* Lista de plantillas */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {filtradas.map(plantilla => {
          const catColor = CATEGORIAS_COLOR[plantilla.categoria] || '#6B7280';
          return (
            <div key={plantilla.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100" style={{ backgroundColor: catColor + '12' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: catColor }} />
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate">{plantilla.titulo}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: catColor + '20', color: catColor }}>{plantilla.categoria}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/80 text-slate-600 border border-slate-200">{plantilla.curso || 'General'}</span>
                      <span className="text-[10px] text-slate-400">→ Sugerido: <span className="font-semibold text-slate-600">{plantilla.estado_sugerido || 'Cualquiera'}</span></span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CopyButton text={plantilla.texto} />
                  {canEdit && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setShowModal(plantilla)} className="p-1.5 text-slate-400 hover:text-[#00968f] hover:bg-white rounded-lg transition-all"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={(e) => handleDelete(plantilla.id, e)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>
              </div>
              {/* Cuerpo */}
              <div className="px-5 py-4">
                <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{plantilla.texto}</pre>
              </div>
            </div>
          );
        })}
        {filtradas.length === 0 && <div className="xl:col-span-2 py-20 text-center text-slate-400 font-medium">No se encontraron plantillas con esos filtros.</div>}
      </div>

      {showModal && (
        <PlantillaModal plantilla={showModal} config={config} apiUrl={apiUrl} onClose={() => setShowModal(null)} onSave={() => { setShowModal(null); onRefresh(); }} />
      )}
    </div>
  );
}

function PlantillaModal({ plantilla, config, apiUrl, onClose, onSave }: { plantilla: Partial<Plantilla>; config: CrmConfig; apiUrl: string; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    titulo: plantilla.titulo || '',
    categoria: plantilla.categoria || 'Primer Contacto',
    curso: plantilla.curso || '',
    estado_sugerido: plantilla.estado_sugerido || '',
    texto: plantilla.texto || '',
    orden: plantilla.orden || 0,
    activa: plantilla.activa !== false
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo || !form.texto) return toast.error('Título y texto son requeridos');
    setSaving(true);
    const url = plantilla.id ? `${apiUrl}/api/crm/plantillas/${plantilla.id}` : `${apiUrl}/api/crm/plantillas`;
    const r = await fetch(url, { method: plantilla.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (r.ok) { toast.success('Plantilla guardada'); onSave(); } else toast.error('Error al guardar');
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900">{plantilla.id ? 'Editar Plantilla' : 'Nueva Plantilla'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">Título de la plantilla</label>
            <input required value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ej: Primer contacto cálido" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-[#00968f] outline-none" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">Curso / carrera</label>
              <select value={form.curso} onChange={e => setForm(f => ({ ...f, curso: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white outline-none">
                <option value="">General</option>
                {config.cursos.map(c => <option key={c.id} value={c.valor}>{c.valor}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">Etapa</label>
              <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white outline-none">
                {Object.keys(CATEGORIAS_COLOR).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">Estado Sugerido</label>
              <select value={form.estado_sugerido} onChange={e => setForm(f => ({ ...f, estado_sugerido: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white outline-none">
                <option value="">Cualquiera</option>
                {config.estados.map(s => <option key={s.id} value={s.valor}>{s.valor}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">Contenido del mensaje</label>
            <textarea required value={form.texto} onChange={e => setForm(f => ({ ...f, texto: e.target.value }))} rows={8} placeholder="Escribí el mensaje acá..." className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm resize-none focus:ring-2 focus:ring-[#00968f] outline-none font-sans" />
            <p className="text-[10px] text-slate-400 mt-1 italic">Usá {'{{curso}}'} para insertar la carrera/curso del prospecto y {'{{nombre}}'} para insertar su nombre.</p>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-sm transition-all">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 py-3 bg-[#002d2b] hover:bg-[#00968f] text-white rounded-xl font-bold text-sm transition-all shadow-lg hover:shadow-xl">
              {saving ? 'Guardando...' : 'Guardar Plantilla'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// KANBAN
// ═══════════════════════════════════════════════════════════════════════════════
function KanbanDraggableCard({ p, onOpen, config, canEdit, onEstadoChange, isOverlay }: any) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: p.id,
    data: { prospecto: p }
  });
  
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div 
      ref={isOverlay ? undefined : setNodeRef} 
      style={style} 
      {...(!isOverlay ? attributes : {})} 
      {...(!isOverlay ? listeners : {})} 
      className={`bg-white rounded-xl border shadow-sm p-3 hover:shadow-md transition-shadow relative ${isDragging && !isOverlay ? 'opacity-30' : 'opacity-100'} ${isOverlay ? 'shadow-xl ring-2 ring-[#00968f] cursor-grabbing rotate-2' : 'border-slate-100 cursor-grab active:cursor-grabbing'}`} 
      onClick={() => { if(!isDragging && !isOverlay) onOpen(p.id) }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="font-bold text-slate-800 text-sm truncate">{p.nombre} {p.apellido}</p>
            {p.fue_alumno && <span title="Ex alumno"><GraduationCap className="w-3.5 h-3.5 text-[#00968f] shrink-0" /></span>}
          </div>
          {p.curso_interes && <p className="text-[11px] text-slate-500 truncate">{p.curso_interes}</p>}
          {p.pais && <p className="text-[10px] text-slate-400 flex items-center gap-0.5"><Globe className="w-2.5 h-2.5" /> {p.pais}</p>}
        </div>
        <OrigenBadge origen={p.origen} config={config} />
      </div>
      {/* Último contacto */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
        <div className="flex items-center gap-1.5">
          {p.telefono && (
            <a href={`https://wa.me/${p.telefono.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()} className="p-1.5 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg transition-all relative z-10">
              <MessageCircle className="w-3.5 h-3.5" />
            </a>
          )}
          <ActivityBadge p={p} />
        </div>
        {canEdit && (
          <select value={p.estado} onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); onEstadoChange(p.id, e.target.value); }}
            className="text-[10px] font-bold border-0 bg-transparent text-slate-500 cursor-pointer focus:ring-1 focus:ring-[#00968f] rounded-lg py-1 pr-1 relative z-10">
            {config.estados.map((s: any) => <option key={s.id} value={s.valor}>{s.valor}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}

function KanbanDroppableColumn({ estado, col, collapsedCols, setCollapsedCols, config, canEdit, onEstadoChange, onOpen }: any) {
  const { setNodeRef, isOver } = useDroppable({
    id: estado.valor,
  });
  const collapsed = collapsedCols.has(estado.valor);

  return (
    <div className="flex-shrink-0 w-72">
      <div className="rounded-2xl border overflow-hidden shadow-sm" style={{ borderColor: estado.color + '44' }}>
        <div className="flex items-center justify-between px-4 py-3 cursor-pointer select-none" style={{ backgroundColor: estado.color + '18' }} onClick={() => setCollapsedCols((prev: any) => { const s = new Set(prev); s.has(estado.valor) ? s.delete(estado.valor) : s.add(estado.valor); return s; })}>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: estado.color }} />
            <span className="font-bold text-sm text-slate-800">{estado.valor}</span>
            <span className="text-xs font-black px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: estado.color }}>{col.length}</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
        </div>
        {!collapsed && (
          <div ref={setNodeRef} className={`min-h-[120px] p-2 space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar transition-colors ${isOver ? 'bg-slate-200/50 ring-2 ring-inset ring-slate-300' : 'bg-slate-50'}`}>
            {col.map((p: any) => (
              <KanbanDraggableCard key={p.id} p={p} config={config} canEdit={canEdit} onEstadoChange={onEstadoChange} onOpen={onOpen} />
            ))}
            {col.length === 0 && <p className="text-center text-slate-400 text-xs py-8 pointer-events-none">Arrastrar prospectos aquí</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function KanbanView({ prospectos, config, canEdit, onEstadoChange, onOpen, searchTerm, setSearchTerm }: {
  prospectos: Prospecto[]; config: CrmConfig; canEdit: boolean;
  onEstadoChange: (id: string, estado: string) => void;
  onOpen: (id: string) => void; onDelete: (id: string) => void;
  searchTerm: string; setSearchTerm: (v: string) => void;
}) {
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(new Set(['Descartado']));
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  // Filtro local incluyendo teléfono
  const filtered = prospectos.filter(p => {
    if (!searchTerm) return true;
    const t = searchTerm.toLowerCase();
    return (
      p.nombre.toLowerCase().includes(t) ||
      p.apellido.toLowerCase().includes(t) ||
      (p.telefono || '').replace(/\D/g, '').includes(t.replace(/\D/g, '')) ||
      (p.email || '').toLowerCase().includes(t) ||
      (p.pais || '').toLowerCase().includes(t)
    );
  });

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const prospectoId = active.id as string;
    const newEstado = over.id as string;
    
    const prospecto = prospectos.find(p => p.id === prospectoId);
    if (prospecto && prospecto.estado !== newEstado) {
      if (canEdit) {
        onEstadoChange(prospectoId, newEstado);
      } else {
        toast.error('No tienes permisos para cambiar estados');
      }
    }
  };

  const activeProspecto = activeId ? prospectos.find(p => p.id === activeId) : null;

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Nombre, teléfono, email..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00968f] outline-none text-sm" />
      </div>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
          {config.estados.map(estado => {
            const col = filtered.filter(p => p.estado === estado.valor);
            return (
              <KanbanDroppableColumn 
                key={estado.id} estado={estado} col={col} 
                collapsedCols={collapsedCols} setCollapsedCols={setCollapsedCols} 
                config={config} canEdit={canEdit} onEstadoChange={onEstadoChange} onOpen={onOpen} 
              />
            );
          })}
        </div>
        <DragOverlay zIndex={1000}>
          {activeProspecto ? (
            <div className="w-72">
              <KanbanDraggableCard p={activeProspecto} config={config} canEdit={canEdit} onEstadoChange={onEstadoChange} onOpen={onOpen} isOverlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LISTA
// ═══════════════════════════════════════════════════════════════════════════════
function ListaView({ prospectos, config, canEdit, onEstadoChange, onOpen, onDelete, searchTerm, setSearchTerm, filterEstado, setFilterEstado, filterOrigen, setFilterOrigen, filterAsignado, setFilterAsignado, filterCurso, setFilterCurso }: any) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  return (
    <div className="space-y-4">
      {selectedIds.length > 0 && (
        <div className="bg-[#002d2b] text-white rounded-2xl px-6 py-3 flex items-center justify-between animate-in fade-in slide-in-from-top-2 shadow-lg">
          <span className="font-bold">{selectedIds.length} prospectos seleccionados</span>
          <div className="flex gap-2 items-center">
            {canEdit && (
              <>
                <select
                  className="px-3 py-1.5 rounded-lg text-sm bg-white text-slate-900 font-semibold outline-none"
                  onChange={(e) => {
                    if (!e.target.value || !confirm(`¿Cambiar estado de ${selectedIds.length} prospectos?`)) { e.target.value = ''; return; }
                    const estado = e.target.value;
                    selectedIds.forEach(id => onEstadoChange(id, estado));
                    setSelectedIds([]);
                  }}
                >
                  <option value="">Mover a estado...</option>
                  {config.estados.map((e: CrmConfigItem) => <option key={e.id} value={e.valor}>{e.valor}</option>)}
                </select>
                <button
                  onClick={() => {
                    if (!confirm(`¿Estás seguro de eliminar ${selectedIds.length} prospectos de forma permanente?`)) return;
                    selectedIds.forEach(id => onDelete(id));
                    setSelectedIds([]);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 font-bold text-sm transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" /> Eliminar
                </button>
              </>
            )}
            <button onClick={() => setSelectedIds([])} className="p-1.5 hover:bg-white/10 rounded-lg ml-2"><X className="w-5 h-5" /></button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Nombre, teléfono, email, país..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00968f] outline-none text-sm" />
        </div>
        <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-[#00968f] outline-none">
          <option value="">Todos los estados</option>
          {config.estados.map((e: CrmConfigItem) => <option key={e.id} value={e.valor}>{e.valor}</option>)}
        </select>
        <select value={filterOrigen} onChange={e => setFilterOrigen(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-[#00968f] outline-none">
          <option value="">Todos los orígenes</option>
          {config.origenes.map((o: CrmConfigItem) => <option key={o.id} value={o.valor}>{o.valor}</option>)}
        </select>
        <select value={filterAsignado} onChange={e => setFilterAsignado(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-[#00968f] outline-none">
          <option value="">Todas las operadoras</option>
          {config.operadoras.map((o: CrmConfigItem) => <option key={o.id} value={o.valor}>{o.valor}</option>)}
        </select>
        <select value={filterCurso} onChange={e => setFilterCurso(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-[#00968f] outline-none">
          <option value="">Todos los cursos</option>
          {config.cursos.map((c: CrmConfigItem) => <option key={c.id} value={c.valor}>{c.valor}</option>)}
        </select>
        {(filterEstado || filterOrigen || filterAsignado || filterCurso || searchTerm) && (
          <button onClick={() => { setFilterEstado(''); setFilterOrigen(''); setFilterAsignado(''); setFilterCurso(''); setSearchTerm(''); }} className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold flex items-center gap-1">
            <X className="w-3.5 h-3.5" /> Limpiar
          </button>
        )}
        <span className="text-sm text-slate-500 font-medium">{prospectos.length} resultados</span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={selectedIds.length === prospectos.length && prospectos.length > 0} onChange={e => setSelectedIds(e.target.checked ? prospectos.map((p: any) => p.id) : [])} className="rounded border-slate-300 text-[#00968f] focus:ring-[#00968f] cursor-pointer" />
                </th>
                {['Nombre', 'Contacto', 'País', 'Curso', 'Origen', 'Estado', 'Asignado', 'Últ. contacto', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {prospectos.map((p: Prospecto) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => onOpen(p.id)}>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={e => {
                      if (e.target.checked) setSelectedIds([...selectedIds, p.id]);
                      else setSelectedIds(selectedIds.filter(id => id !== p.id));
                    }} className="rounded border-slate-300 text-[#00968f] focus:ring-[#00968f] cursor-pointer" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800">{p.nombre} {p.apellido}</p>
                      {p.fue_alumno && <span title="Ex alumno de la escuela"><GraduationCap className="w-4 h-4 text-[#00968f]" /></span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      {p.telefono && (
                        <a href={`https://wa.me/${p.telefono.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-green-600 hover:underline flex items-center gap-1 text-xs font-medium">
                          <MessageCircle className="w-3 h-3" />{p.telefono}
                        </a>
                      )}
                      {p.email && <span className="text-slate-400 text-xs">{p.email}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{p.pais || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{p.curso_interes || '—'}</td>
                  <td className="px-4 py-3"><OrigenBadge origen={p.origen} config={config} /></td>
                  <td className="px-4 py-3">
                    {canEdit ? (
                      <select value={p.estado} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); onEstadoChange(p.id, e.target.value); }}
                        className="text-xs font-semibold border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-[#00968f] outline-none">
                        {config.estados.map((s: CrmConfigItem) => <option key={s.id} value={s.valor}>{s.valor}</option>)}
                      </select>
                    ) : <EstadoBadge estado={p.estado} config={config} />}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{p.asignado_a || '—'}</td>
                  <td className="px-4 py-3">
                    <ActivityBadge p={p} />
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    {canEdit && (
                      <button onClick={() => onDelete(p.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {prospectos.length === 0 && (
            <div className="py-16 text-center text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Sin prospectos</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRAWER DETALLE
// ═══════════════════════════════════════════════════════════════════════════════
function DrawerDetalle({ prospecto, plantillas, config, canEdit, onClose, onEstadoChange, onSave, onAddSeguimiento, onDeleteSeguimiento, onOpenInWA }: {
  prospecto: Prospecto; plantillas: Plantilla[]; config: CrmConfig; canEdit: boolean; apiUrl: string;
  onClose: () => void;
  onEstadoChange: (id: string, estado: string) => void;
  onSave: (id: string, data: Partial<Prospecto>) => void;
  onAddSeguimiento: (id: string, data: any) => void;
  onDeleteSeguimiento: (pid: string, sid: string) => void;
  onOpenInWA?: (id: string) => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ ...prospecto });
  const [showSeg, setShowSeg] = useState(false);
  const [showPlantillas, setShowPlantillas] = useState(false);
  const [segForm, setSegForm] = useState({ tipo_contacto: 'WhatsApp', nota: '', fecha_proximo_aviso: '' });

  useEffect(() => { setForm({ ...prospecto }); }, [prospecto]);

  const estados = config.estados; const origenes = config.origenes;
  const cursos = config.cursos; const operadoras = config.operadoras;

  // Plantillas sugeridas para el estado actual y el curso del prospecto.
  const coincideCurso = (p: Plantilla) => !p.curso || !prospecto.curso_interes || p.curso === prospecto.curso_interes;
  const plantillasDisponibles = plantillas.filter(p => p.activa !== false && coincideCurso(p));
  const plantillasSugeridas = plantillasDisponibles.filter(p => p.estado_sugerido === prospecto.estado);
  const otrasPlantillas = plantillasDisponibles.filter(p => p.estado_sugerido !== prospecto.estado);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-extrabold text-slate-900 truncate">{prospecto.nombre} {prospecto.apellido}</h3>
              {prospecto.fue_alumno && <span className="flex items-center gap-1 text-[10px] font-black text-[#00968f] bg-[#0ffff4]/20 border border-[#0ffff4]/40 rounded-full px-2 py-0.5 shrink-0"><GraduationCap className="w-3 h-3" />Ex alumno</span>}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <EstadoBadge estado={prospecto.estado} config={config} />
              {prospecto.pais && <span className="text-xs text-slate-400 flex items-center gap-1"><Globe className="w-3 h-3" />{prospecto.pais}</span>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl ml-3 shrink-0"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* DATOS */}
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-slate-700">Datos del Prospecto</h4>
              {canEdit && (
                <button onClick={() => { if (editMode) { onSave(prospecto.id, form); setEditMode(false); } else setEditMode(true); }}
                  className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg font-semibold transition-all ${editMode ? 'bg-[#002d2b] text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
                  {editMode ? <><Check className="w-3.5 h-3.5" /> Guardar</> : <><Edit2 className="w-3.5 h-3.5" /> Editar</>}
                </button>
              )}
            </div>

            {editMode ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[['nombre', 'Nombre'], ['apellido', 'Apellido']].map(([field, label]) => (
                    <div key={field}>
                      <label className="text-xs font-bold text-slate-500 block mb-1">{label}</label>
                      <input value={(form as any)[field] || ''} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-[#00968f] outline-none" />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[['telefono', 'Teléfono'], ['email', 'Email']].map(([field, label]) => (
                    <div key={field}>
                      <label className="text-xs font-bold text-slate-500 block mb-1">{label}</label>
                      <input value={(form as any)[field] || ''} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-[#00968f] outline-none" />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">País</label>
                  <input value={form.pais || ''} onChange={e => setForm(f => ({ ...f, pais: e.target.value }))} placeholder="Ej: Argentina, México, España..." className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-[#00968f] outline-none" />
                </div>
                {/* fue_alumno checkbox */}
                <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                  <input type="checkbox" checked={!!form.fue_alumno} onChange={e => setForm(f => ({ ...f, fue_alumno: e.target.checked }))} className="w-4 h-4 accent-[#00968f] rounded" />
                  <div>
                    <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><GraduationCap className="w-4 h-4 text-[#00968f]" /> Fue alumno de la Escuela</p>
                    <p className="text-xs text-slate-400">Marcar si esta persona ya cursó anteriormente</p>
                  </div>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Curso de Interés</label>
                    <select value={form.curso_interes || ''} onChange={e => setForm(f => ({ ...f, curso_interes: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-[#00968f] outline-none">
                      <option value="">Sin especificar</option>
                      {cursos.map(c => <option key={c.id} value={c.valor}>{c.valor}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Origen</label>
                    <select value={form.origen} onChange={e => setForm(f => ({ ...f, origen: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-[#00968f] outline-none">
                      {origenes.map(o => <option key={o.id} value={o.valor}>{o.valor}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Asignado a</label>
                    <select value={form.asignado_a || ''} onChange={e => setForm(f => ({ ...f, asignado_a: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-[#00968f] outline-none">
                      <option value="">Sin asignar</option>
                      {operadoras.map(o => <option key={o.id} value={o.valor}>{o.valor}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Estado</label>
                    <select value={form.estado} onChange={e => { setForm(f => ({ ...f, estado: e.target.value })); onEstadoChange(prospecto.id, e.target.value); }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-[#00968f] outline-none">
                      {estados.map(s => <option key={s.id} value={s.valor}>{s.valor}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Notas generales</label>
                  <textarea value={form.notas_generales || ''} onChange={e => setForm(f => ({ ...f, notas_generales: e.target.value }))} rows={3} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm resize-none focus:ring-2 focus:ring-[#00968f] outline-none" />
                </div>
                <button onClick={() => setEditMode(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['Teléfono', prospecto.telefono, 'phone'],
                    ['Email', prospecto.email, 'email'],
                    ['País', prospecto.pais, 'text'],
                    ['Curso', prospecto.curso_interes, 'text'],
                    ['Origen', prospecto.origen, 'text'],
                    ['Asignado', prospecto.asignado_a, 'text'],
                    ['Ingresó', new Date(prospecto.fecha_ingreso).toLocaleDateString('es-AR'), 'text'],
                  ].map(([label, value, type]) => (
                    <div key={label as string}>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label as string}</p>
                      {type === 'phone' && value ? (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800 text-sm">{value as string}</span>
                          <button
                            onClick={() => onOpenInWA?.(prospecto.id)}
                            title="Abrir en Bandeja WA"
                            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-green-50 border border-green-200 text-green-700 text-[11px] font-bold hover:bg-green-100 transition-colors"
                          >
                            <MessageCircle className="w-3 h-3" />Bandeja WA
                          </button>
                        </div>
                      ) : type === 'email' && value ? (
                        <a href={`mailto:${value}`} className="text-blue-600 font-semibold text-sm hover:underline">{value as string}</a>
                      ) : (
                        <p className="font-semibold text-slate-800 text-sm">{(value as string) || '—'}</p>
                      )}
                    </div>
                  ))}
                </div>
                {prospecto.notas_generales && (
                  <div className="col-span-2 bg-slate-50 rounded-xl p-3">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Notas</p>
                    <p className="font-medium text-slate-700 text-sm">{prospecto.notas_generales}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* PLANTILLAS SUGERIDAS (en drawer) */}
          <div className="p-6 border-b border-slate-100">
            <button onClick={() => setShowPlantillas(s => !s)} className="w-full flex items-center justify-between">
              <h4 className="font-bold text-slate-700 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-green-600" />
                Plantillas WA
                {plantillasSugeridas.length > 0 && <span className="text-xs bg-green-100 text-green-700 font-black px-2 py-0.5 rounded-full">{plantillasSugeridas.length} sugeridas</span>}
              </h4>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showPlantillas ? 'rotate-180' : ''}`} />
            </button>
            {showPlantillas && (
              <div className="mt-4 space-y-3">
                {plantillasSugeridas.length > 0 && (
                  <>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">💡 Sugeridas para estado "{prospecto.estado}"</p>
                    {plantillasSugeridas.map(p => (
                      <div key={p.id} className="bg-green-50 border border-green-100 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-sm font-bold text-slate-700">{p.titulo}</p>
                            <p className="text-[10px] text-slate-500">{p.curso || 'General'} · {p.categoria}</p>
                          </div>
                          <CopyButton text={renderPlantillaText(p.texto, prospecto, p.curso)} />
                        </div>
                        <pre className="text-xs text-slate-600 whitespace-pre-wrap font-sans leading-relaxed line-clamp-4">{renderPlantillaText(p.texto, prospecto, p.curso)}</pre>
                      </div>
                    ))}
                  </>
                )}
                {otrasPlantillas.length > 0 && (
                  <>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-4">Otras plantillas</p>
                    {otrasPlantillas.map(p => (
                      <div key={p.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-sm font-bold text-slate-700">{p.titulo}</p>
                            <p className="text-[10px] text-slate-400">{p.curso || 'General'} · {p.categoria} · Estado: {p.estado_sugerido || 'Cualquiera'}</p>
                          </div>
                          <CopyButton text={renderPlantillaText(p.texto, prospecto, p.curso)} />
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* HISTORIAL */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-slate-700 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#00968f]" /> Historial de Seguimientos
              </h4>
              {canEdit && (
                <button onClick={() => setShowSeg(s => !s)} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-[#002d2b] text-white font-semibold hover:bg-[#00968f] transition-all">
                  <Plus className="w-3.5 h-3.5" /> Agregar
                </button>
              )}
            </div>

            {showSeg && canEdit && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-4 space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Tipo de contacto</label>
                  <select value={segForm.tipo_contacto} onChange={e => setSegForm(s => ({ ...s, tipo_contacto: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white">
                    {TIPOS_CONTACTO.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Nota / Detalle</label>
                  <textarea value={segForm.nota} onChange={e => setSegForm(s => ({ ...s, nota: e.target.value }))} rows={3} placeholder="Ej: Me pidió que le escriba el mes que viene..." className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm resize-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Fecha próximo aviso</label>
                  <input type="date" value={segForm.fecha_proximo_aviso} onChange={e => setSegForm(s => ({ ...s, fecha_proximo_aviso: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { onAddSeguimiento(prospecto.id, segForm); setSegForm({ tipo_contacto: 'WhatsApp', nota: '', fecha_proximo_aviso: '' }); setShowSeg(false); }}
                    className="flex-1 py-2 bg-[#002d2b] hover:bg-[#00968f] text-white rounded-xl text-sm font-bold">Guardar</button>
                  <button onClick={() => setShowSeg(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-semibold">Cancelar</button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {(prospecto.historial || []).map(h => (
                <div key={h.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{h.tipo_contacto}</span>
                      <span className="text-xs text-slate-400">{new Date(h.fecha_contacto).toLocaleDateString('es-AR')}</span>
                    </div>
                    {canEdit && (
                      <button onClick={() => onDeleteSeguimiento(prospecto.id, h.id)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {h.nota && <p className="text-sm text-slate-700 mt-2">{h.nota}</p>}
                  {h.fecha_proximo_aviso && (
                    <p className="text-xs text-amber-600 font-semibold mt-2 flex items-center gap-1">
                      <Bell className="w-3 h-3" /> Próximo aviso: {new Date(h.fecha_proximo_aviso + 'T00:00:00').toLocaleDateString('es-AR')}
                    </p>
                  )}
                </div>
              ))}
              {(!prospecto.historial || prospecto.historial.length === 0) && (
                <p className="text-center text-slate-400 text-sm py-8">Sin seguimientos registrados</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL NUEVO PROSPECTO
// ═══════════════════════════════════════════════════════════════════════════════
function NuevoProspectoModal({ config, apiUrl, onClose, onCreated }: { config: CrmConfig; apiUrl: string; onClose: () => void; onCreated: (p: Prospecto) => void }) {
  const [form, setForm] = useState({
    nombre: '', apellido: '', telefono: '', email: '', pais: '',
    curso_interes: '', origen: config.origenes[0]?.valor || 'WhatsApp',
    estado: config.estados[0]?.valor || 'Nuevo', asignado_a: '',
    fue_alumno: false, notas_generales: ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre || !form.apellido) { toast.error('Nombre y apellido son requeridos'); return; }
    setSaving(true);
    const r = await fetch(`${apiUrl}/api/crm/prospectos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (r.ok) { onCreated(await r.json()); }
    else toast.error('Error al crear prospecto');
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h3 className="text-lg font-bold text-slate-900">Nuevo Prospecto</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-2 gap-4">
            {[['nombre', 'Nombre *'], ['apellido', 'Apellido *']].map(([f, l]) => (
              <div key={f}>
                <label className="text-xs font-bold text-slate-500 block mb-1">{l}</label>
                <input required value={(form as any)[f]} onChange={e => setForm(prev => ({ ...prev, [f]: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-[#00968f] outline-none" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[['telefono', 'Teléfono / WhatsApp'], ['email', 'Email']].map(([f, l]) => (
              <div key={f}>
                <label className="text-xs font-bold text-slate-500 block mb-1">{l}</label>
                <input value={(form as any)[f]} onChange={e => setForm(prev => ({ ...prev, [f]: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-[#00968f] outline-none" />
              </div>
            ))}
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">País / Ciudad</label>
            <input value={form.pais} onChange={e => setForm(prev => ({ ...prev, pais: e.target.value }))} placeholder="Ej: Argentina, México, España..." className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-[#00968f] outline-none" />
          </div>
          {/* fue_alumno */}
          <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
            <input type="checkbox" checked={form.fue_alumno} onChange={e => setForm(prev => ({ ...prev, fue_alumno: e.target.checked }))} className="w-4 h-4 accent-[#00968f] rounded" />
            <div>
              <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><GraduationCap className="w-4 h-4 text-[#00968f]" /> Fue alumno de la Escuela</p>
              <p className="text-xs text-slate-400">Marcar si ya cursó anteriormente en EMM</p>
            </div>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">Origen *</label>
              <select value={form.origen} onChange={e => setForm(prev => ({ ...prev, origen: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-[#00968f] outline-none">
                {config.origenes.map(o => <option key={o.id} value={o.valor}>{o.valor}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">Curso de Interés</label>
              <select value={form.curso_interes} onChange={e => setForm(prev => ({ ...prev, curso_interes: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-[#00968f] outline-none">
                <option value="">Sin especificar</option>
                {config.cursos.map(c => <option key={c.id} value={c.valor}>{c.valor}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">Estado inicial</label>
              <select value={form.estado} onChange={e => setForm(prev => ({ ...prev, estado: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-[#00968f] outline-none">
                {config.estados.map(s => <option key={s.id} value={s.valor}>{s.valor}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">Asignado a</label>
              <select value={form.asignado_a} onChange={e => setForm(prev => ({ ...prev, asignado_a: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-[#00968f] outline-none">
                <option value="">Sin asignar</option>
                {config.operadoras.map(o => <option key={o.id} value={o.valor}>{o.valor}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">Nota inicial</label>
            <textarea value={form.notas_generales} onChange={e => setForm(prev => ({ ...prev, notas_generales: e.target.value }))} rows={2} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm resize-none focus:ring-2 focus:ring-[#00968f] outline-none" placeholder="Comentario inicial..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-sm transition-all">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 py-3 bg-[#002d2b] hover:bg-[#00968f] text-white rounded-xl font-bold text-sm transition-all">
              {saving ? 'Guardando...' : 'Crear Prospecto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL CONFIG
// ═══════════════════════════════════════════════════════════════════════════════
function ConfigModal({ config, apiUrl, onClose }: { config: CrmConfig; apiUrl: string; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<ConfigTab>('estados');
  const [items, setItems] = useState<CrmConfigItem[]>([]);
  const [newValor, setNewValor] = useState('');
  const [newColor, setNewColor] = useState('#6B7280');
  const [newEsGanado, setNewEsGanado] = useState(false);
  const [newEsPerdido, setNewEsPerdido] = useState(false);
  const [newDesc, setNewDesc] = useState('');
  const [newAccion, setNewAccion] = useState('');
  const [newIcono, setNewIcono] = useState('🔵');
  const [newRecHoras, setNewRecHoras] = useState<number>(0);
  const [newRecPlantilla, setNewRecPlantilla] = useState('');
  const [newDescDias, setNewDescDias] = useState<number>(0);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValor, setEditValor] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editEsGanado, setEditEsGanado] = useState(false);
  const [editEsPerdido, setEditEsPerdido] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [editAccion, setEditAccion] = useState('');
  const [editIcono, setEditIcono] = useState('');
  const [editRecHoras, setEditRecHoras] = useState<number>(0);
  const [editRecPlantilla, setEditRecPlantilla] = useState('');
  const [editDescDias, setEditDescDias] = useState<number>(0);
  const [showStateDetails, setShowStateDetails] = useState(false);
  const showColorPicker = activeTab !== 'cursos';

  const fetchItems = useCallback(async () => {
    const r = await fetch(`${apiUrl}/api/crm/config`);
    if (r.ok) {
      const data = await r.json();
      setItems(data[activeTab] || []);
    }
  }, [apiUrl, activeTab]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleAdd = async () => {
    if (!newValor.trim()) return;
    if (activeTab === 'estados') {
      await fetch(`${apiUrl}/api/crm/estados`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nombre: newValor.trim(), color: newColor, icono: newIcono, 
          es_ganado: newEsGanado, es_perdido: newEsPerdido, 
          descripcion: newDesc, accion_sugerida: newAccion, 
          recordatorio_horas: newRecHoras || null,
          id_plantilla_recordatorio: newRecPlantilla || null,
          inactividad_dias_descarte: newDescDias || null,
          orden: items.length 
        })
      });
      setNewDesc(''); setNewAccion(''); setNewIcono('🔵'); setNewRecHoras(0); setNewRecPlantilla(''); setNewDescDias(0);
    } else {
      const tipo = activeTab === 'origenes' ? 'origen' : activeTab === 'cursos' ? 'curso' : 'operadora';
      await fetch(`${apiUrl}/api/crm/config`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo, valor: newValor.trim(), color: newColor, es_ganado: newEsGanado, es_perdido: newEsPerdido, orden: items.length }) });
    }
    setNewValor(''); setNewColor('#6B7280'); setNewEsGanado(false); setNewEsPerdido(false);
    fetchItems();
  };

  const handleUpdate = async (id: string) => {
    if (activeTab === 'estados') {
      await fetch(`${apiUrl}/api/crm/estados/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nombre: editValor, color: editColor, icono: editIcono, 
          es_ganado: editEsGanado, es_perdido: editEsPerdido, 
          descripcion: editDesc, accion_sugerida: editAccion,
          recordatorio_horas: editRecHoras || null,
          id_plantilla_recordatorio: editRecPlantilla || null,
          inactividad_dias_descarte: editDescDias || null
        })
      });
    } else {
      await fetch(`${apiUrl}/api/crm/config/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ valor: editValor, color: editColor, es_ganado: editEsGanado, es_perdido: editEsPerdido }) });
    }
    setEditingId(null); fetchItems();
  };

  const handleDelete = async (id: string, isSistema?: boolean) => {
    if (isSistema) return toast.error('No se puede eliminar un estado del sistema');
    if (!confirm('¿Eliminar este ítem?')) return;
    const url = activeTab === 'estados' ? `${apiUrl}/api/crm/estados/${id}` : `${apiUrl}/api/crm/config/${id}`;
    await fetch(url, { method: 'DELETE' });
    fetchItems();
  };

  const TABS: { id: ConfigTab; label: string }[] = [
    { id: 'estados', label: '🎯 Estados' },
    { id: 'origenes', label: '📡 Orígenes' },
    { id: 'cursos', label: '📚 Cursos' },
    { id: 'operadoras', label: '👩 Operadoras' },
  ];


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Settings className="w-5 h-5 text-[#00968f]" /> Configuración CRM</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex border-b border-slate-100 px-6 gap-1 pt-2 shrink-0 flex-wrap">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-all ${activeTab === t.id ? 'bg-[#002d2b] text-white' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>{t.label}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="space-y-4 mb-8">
            {items.map(item => (
              <div key={item.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                {editingId === item.id ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <input value={editValor} onChange={e => setEditValor(e.target.value)} className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm" placeholder="Nombre..." />
                      {showColorPicker && <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} className="w-9 h-9 rounded-xl cursor-pointer border-0" />}
                      <div className="flex gap-1">
                        <button onClick={() => handleUpdate(item.id)} className="p-2 bg-[#002d2b] text-white rounded-xl shadow-sm"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditingId(null)} className="p-2 bg-white text-slate-400 border border-slate-200 rounded-xl"><X className="w-4 h-4" /></button>
                      </div>
                    </div>
                    {activeTab === 'estados' && (
                      <button onClick={() => setShowStateDetails(!showStateDetails)} className="text-[10px] font-bold text-[#00968f] hover:underline uppercase tracking-wider mb-1">
                        {showStateDetails ? 'Ocultar detalles avanzados' : 'Configurar automatización y guía'}
                      </button>
                    )}
                    {showStateDetails && (
                      <div className="space-y-2 pt-1 animate-in fade-in zoom-in-95 duration-200">
                        <div className="grid grid-cols-2 gap-4">
                          <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-100 cursor-pointer">
                            <input type="checkbox" checked={editEsGanado} onChange={e => setEditEsGanado(e.target.checked)} className="rounded" />
                            <span className="text-xs font-bold text-green-700">Marcar como GANADO</span>
                          </label>
                          <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-100 cursor-pointer">
                            <input type="checkbox" checked={editEsPerdido} onChange={e => setEditEsPerdido(e.target.checked)} className="rounded" />
                            <span className="text-xs font-bold text-red-600">Marcar como PERDIDO</span>
                          </label>
                        </div>
                        <input value={editIcono} onChange={e => setEditIcono(e.target.value)} placeholder="Icono (Emoji)..." className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs" />
                        <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Descripción de la etapa..." className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs" />
                        <input value={editAccion} onChange={e => setEditAccion(e.target.value)} placeholder="Acción sugerida (Ej: Enviar info)..." className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs" />
                        
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Recordatorio (Horas)</label>
                            <input type="number" value={editRecHoras} onChange={e => setEditRecHoras(parseInt(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Auto-Descarte (Días)</label>
                            <input type="number" value={editDescDias} onChange={e => setEditDescDias(parseInt(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs" />
                          </div>
                        </div>
                        <div className="space-y-1 mt-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Plantilla de Seguimiento</label>
                          <select value={editRecPlantilla} onChange={e => setEditRecPlantilla(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white">
                            <option value="">Ninguna (Usar mensaje por defecto)</option>
                            {config.plantillas.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        {showColorPicker && <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />}
                        <span className="font-bold text-slate-800 text-sm">{item.icono} {item.valor}</span>
                        {item.es_ganado && <span className="text-[9px] font-black text-green-700 bg-green-100 px-2 py-0.5 rounded-full">GANADO</span>}
                        {item.es_perdido && <span className="text-[9px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full">PERDIDO</span>}
                        {item.es_sistema && <span className="text-[9px] font-bold text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded-full">SISTEMA</span>}
                      </div>
                      {showStateDetails && item.descripcion && <p className="text-xs text-slate-500 line-clamp-1">{item.descripcion}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { 
                        setEditingId(item.id); 
                        setEditValor(item.valor); 
                        setEditColor(item.color); 
                        setEditEsGanado(item.es_ganado); 
                        setEditEsPerdido(item.es_perdido); 
                        setEditDesc(item.descripcion || ''); 
                        setEditAccion(item.accion_sugerida || ''); 
                        setEditIcono(item.icono || '🔵');
                        setEditRecHoras(item.recordatorio_horas || 0);
                        setEditRecPlantilla(item.id_plantilla_recordatorio || '');
                        setEditDescDias(item.inactividad_dias_descarte || 0);
                      }} 
                        className="p-2 text-slate-400 hover:text-[#00968f] hover:bg-white rounded-xl transition-all">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(item.id, item.es_sistema)} disabled={item.es_sistema}
                        className={`p-2 rounded-xl transition-all ${item.es_sistema ? 'text-slate-200' : 'text-slate-400 hover:text-red-600 hover:bg-white'}`}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {items.length === 0 && <p className="text-center text-slate-400 text-sm py-12">No hay ítems configurados</p>}
          </div>
          
          <div className="bg-slate-100 rounded-2xl p-5">
            <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><Plus className="w-4 h-4" /> Agregar nuevo {activeTab.slice(0, -1)}</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input value={newIcono} onChange={e => setNewIcono(e.target.value)} placeholder="Icono" className="w-16 px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-[#00968f] outline-none" />
                <input value={newValor} onChange={e => setNewValor(e.target.value)} placeholder="Nombre..." className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-[#00968f] outline-none" />
                {showColorPicker && <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="w-11 h-11 rounded-xl cursor-pointer border-0 shadow-sm" />}
              </div>
              {activeTab === 'estados' && (
                <button onClick={() => setShowStateDetails(!showStateDetails)} className="text-[10px] font-bold text-[#00968f] hover:underline uppercase tracking-wider">
                  {showStateDetails ? 'Ocultar detalles avanzados' : 'Configurar automatización y guía'}
                </button>
              )}
              {showStateDetails && (
                <div className="grid grid-cols-1 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200 cursor-pointer">
                      <input type="checkbox" checked={newEsGanado} onChange={e => setNewEsGanado(e.target.checked)} className="rounded accent-[#00968f]" />
                      <span className="text-xs font-bold text-green-700">Es etapa GANADA</span>
                    </label>
                    <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200 cursor-pointer">
                      <input type="checkbox" checked={newEsPerdido} onChange={e => setNewEsPerdido(e.target.checked)} className="rounded accent-[#00968f]" />
                      <span className="text-xs font-bold text-red-600">Es etapa PERDIDA</span>
                    </label>
                  </div>
                  <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Descripción de la etapa..." className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm" />
                  <input value={newAccion} onChange={e => setNewAccion(e.target.value)} placeholder="Acción sugerida..." className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm" />
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">Recordatorio (hs)</label>
                      <input type="number" value={newRecHoras} onChange={e => setNewRecHoras(parseInt(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">Descarte (días)</label>
                      <input type="number" value={newDescDias} onChange={e => setNewDescDias(parseInt(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">Plantilla de Seguimiento</label>
                    <select value={newRecPlantilla} onChange={e => setNewRecPlantilla(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white">
                      <option value="">Ninguna (Defecto)</option>
                      {config.plantillas.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
                    </select>
                  </div>
                </div>
              )}
              <button onClick={handleAdd} disabled={!newValor.trim()} className="w-full py-3 bg-[#002d2b] hover:bg-[#00968f] text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 shadow-lg hover:shadow-xl mt-2">
                Agregar ítem a la lista
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
