import { useEffect, useMemo, useState, useRef, type UIEvent } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { Check, CheckCheck, MessageCircle, RefreshCw, Save, Send, Tag, X, Facebook, Instagram, Trash2, Zap, LogOut, Ghost, Bell, Paperclip, Plus, Mail, PanelRight } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import type { Plantilla } from './CrmModule';

interface WhatsAppMessage {
  id_mensaje: string;
  id_prospecto: string;
  direccion: 'entrante' | 'saliente';
  cuerpo_mensaje: string;
  fecha_envio: string;
  estado_lectura: 'Enviado' | 'Entregado' | 'Leido';
}

interface WhatsAppConversation {
  id: string;
  nombre: string;
  apellido: string;
  telefono?: string;
  whatsapp_id?: string;   // Prefijo de canal: "facebook:...", "instagram:..." o número WA
  email?: string;
  pais?: string;
  curso_interes?: string;
  origen: string;
  estado: string;
  asignado_a?: string;
  etiquetas?: string[];
  no_leidos?: number;
  fue_alumno: boolean;
  fecha_ingreso: string;
  notas_generales?: string;
  ultimo_mensaje?: WhatsAppMessage | null;
}

interface RealtimePayload {
  prospecto: WhatsAppConversation;
  mensaje: WhatsAppMessage;
}

interface ConversationPage {
  items?: WhatsAppConversation[];
  hasMore?: boolean;
}

interface MessagePage {
  prospecto?: WhatsAppConversation;
  mensajes?: WhatsAppMessage[];
  hasMore?: boolean;
}

interface Props {
  apiUrl: string;
  estados: string[];
  cursos?: string[];
  canEdit: boolean;
  onCrmChanged: () => void;
  initialId?: string;
  plantillas?: Plantilla[];
}

const formatDate = (value?: string) => {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const getConversationChannel = (conversation: WhatsAppConversation) => {
  if (conversation.whatsapp_id?.startsWith('facebook:')) return 'Facebook';
  if (conversation.whatsapp_id?.startsWith('instagram:')) return 'Instagram';
  return 'WhatsApp';
};

const displayName = (conversation: WhatsAppConversation) => {
  const full = `${conversation.nombre || ''} ${conversation.apellido || ''}`.trim();
  const channel = getConversationChannel(conversation);
  if (full === 'WHATSAPP SIN APELLIDO' || full === 'FACEBOOK SIN APELLIDO' || full === 'INSTAGRAM SIN APELLIDO' || !full) {
    if (channel === 'Facebook') return 'Usuario de Facebook';
    if (channel === 'Instagram') return 'Usuario de Instagram';
    return conversation.telefono || 'Sin teléfono';
  }
  return full;
};

const CONVERSATION_PAGE_SIZE = 60;
const MESSAGE_PAGE_SIZE = 60;

const sortConversations = (items: WhatsAppConversation[]) => {
  return [...items].sort((a, b) => {
    const dateA = new Date(a.ultimo_mensaje?.fecha_envio || a.fecha_ingreso || 0).getTime();
    const dateB = new Date(b.ultimo_mensaje?.fecha_envio || b.fecha_ingreso || 0).getTime();
    return dateB - dateA;
  });
};

const normalizeTags = (value: string[]) => {
  const seen = new Set<string>();
  return value
    .map(tag => tag.trim())
    .filter(tag => {
      const key = tag.toLowerCase();
      if (!tag || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
};

const mergeConversations = (current: WhatsAppConversation[], next: WhatsAppConversation[]) => {
  const byId = new Map(current.map(item => [item.id, item]));
  next.forEach(item => byId.set(item.id, { ...byId.get(item.id), ...item }));
  return sortConversations(Array.from(byId.values()));
};

const upsertConversation = (items: WhatsAppConversation[], next: WhatsAppConversation) => {
  return mergeConversations(items, [next]);
};

export default function WhatsAppInbox({ apiUrl, estados, cursos = [], canEdit, onCrmChanged, initialId, plantillas = [] }: Props) {
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingMoreConversations, setLoadingMoreConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const selected = useMemo(() => conversations.find(item => item.id === selectedId) || null, [conversations, selectedId]);

  const [showPlantillas, setShowPlantillas] = useState(false);
  const [hideClosed, setHideClosed] = useState(false);
  const [hideComments, setHideComments] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [hideGhosts, setHideGhosts] = useState(false);
  const [filterOrigen, setFilterOrigen] = useState('Todos');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [telefono, setTelefono] = useState('');
  const [estado, setEstado] = useState('Nuevo');
  const [notas, setNotas] = useState('');
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [cursoInteres, setCursoInteres] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [showInlineTagInput, setShowInlineTagInput] = useState(false);
  const [inlineTagDraft, setInlineTagDraft] = useState('');
  const inlineTagInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef('');
  const autoScrollRef = useRef(true);
  const onCrmChangedRef = useRef(onCrmChanged);
  const messageRequestRef = useRef(0);
  const loadingMoreConversationsRef = useRef(false);
  const loadingOlderMessagesRef = useRef(false);

  const availableOrigins = useMemo(() => {
    const origins = new Set<string>();
    conversations.forEach(c => c.origen && origins.add(c.origen));
    return Array.from(origins).sort();
  }, [conversations]);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
    // Fallback con un pequeño delay
    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    }, 50);
  };

  const isNearChatBottom = () => {
    const element = chatContainerRef.current;
    if (!element) return true;
    return element.scrollHeight - element.scrollTop - element.clientHeight < 160;
  };

  const loadConversations = async (reset = true) => {
    if (!reset && (loadingMoreConversationsRef.current || !hasMoreConversations)) return;
    if (reset) {
      setLoading(true);
    } else {
      loadingMoreConversationsRef.current = true;
      setLoadingMoreConversations(true);
    }

    try {
      if (reset) {
        const statusRes = await fetch(`${apiUrl}/api/whatsapp/status`);
        const statusData = await statusRes.json();
        setIsReady(statusData.isReady);
        if (!statusData.isReady && statusData.qr) {
          setQrCode(statusData.qr);
        } else if (statusData.isReady) {
          setQrCode(null);
        }
      }

      const offset = reset ? 0 : conversations.length;
      const response = await fetch(`${apiUrl}/api/whatsapp/conversations?limit=${CONVERSATION_PAGE_SIZE}&offset=${offset}`);
      const data: ConversationPage | WhatsAppConversation[] = await response.json();
      const next = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
      setHasMoreConversations(!Array.isArray(data) && Boolean(data.hasMore));
      setConversations(prev => reset ? next : mergeConversations(prev, next));
      if (reset) {
        setSelectedId(prev => prev ? prev : (next[0]?.id || ''));
      }
    } catch {
      toast.error('No se pudo cargar la bandeja WhatsApp');
    } finally {
      if (reset) {
        setLoading(false);
      } else {
        loadingMoreConversationsRef.current = false;
        setLoadingMoreConversations(false);
      }
    }
  };

  const loadMessages = async (
    prospectoId: string,
    options: { before?: string; mode?: 'replace' | 'prepend'; resolveContact?: boolean } = {},
  ) => {
    const mode = options.mode || 'replace';
    if (mode === 'prepend' && (loadingOlderMessagesRef.current || !hasMoreMessages || !options.before)) return;

    const requestId = mode === 'replace' ? messageRequestRef.current + 1 : messageRequestRef.current;
    if (mode === 'replace') messageRequestRef.current = requestId;

    const previousScrollHeight = chatContainerRef.current?.scrollHeight || 0;
    const previousScrollTop = chatContainerRef.current?.scrollTop || 0;
    if (mode === 'replace') {
      setLoadingMessages(true);
      autoScrollRef.current = true;
    } else {
      loadingOlderMessagesRef.current = true;
      setLoadingOlderMessages(true);
      autoScrollRef.current = false;
    }

    try {
      const params = new URLSearchParams({
        prospecto_id: prospectoId,
        limit: String(MESSAGE_PAGE_SIZE),
      });
      if (options.before) params.set('before', options.before);
      if (options.resolveContact) params.set('resolve_contact', 'true');

      const response = await fetch(`${apiUrl}/api/whatsapp/messages?${params.toString()}`);
      const data: MessagePage = await response.json();
      if (selectedIdRef.current !== prospectoId || requestId !== messageRequestRef.current) return;

      const loadedProspecto = data.prospecto;
      if (loadedProspecto) {
        setConversations(prev => upsertConversation(prev, loadedProspecto));
      }
      const nextMessages = Array.isArray(data.mensajes) ? data.mensajes : [];
      setHasMoreMessages(Boolean(data.hasMore));

      if (mode === 'prepend') {
        setMessages(prev => {
          const existingIds = new Set(prev.map(message => message.id_mensaje));
          return [...nextMessages.filter(message => !existingIds.has(message.id_mensaje)), ...prev];
        });
        requestAnimationFrame(() => {
          const element = chatContainerRef.current;
          if (element) element.scrollTop = previousScrollTop + (element.scrollHeight - previousScrollHeight);
        });
      } else {
        setMessages(nextMessages);
        void markConversationRead(prospectoId);
      }
    } catch {
      toast.error('No se pudo cargar el chat');
    } finally {
      if (mode === 'replace') {
        if (requestId === messageRequestRef.current) setLoadingMessages(false);
      } else {
        loadingOlderMessagesRef.current = false;
        setLoadingOlderMessages(false);
      }
    }
  };

  const markConversationRead = async (prospectoId: string) => {
    try {
      const response = await fetch(`${apiUrl}/api/whatsapp/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospecto_id: prospectoId }),
      });
      const data: WhatsAppConversation = await response.json();
      if (data?.id) {
        setConversations(prev => upsertConversation(prev, data));
      } else {
        setConversations(prev => prev.map(item => item.id === prospectoId ? { ...item, no_leidos: 0 } : item));
      }
    } catch {
      setConversations(prev => prev.map(item => item.id === prospectoId ? { ...item, no_leidos: 0 } : item));
    }
  };

  const markConversationUnread = async (prospectoId: string) => {
    try {
      const response = await fetch(`${apiUrl}/api/whatsapp/unread`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospecto_id: prospectoId }),
      });
      const data: WhatsAppConversation = await response.json();
      if (data?.id) {
        setConversations(prev => upsertConversation(prev, data));
        toast.success('Conversación marcada como no leída');
      } else {
        throw new Error('Invalid response');
      }
    } catch {
      toast.error('No se pudo marcar como no leído');
    }
  };

  useEffect(() => {
    loadConversations();
  }, [apiUrl]);

  useEffect(() => {
    if (initialId) setSelectedId(initialId);
  }, [initialId]);

  useEffect(() => {
    if (loading || loadingMoreConversations || !hasMoreConversations) return;
    const timer = window.setTimeout(() => loadConversations(false), 180);
    return () => window.clearTimeout(timer);
  }, [apiUrl, conversations.length, hasMoreConversations, loading, loadingMoreConversations]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    onCrmChangedRef.current = onCrmChanged;
  }, [onCrmChanged]);

  useEffect(() => {
    let socket: any = null;
    socket = io(apiUrl, { transports: ['websocket', 'polling'] });

    socket.on('whatsapp:message', (payload: RealtimePayload) => {
      setConversations(prev => upsertConversation(prev, payload.prospecto));
      const shouldAppend = payload.mensaje.id_prospecto === selectedIdRef.current;
      autoScrollRef.current = shouldAppend && isNearChatBottom();
      setMessages(prev => {
        if (!shouldAppend) return prev;
        if (prev.some(message => message.id_mensaje === payload.mensaje.id_mensaje)) return prev;
        return [...prev, payload.mensaje];
      });
      if (shouldAppend) {
        void markConversationRead(payload.prospecto.id);
      }
      setSelectedId(prev => prev || payload.prospecto.id);
      onCrmChangedRef.current();
    });

    socket.on('whatsapp:status', (data: any) => {
      if (data.status === 'ready') {
        setIsReady(true);
        setQrCode(null);
      } else if (data.id_mensaje) {
        // Actualizamos el estado del mensaje (tildes) sin perder el resto de los datos
        setMessages(prev => prev.map(item => 
          item.id_mensaje === data.id_mensaje 
            ? { ...item, estado_lectura: data.estado_lectura } 
            : item
        ));
      } else {
        setIsReady(false);
      }
    });

    socket.on('whatsapp:qr', (qr: string) => {
      setQrCode(qr);
      setIsReady(false);
    });

    return () => {
      socket?.disconnect();
    };
  }, [apiUrl]);

  useEffect(() => {
    if (selectedId) {
      setMessages([]);
      setHasMoreMessages(false);
      loadMessages(selectedId);
    }
  }, [selectedId]);

  useEffect(() => {
    const firstMessage = messages[0];
    if (!selected || !firstMessage || loadingMessages || loadingOlderMessages || !hasMoreMessages) return;

    const timer = window.setTimeout(() => {
      loadMessages(selected.id, {
        before: firstMessage.fecha_envio,
        mode: 'prepend',
      });
    }, 220);
    return () => window.clearTimeout(timer);
  }, [selected?.id, messages[0]?.fecha_envio, hasMoreMessages, loadingMessages, loadingOlderMessages]);

  useEffect(() => {
    if (autoScrollRef.current) {
      scrollToBottom();
    } else {
      autoScrollRef.current = true;
    }
  }, [messages, selectedId]);

  useEffect(() => {
    if (!selected) return;
    setNombre(selected.nombre || '');
    setApellido(selected.apellido || '');
    setTelefono(selected.telefono || '');
    setEstado(selected.estado || 'Nuevo');
    setNotas(selected.notas_generales || '');
    setCursoInteres(selected.curso_interes || '');
    setEtiquetas(normalizeTags(selected.etiquetas || []));
    setTagDraft('');
  }, [selected]);

  useEffect(() => {
    if (showInlineTagInput && inlineTagInputRef.current) {
      inlineTagInputRef.current.focus();
    }
  }, [showInlineTagInput]);

  const addTag = async (tagText?: string) => {
    if (!selected || !canEdit) return;
    const newTag = (typeof tagText === 'string' ? tagText : tagDraft).trim();
    if (!newTag) return;
    const next = normalizeTags([...etiquetas, newTag]);
    setEtiquetas(next);
    if (typeof tagText !== 'string') {
      setTagDraft('');
    }
    try {
      const response = await fetch(`${apiUrl}/api/crm/prospectos/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, apellido, telefono, estado, notas_generales: notas, etiquetas: next, curso_interes: cursoInteres }),
      });
      if (response.ok) {
        const data = await response.json();
        setConversations(prev => upsertConversation(prev, { ...selected, ...data }));
        toast.success(`Etiqueta "${newTag}" agregada`);
      } else {
        throw new Error('Error saving tag');
      }
    } catch {
      toast.error('No se pudo guardar la etiqueta');
      setEtiquetas(normalizeTags(selected.etiquetas || []));
    }
  };

  const removeTag = async (tag: string) => {
    if (!selected || !canEdit) return;
    const next = etiquetas.filter(item => item.toLowerCase() !== tag.toLowerCase());
    setEtiquetas(next);
    try {
      const response = await fetch(`${apiUrl}/api/crm/prospectos/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, apellido, telefono, estado, notas_generales: notas, etiquetas: next, curso_interes: cursoInteres }),
      });
      if (response.ok) {
        const data = await response.json();
        setConversations(prev => upsertConversation(prev, { ...selected, ...data }));
        toast.success(`Etiqueta "${tag}" eliminada`);
      } else {
        throw new Error('Error removing tag');
      }
    } catch {
      toast.error('No se pudo eliminar la etiqueta');
      setEtiquetas(normalizeTags(selected.etiquetas || []));
    }
  };

  const saveProspecto = async () => {
    if (!selected || !canEdit) return;
    setSaving(true);
    try {
      const response = await fetch(`${apiUrl}/api/crm/prospectos/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, apellido, telefono, estado, notas_generales: notas, etiquetas: normalizeTags(etiquetas), curso_interes: cursoInteres }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || 'No se pudo guardar');
      setConversations(prev => upsertConversation(prev, { ...selected, ...data }));
      toast.success('Cambios guardados');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const deleteProspecto = async () => {
    if (!selected || !canEdit) return;
    if (!window.confirm('¿Estás seguro de que quieres eliminar este prospecto y todos sus mensajes? Esta acción no se puede deshacer.')) return;
    try {
      const response = await fetch(`${apiUrl}/api/crm/prospectos/${selected.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || data.error || 'No se pudo eliminar');
      }
      toast.success('Prospecto eliminado exitosamente');
      setConversations(prev => prev.filter(item => item.id !== selected.id));
      setSelectedId('');
      onCrmChangedRef.current();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar');
    }
  };

  const logout = async () => {
    if (!window.confirm('¿Estás seguro de que quieres cerrar la sesión de WhatsApp? Tendrás que escanear el QR de nuevo.')) return;
    try {
      await fetch(`${apiUrl}/api/whatsapp/logout`, { method: 'POST' });
      setIsReady(false);
      setQrCode(null);
      toast.success('Sesión cerrada. Reiniciando cliente...');
      setTimeout(() => window.location.reload(), 2000);
    } catch {
      toast.error('No se pudo cerrar la sesión');
    }
  };

  const sendMessage = async () => {
    if (!selected || !draft.trim() || !canEdit) return;
    setSending(true);
    try {
      const response = await fetch(`${apiUrl}/api/whatsapp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_prospecto: selected.id,
          cuerpo_mensaje: draft.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || 'No se pudo enviar');
      setDraft('');
      if (data.metaSkipped) toast('Mensaje guardado localmente: faltan credenciales de Meta');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo enviar');
    } finally {
      setSending(false);
    }
  };

  const handleConversationScroll = (event: UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (distanceToBottom < 160) {
      loadConversations(false);
    }
  };

  const handleChatScroll = () => {
    if (!selected || !messages[0] || loadingOlderMessages || !hasMoreMessages) return;
    if ((chatContainerRef.current?.scrollTop || 0) < 80) {
      loadMessages(selected.id, {
        before: messages[0].fecha_envio,
        mode: 'prepend',
      });
    }
  };

  return (
    <div className="h-full grid grid-cols-[340px_minmax(0,1fr)] bg-white border border-slate-200 shadow-sm overflow-hidden rounded-2xl">
      <section className="border-r border-slate-200 flex flex-col min-w-0 min-h-0">
        <div className="flex flex-col gap-2.5 py-3 px-5 border-b border-slate-200 bg-slate-50 flex-none">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900">Bandeja de Entrada</h3>
              <p className="text-xs text-slate-500">{conversations.length}{hasMoreConversations ? '+' : ''} conversaciones</p>
            </div>
            <div className="flex items-center gap-1">
              {!isReady && (
                <button
                  onClick={() => setShowQrModal(true)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-colors animate-pulse"
                  title="Conectar WhatsApp (Ver QR)"
                >
                  Conectar
                </button>
              )}
              <button onClick={logout} className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600" title="Cerrar Sesión / Reset">
                <LogOut className="w-4 h-4" />
              </button>
              <button onClick={() => loadConversations(true)} className="p-2 rounded-lg text-slate-500 hover:bg-white hover:text-[#00968f]" title="Actualizar">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <select
              value={filterOrigen}
              onChange={e => setFilterOrigen(e.target.value)}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors bg-slate-100 text-slate-600 hover:bg-slate-200 outline-none max-w-[100px] truncate cursor-pointer border border-slate-200"
              title="Filtrar por origen"
            >
              <option value="Todos">Orígenes</option>
              {availableOrigins.map(orig => (
                <option key={orig} value={orig}>{orig}</option>
              ))}
            </select>
            
            <button onClick={() => setHideClosed(!hideClosed)} className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 border ${hideClosed ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}`} title="Ocultar descartados e inscriptos">
              {hideClosed ? 'Limpios' : 'Abiertos'}
            </button>

            <button onClick={() => setHideComments(!hideComments)} className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 border ${!hideComments ? 'bg-pink-100 text-pink-700 border-pink-200 shadow-sm' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}`} title="Mostrar u ocultar comentarios de Instagram">
              <Instagram className="w-3 h-3 shrink-0" />
              {!hideComments ? 'Con Com. IG' : 'Sin Com. IG'}
            </button>

            <button onClick={() => setHideGhosts(!hideGhosts)} className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 border ${hideGhosts ? 'bg-red-100 text-red-700 border-red-200 shadow-sm' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}`} title="Ocultar contactos sin teléfono ni email">
              <Ghost className="w-3 h-3 shrink-0" />
              {hideGhosts ? 'Con Datos' : 'Todos'}
            </button>

            <button onClick={() => setShowUnreadOnly(!showUnreadOnly)} className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 border ${showUnreadOnly ? 'bg-amber-100 text-amber-700 border-amber-200 shadow-sm' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}`} title="Mostrar solo chats con mensajes no leídos">
              <Bell className="w-3 h-3 shrink-0" />
              {showUnreadOnly ? 'No Leídos' : 'Todos'}
            </button>
          </div>
        </div>

        <div onScroll={handleConversationScroll} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="p-5 text-sm text-slate-500">Cargando conversaciones...</div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <MessageCircle className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-semibold">Todavia no hay mensajes</p>
            </div>
          ) : (
            <>
              {conversations.filter(c => {
                if (hideClosed) {
                  const est = c.estado?.toLowerCase() || '';
                  if (est.includes('descartado') || est.includes('perdido') || est.includes('inscripto')) return false;
                }
                if (filterOrigen !== 'Todos' && c.origen !== filterOrigen) {
                  return false;
                }
                if (hideComments && c.origen === 'Instagram - Comentario' && filterOrigen !== 'Instagram - Comentario') {
                  return false;
                }
                if (hideGhosts && !c.telefono && !c.email) {
                  return false;
                }
                if (showUnreadOnly && !c.no_leidos && c.id !== selectedId) {
                  return false;
                }
                return true;
              }).map(conversation => {
                const unread = conversation.no_leidos || 0;
                return (
                <button
                  key={conversation.id}
                  onClick={() => setSelectedId(conversation.id)}
                  className={`w-full text-left px-5 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors ${selectedId === conversation.id ? 'bg-[#0ffff4]/10' : unread ? 'bg-emerald-50/70' : 'bg-white'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {getConversationChannel(conversation) === 'Facebook' && <Facebook className="w-4 h-4 text-blue-600 shrink-0" />}
                        {getConversationChannel(conversation) === 'Instagram' && <Instagram className="w-4 h-4 text-pink-600 shrink-0" />}
                        {getConversationChannel(conversation) === 'WhatsApp' && <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />}
                        <p className={`font-bold truncate ${unread ? 'text-slate-950' : 'text-slate-900'}`}>{displayName(conversation)}</p>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {getConversationChannel(conversation) === 'WhatsApp' ? (conversation.telefono || 'Sin teléfono') : `${getConversationChannel(conversation)}`}
                      </p>
                      {!!conversation.etiquetas?.length && (
                        <div className="flex flex-wrap gap-1 mt-1 max-w-[200px]">
                          {conversation.etiquetas.slice(0, 3).map(tag => (
                            <span key={tag} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-[9px] font-bold text-emerald-700">
                              <Tag className="w-2.5 h-2.5" />
                              {tag}
                            </span>
                          ))}
                          {conversation.etiquetas.length > 3 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-[9px] font-bold text-slate-500">
                              +{conversation.etiquetas.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      {unread > 0 && (
                        <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full border text-[10px] font-black bg-sky-50 text-sky-700 border-sky-200">
                        {conversation.estado}
                      </span>
                      {conversation.asignado_a && (
                        <span className="text-[10px] text-violet-500 font-semibold">↩ {conversation.asignado_a}</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className={`text-sm truncate ${unread ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{conversation.ultimo_mensaje?.cuerpo_mensaje || 'Sin mensajes'}</p>
                    <span className="text-[11px] text-slate-400 shrink-0">{formatDate(conversation.ultimo_mensaje?.fecha_envio)}</span>
                  </div>
                </button>
                );
              })}
              {(hasMoreConversations || loadingMoreConversations) && (
                <div className="px-5 py-3 text-center text-xs font-bold text-[#007a75]">
                  Sincronizando conversaciones...
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <section className={`grid min-w-0 min-h-0 h-full overflow-hidden transition-all duration-300 ${showSidebar ? 'grid-cols-[minmax(0,1fr)_320px]' : 'grid-cols-[minmax(0,1fr)]'}`}>
        {/* 1. EL CONTENEDOR PRINCIPAL DE LA COLUMNA */}
        <div className="flex flex-col h-full min-h-0 min-w-0 bg-chat-bg overflow-hidden">
          {/* 2. EL HEADER (Fijo) */}
          <div className="flex-none min-h-[72px] py-3 px-6 flex items-center justify-between border-b border-slate-200 bg-white">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-[#002d2b] flex items-center justify-center text-white font-bold flex-none">
                {selected ? displayName(selected).charAt(0) : 'W'}
              </div>
              <div className="min-w-0">
                <h3 className="font-black text-slate-900 truncate">{selected ? displayName(selected) : 'Selecciona una conversacion'}</h3>
                <div className="flex flex-col gap-1 mt-0.5">
                  <div className="flex items-center gap-2">
                    {selected && getConversationChannel(selected) === 'Facebook' && <Facebook className="w-3.5 h-3.5 text-blue-600" />}
                    {selected && getConversationChannel(selected) === 'Instagram' && <Instagram className="w-3.5 h-3.5 text-pink-600" />}
                    {selected && getConversationChannel(selected) === 'WhatsApp' && <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />}
                    <p className="text-xs text-slate-500">
                      {selected ? (getConversationChannel(selected) === 'WhatsApp' ? (selected.telefono || 'Sin teléfono') : `${getConversationChannel(selected)}`) : 'Bandeja de entrada'}
                    </p>
                    {selected && (
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => loadMessages(selected.id, { resolveContact: true })} 
                          className="p-1 rounded bg-slate-100 text-slate-400 hover:text-[#00968f] transition-colors" 
                          title="Sincronizar contacto"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => markConversationUnread(selected.id)} 
                          className="p-1 rounded bg-slate-100 text-slate-400 hover:text-[#00968f] transition-colors" 
                          title="Marcar como no leído"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => setShowSidebar(prev => !prev)} 
                          className={`p-1 rounded transition-colors ${showSidebar ? 'bg-slate-200 text-[#00968f]' : 'bg-slate-100 text-slate-400 hover:text-[#00968f]'}`} 
                          title={showSidebar ? "Ocultar espacio de trabajo" : "Mostrar espacio de trabajo"}
                        >
                          <PanelRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  {selected && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      {etiquetas.map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-[10px] font-bold text-emerald-700">
                          <Tag className="w-2.5 h-2.5" />
                          {tag}
                          {canEdit && (
                            <button type="button" onClick={() => removeTag(tag)} className="text-emerald-500 hover:text-red-500 ml-0.5 flex items-center justify-center" title="Quitar etiqueta">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </span>
                      ))}
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          {showInlineTagInput ? (
                            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-full px-2 py-0.5 shadow-sm">
                              <input
                                ref={inlineTagInputRef}
                                type="text"
                                value={inlineTagDraft}
                                onChange={e => setInlineTagDraft(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (inlineTagDraft.trim()) {
                                      void addTag(inlineTagDraft.trim());
                                      setInlineTagDraft('');
                                      setShowInlineTagInput(false);
                                    }
                                  } else if (e.key === 'Escape') {
                                    setShowInlineTagInput(false);
                                    setInlineTagDraft('');
                                  }
                                }}
                                onBlur={() => {
                                  setTimeout(() => {
                                    if (inlineTagDraft.trim()) {
                                      void addTag(inlineTagDraft.trim());
                                    }
                                    setInlineTagDraft('');
                                    setShowInlineTagInput(false);
                                  }, 150);
                                }}
                                placeholder="Nueva etiqueta..."
                                className="text-[10px] font-bold outline-none w-24 bg-transparent text-slate-800"
                              />
                            </div>
                          ) : (
                            <button
                              onClick={() => setShowInlineTagInput(true)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] font-bold text-slate-600 transition-colors"
                              title="Agregar etiqueta"
                            >
                              <Plus className="w-2.5 h-2.5" />
                              Etiqueta
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 3. EL HISTORIAL DE MENSAJES (El único que scrollea) */}
          <div ref={chatContainerRef} onScroll={handleChatScroll} className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4 relative bg-chat-bg custom-scrollbar">
            {!selected ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/50 p-8 text-center">
                {qrCode ? (
                  <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200 flex flex-col items-center max-w-sm">
                    <div className="bg-white p-4 rounded-xl border border-slate-100 mb-4">
                      <QRCodeCanvas value={qrCode} size={200} />
                    </div>
                    <h4 className="text-lg font-black text-slate-900 mb-1">Conectar WhatsApp</h4>
                    <p className="text-xs text-slate-500 mb-4">Escanea el código QR con tu celular para poder responder mensajes de WhatsApp.</p>
                    <button onClick={() => setShowQrModal(true)} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors shadow-sm">
                      Ver en grande
                    </button>
                  </div>
                ) : !isReady && !conversations.length ? (
                  <div className="flex flex-col items-center">
                    <RefreshCw className="w-8 h-8 text-[#00968f] animate-spin mb-4" />
                    <p className="text-sm text-slate-600 font-bold">Iniciando cliente...</p>
                  </div>
                ) : (
                  <div className="max-w-xs">
                    <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h4 className="text-base font-black text-slate-700 mb-1">Selecciona una conversación</h4>
                    <p className="text-xs text-slate-400">Elige un chat de la lista para ver el historial y responder.</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                {getConversationChannel(selected) === 'WhatsApp' && !isReady && (
                  <div className="flex justify-center mb-4">
                    <div className="px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-800 flex items-center gap-2 shadow-sm max-w-md w-full">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                      <span className="flex-1 text-left">WhatsApp está desconectado. Para responder por este medio debes conectarlo.</span>
                      <button onClick={() => setShowQrModal(true)} className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-bold transition-colors shrink-0">
                        Conectar
                      </button>
                    </div>
                  </div>
                )}

            {selected && loadingOlderMessages && (
              <div className="flex justify-center">
                <div className="px-3 py-1.5 rounded-full bg-white/90 border border-slate-200 text-xs font-bold text-[#007a75] shadow-sm">
                  Sincronizando mensajes anteriores...
                </div>
              </div>
            )}

            {loadingMessages && (
              <div className="py-8 text-center text-sm font-bold text-slate-500">Cargando mensajes...</div>
            )}

            {messages.map(message => (
              <div 
                key={message.id_mensaje} 
                className={`flex flex-col ${message.direccion === 'saliente' ? 'items-end' : 'items-start'}`}
              >
                <div className={`max-w-[72%] px-4 py-2.5 shadow-sm rounded-xl ${message.direccion === 'saliente' ? 'bg-chat-bubble-out text-slate-900 rounded-br-sm' : 'bg-white text-slate-900 rounded-bl-sm'}`}>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap break-words text-left">
                    {(() => {
                      const text = message.cuerpo_mensaje;
                      const match = text.match(/^\[Adjunto (image|video|audio|document)\]\(([^\)]+)\)$/i);
                      if (match) {
                        const [, type, url] = match;
                        let finalUrl = url;
                        if (url.startsWith('/')) {
                          finalUrl = `${apiUrl}${url}`;
                        } else if (url.includes('/api/whatsapp/media/')) {
                          const filename = url.split('/api/whatsapp/media/').pop();
                          finalUrl = `${apiUrl}/api/whatsapp/media/${filename}`;
                        }
                        if (type.toLowerCase() === 'image') return <img src={finalUrl} alt="Adjunto" className="max-w-full rounded-lg max-h-64 object-contain" />;
                        if (type.toLowerCase() === 'video') return <video src={finalUrl} controls className="max-w-full rounded-lg max-h-64" />;
                        if (type.toLowerCase() === 'audio') return <audio src={finalUrl} controls className="max-w-full" />;
                        if (type.toLowerCase() === 'document') {
                          const filename = decodeURIComponent(url.split('/').pop() || 'documento');
                          return (
                            <a 
                              href={finalUrl} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="flex items-center gap-2 p-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-800 font-bold transition-all text-xs border border-slate-200 shadow-sm max-w-xs"
                              title="Descargar documento"
                              onClick={e => e.stopPropagation()}
                            >
                              <Paperclip className="w-4 h-4 shrink-0 text-slate-600" />
                              <span className="truncate">{filename}</span>
                            </a>
                          );
                        }
                      }
                      return text;
                    })()}
                  </div>
                  <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-500">
                    <span>{formatDate(message.fecha_envio)}</span>
                    {message.direccion === 'saliente' && (message.estado_lectura === 'Leido' ? <CheckCheck className="w-3.5 h-3.5 text-sky-500" /> : <Check className="w-3.5 h-3.5" />)}
                  </div>
                </div>
              </div>
            ))}
            {/* Div invisible al final para anclar el scroll */}
            <div ref={scrollEndRef} className="h-2 w-full flex-none" />
            </>
            )}
           </div>

          {/* 4. EL FOOTER / INPUT (Fijo) */}
          <div className="flex-none p-4 border-t border-slate-200 bg-white relative">
            {showPlantillas && (
              <div className="absolute bottom-full left-4 mb-2 w-80 max-h-64 bg-white border border-slate-200 shadow-xl rounded-2xl overflow-y-auto z-20 flex flex-col custom-scrollbar">
                <div className="sticky top-0 bg-white border-b border-slate-100 p-3 flex items-center justify-between z-10">
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-[#00968f]" /> Respuestas Rápidas</h4>
                  <button onClick={() => setShowPlantillas(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-2 space-y-1">
                  {plantillas.filter(p => p.activa).map(p => (
                    <button key={p.id} onClick={() => {
                      let text = p.texto;
                      text = text.replace(/\{\{\s*nombre\s*\}\}/gi, selected?.nombre || '');
                      text = text.replace(/\[Nombre\]/gi, selected?.nombre || '[Nombre]');
                      text = text.replace(/\{\{\s*curso\s*\}\}/gi, selected?.curso_interes || 'el curso');
                      text = text.replace(/\[Curso\]/gi, selected?.curso_interes || 'el curso');
                      text = text.replace(/Carrera de Entrenador de Fútbol/gi, selected?.curso_interes || 'el curso');
                      setDraft(text);
                      setShowPlantillas(false);
                    }} className="w-full text-left p-3 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100 group">
                      <p className="font-bold text-slate-700 text-sm truncate group-hover:text-[#00968f]">{p.titulo}</p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{p.texto}</p>
                    </button>
                  ))}
                  {plantillas.filter(p => p.activa).length === 0 && (
                    <p className="text-xs text-slate-500 text-center py-4">No hay plantillas activas.</p>
                  )}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setShowPlantillas(!showPlantillas)}
                className="flex-none w-12 h-12 rounded-xl border border-slate-200 text-slate-500 flex items-center justify-center hover:bg-slate-50 hover:text-[#00968f] transition-colors"
                title="Respuestas rápidas"
                disabled={!selected || !canEdit}
              >
                <Zap className="w-5 h-5" />
              </button>
              <input
                type="text"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Escribir respuesta"
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#0ffff4]/60 transition-all"
                disabled={!selected || !canEdit}
              />
              <button
                onClick={sendMessage}
                disabled={sending || !selected || !draft.trim() || !canEdit}
                className="flex-none w-12 h-12 rounded-xl bg-[#002d2b] text-white flex items-center justify-center hover:bg-[#00968f] transition-colors disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {showSidebar && (
          <aside className="border-l border-slate-200 bg-white p-5 min-h-0 overflow-y-auto custom-scrollbar flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-slate-900">Espacio de trabajo</h3>
              <button 
                onClick={() => setShowSidebar(false)} 
                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                title="Cerrar panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {!selected ? (
              <p className="text-sm text-slate-500">Selecciona una conversacion para editar el embudo y las notas internas.</p>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Nombre</label>
                    <input disabled={!canEdit} value={nombre} onChange={event => setNombre(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0ffff4]/60 disabled:bg-slate-50" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Apellido</label>
                    <input disabled={!canEdit} value={apellido} onChange={event => setApellido(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0ffff4]/60 disabled:bg-slate-50" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    {selected && getConversationChannel(selected) !== 'WhatsApp' ? `ID de ${getConversationChannel(selected)}` : 'Teléfono (WhatsApp)'}
                  </label>
                  <div className="relative">
                    <input 
                      disabled={!canEdit || (selected && getConversationChannel(selected) !== 'WhatsApp')} 
                      value={telefono.includes('@lid') ? 'Número oculto (Privacidad)' : telefono} 
                      onChange={event => !telefono.includes('@lid') && setTelefono(event.target.value)} 
                      className={`w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0ffff4]/60 ${(!canEdit || (selected && getConversationChannel(selected) !== 'WhatsApp') || telefono.includes('@lid')) ? 'bg-slate-50 text-slate-400 italic cursor-not-allowed' : 'bg-white'}`} 
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400 italic">
                    {selected && getConversationChannel(selected) !== 'WhatsApp' ? (
                      `Identificador único del usuario en ${getConversationChannel(selected)}.`
                    ) : (
                      telefono.includes('@lid') 
                        ? 'Este contacto tiene activada la privacidad de WhatsApp.' 
                        : 'Formato internacional sin el + (ej: 54911...)'
                    )}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Estado del CRM</label>
                  <select disabled={!canEdit} value={estado} onChange={event => setEstado(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#0ffff4]/60 disabled:bg-slate-50">
                    {(estados.length ? estados : ['Nuevo', 'Primer Contacto', 'En Seguimiento', 'Formulario QUINTTOS completado', 'Inscripto', 'Descartado']).map(item => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Curso de Interés</label>
                  <select disabled={!canEdit} value={cursoInteres} onChange={event => setCursoInteres(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#0ffff4]/60 disabled:bg-slate-50">
                    <option value="">Sin especificar</option>
                    {cursos.map(item => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Etiquetas de atención</label>
                <div className="flex gap-2">
                  <input
                    disabled={!canEdit}
                    value={tagDraft}
                    onChange={event => setTagDraft(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="Ej: Ana, Urgente, Becas"
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0ffff4]/60 disabled:bg-slate-50"
                  />
                  <button
                    type="button"
                    onClick={() => addTag()}
                    disabled={!canEdit || !tagDraft.trim()}
                    className="h-10 px-3 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-[#00968f] disabled:opacity-50"
                  >
                    Agregar
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {etiquetas.length === 0 ? (
                    <span className="text-xs text-slate-400">Sin etiquetas</span>
                  ) : etiquetas.map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-xs font-bold text-emerald-700">
                      <Tag className="w-3.5 h-3.5" />
                      {tag}
                      {canEdit && (
                        <button type="button" onClick={() => removeTag(tag)} className="text-emerald-500 hover:text-red-500" title="Quitar etiqueta">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Notas internas</label>
                <textarea disabled={!canEdit} value={notas} onChange={event => setNotas(event.target.value)} className="w-full min-h-40 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-[#0ffff4]/60 disabled:bg-slate-50" />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={saveProspecto}
                  disabled={saving || !canEdit}
                  className="flex-1 h-11 rounded-xl bg-[#002d2b] text-white flex items-center justify-center gap-2 text-sm font-bold hover:bg-[#00968f] disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  Guardar
                </button>
                <button
                  onClick={deleteProspecto}
                  disabled={saving || !canEdit}
                  className="flex-none px-4 h-11 rounded-xl border-2 border-red-100 bg-white text-red-500 flex items-center justify-center hover:bg-red-50 disabled:opacity-50 transition-colors"
                  title="Eliminar prospecto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </aside>
      )}
      </section>

      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col p-6 text-center relative border border-slate-200 animate-in zoom-in-95 duration-200">
            <button onClick={() => setShowQrModal(false)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-black text-slate-900 mb-4">Conectar WhatsApp</h3>
            {qrCode ? (
              <div className="flex flex-col items-center">
                <div className="bg-white p-4 rounded-2xl shadow-lg border border-slate-200 mb-4">
                  <QRCodeCanvas value={qrCode} size={256} />
                </div>
                <p className="text-sm text-slate-600 max-w-xs mx-auto mb-4">Escanea el código QR con tu celular para vincular tu cuenta.</p>
              </div>
            ) : isReady ? (
              <div className="py-6 flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <Check className="w-8 h-8" />
                </div>
                <p className="text-sm font-bold text-emerald-700">¡WhatsApp ya está conectado y listo!</p>
              </div>
            ) : (
              <div className="py-8 flex flex-col items-center gap-3">
                <RefreshCw className="w-8 h-8 text-[#00968f] animate-spin mb-2" />
                <p className="text-sm text-slate-600 font-bold">Iniciando cliente...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
