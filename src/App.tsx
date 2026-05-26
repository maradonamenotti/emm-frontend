import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import toast, { Toaster } from 'react-hot-toast';
import {
  FileSpreadsheet,
  Download,
  Upload,
  User,
  Mail,
  LogOut,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Users,
  Search,
  UserPlus,
  Copy,
  X,
  School,
  LayoutDashboard,
  Edit,
  BarChart3,
  Columns,
  List,
  MessageCircle,
  BookMarked,
  ChevronDown,
  Sun,
  Moon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { type StudentData as BaseStudentData, getSubjectsByLicencia } from './services/pdfService';
import logo from './assets/logo.png';
import logoHorizontal from './assets/logo_horizontal.png';
import CrmModule from './CrmModule';

type UserRole = 'superadmin' | 'editor' | 'viewer' | 'student';

interface UserProfile {
  id: string;
  email?: string;
  documento?: string;
  role: UserRole;
  name: string;
  licencia?: string;
  permissions?: Record<string, string>;
}

interface StudentData extends BaseStudentData {
  email?: string;
  apellido?: string;
  nacionalidad?: string;
  carrera_licencia?: string;
  comision?: string;
  situacion?: string;
  estado_analitico?: 'borrador' | 'emitido';
  diploma_emitido?: boolean;
  fecha_emision?: string;
  fecha_fin_cursada?: string;
  pagos_ok?: boolean;
  documentacion_ok?: boolean;
  historial?: any[];
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
          <div className="bg-white p-8 rounded-xl shadow-lg border border-red-200 text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Algo salió mal</h1>
            <p className="text-slate-600 mb-6">Hubo un error al cargar la aplicación.</p>
            <button onClick={() => window.location.reload()} className="bg-red-600 text-white px-6 py-2 rounded-lg">
              Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const API_URL = import.meta.env.VITE_API_URL || 'https://analiticos-backend-production.up.railway.app';

  const [activeTab, setActiveTab] = useState<'dashboard' | 'alumnos' | 'usuarios' | 'crm-kpis' | 'crm-kanban' | 'crm-lista' | 'crm-wa' | 'crm-plantillas'>('dashboard');

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('emm-theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('emm-theme', theme);
  }, [theme]);

  // Mapeo de activeTab a SubView de CrmModule
  const crmSubViewMap: Record<string, 'dashboard' | 'kanban' | 'lista' | 'whatsapp' | 'plantillas'> = {
    'crm-kpis': 'dashboard',
    'crm-kanban': 'kanban',
    'crm-lista': 'lista',
    'crm-wa': 'whatsapp',
    'crm-plantillas': 'plantillas',
  };
  const isCrmTab = activeTab.startsWith('crm-');
  const isCrmWa = activeTab === 'crm-wa';
  const crmSubView = crmSubViewMap[activeTab] ?? 'dashboard';
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [crmExpanded, setCrmExpanded] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [students, setStudents] = useState<StudentData[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [completenessFilter, setCompletenessFilter] = useState<'all' | 'completos' | 'incompletos'>('all');
  const [licenciaFilter, setLicenciaFilter] = useState('all');
  const [comisionFilter, setComisionFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [importConfig, setImportConfig] = useState<{ isOpen: boolean; mode: 'db' | 'zip' | null }>({ isOpen: false, mode: null });
  const [diplomaModal, setDiplomaModal] = useState<{isOpen: boolean, student: StudentData | null}>({ isOpen: false, student: null });

  // Gestión de usuarios
  const [appUsers, setAppUsers] = useState<any[]>([]);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [newUserNombre, setNewUserNombre] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'superadmin' | 'editor' | 'viewer'>('editor');
  const [newUserPermissions, setNewUserPermissions] = useState<Record<string, string>>({
    'analiticos': 'none'
  });

  // Alta manual de alumno
  const [newStudentModal, setNewStudentModal] = useState(false);
  const [newStuLicencia, setNewStuLicencia] = useState<'CB' | 'A' | 'PRO' | 'TD1' | 'TD2' | 'ACTUALIZACION'>('CB');
  const [newStuNombre, setNewStuNombre] = useState('');
  const [newStuApellido, setNewStuApellido] = useState('');
  const [newStuDni, setNewStuDni] = useState('');
  const [newStuNacionalidad, setNewStuNacionalidad] = useState('ARGENTINA');
  const [newStuFechaEmision, setNewStuFechaEmision] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newStuFechaFin, setNewStuFechaFin] = useState<string>('');

  // Modal de confirmación personalizado
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; title: string; message: string; onConfirm: (val: string) => void; type?: 'danger' | 'warning' | 'info'; withInput?: boolean; inputLabel?: string; inputPlaceholder?: string }>({ open: false, title: '', message: '', onConfirm: () => { } });
  const [confirmInput, setConfirmInput] = useState('');

  const isSuperadmin = user?.role === 'superadmin';
  const hasAnaliticosAccess = !!(user && (isSuperadmin || ((user.permissions?.['analiticos'] || 'none') !== 'none')));
  const canEditAnaliticos = !!(user && (isSuperadmin || user.permissions?.['analiticos'] === 'editor'));
  const canManageUsers = !!isSuperadmin;
  const hasCrmAccess = !!(user && (isSuperadmin || ((user.permissions?.['crm'] || 'none') !== 'none')));
  const canAssignSuperadmin = !!(editingUser?.role === 'superadmin' || newUserEmail.trim().toLowerCase() === 'admin@maradonamenotti.com.ar');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);
  const [legajoDirty, setLegajoDirty] = useState(false);
  const [editingDatos, setEditingDatos] = useState(false);
  const [editDni, setEditDni] = useState('');
  const [editNombre, setEditNombre] = useState('');
  const [editApellido, setEditApellido] = useState('');
  const [editNacionalidad, setEditNacionalidad] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [showAddNota, setShowAddNota] = useState(false);
  const [newMateria, setNewMateria] = useState('');
  const [newNota, setNewNota] = useState('');

  const getAnaliticoErrors = (student: StudentData | null): string[] => {
    if (!student) return ['No hay datos del alumno'];
    if ((student.licencia || '').toUpperCase() === 'ACTUALIZACION') return [];
    
    const required = getSubjectsByLicencia(student.licencia || '');
    if (required.length === 0) return ['No se reconoce el plan de estudios para esta licencia.'];

    const normalize = (s: string) => s.toUpperCase().replace(/,/g, '').replace(/\s+/g, ' ').trim();
    const errors: string[] = [];

    required.forEach(sub => {
      const normSub = normalize(sub);
      const grade = student.notas?.find(n => normalize(n.materia) === normSub);
      if (!grade) {
        errors.push(`Falta: ${sub}`);
      } else if (grade.nota < 6) {
        errors.push(`Insuficiente: ${sub} (Nota ${grade.nota})`);
      }
    });

    return errors;
  };

  const isAnaliticoCompleto = (student: StudentData | null) => {
    return getAnaliticoErrors(student).length === 0;
  };

  const getNotasPendientesParaExport = (student: StudentData | null) => {
    if (!student) {
      return {
        faltantes: ['No hay datos del alumno'],
        desaprobadas: [] as string[],
        detalleMail: 'No hay datos del alumno.'
      };
    }

    if ((student.licencia || '').toUpperCase() === 'ACTUALIZACION') {
      return {
        faltantes: [] as string[],
        desaprobadas: [] as string[],
        detalleMail: ''
      };
    }

    const required = getSubjectsByLicencia(student.licencia || '');
    if (required.length === 0) {
      return {
        faltantes: ['Plan de estudios no reconocido'],
        desaprobadas: [] as string[],
        detalleMail: 'No se reconoce el plan de estudios para esta licencia.'
      };
    }

    const normalize = (s: string) => s.toUpperCase().replace(/,/g, '').replace(/\s+/g, ' ').trim();
    const faltantes: string[] = [];
    const desaprobadas: string[] = [];

    required.forEach(sub => {
      const normSub = normalize(sub);
      const grade = student.notas?.find(n => normalize(n.materia) === normSub);
      if (!grade || grade.nota === 0) {
        faltantes.push(sub);
      } else if (grade.nota < 6) {
        desaprobadas.push(`${sub} (${grade.nota})`);
      }
    });

    const partes: string[] = [];
    if (faltantes.length > 0) partes.push(`Te faltan cargar: ${faltantes.join(', ')}.`);
    if (desaprobadas.length > 0) partes.push(`Tenés desaprobadas: ${desaprobadas.join(', ')}.`);

    return {
      faltantes,
      desaprobadas,
      detalleMail: partes.join(' ')
    };
  };

  const getMailContent = (student: StudentData | null) => {
    const pendientes = getNotasPendientesParaExport(student);
    const nombre = [student?.nombre, student?.apellido].filter(Boolean).join(' ').trim() || 'Alumno/a';
    const asunto = 'Regularizacion de notas pendientes';

    if (!pendientes.detalleMail) {
      return {
        asunto,
        cuerpo: `Hola ${nombre},\n\nTu analitico no registra pendientes de notas en este momento.\n\nSaludos.`
      };
    }

    return {
      asunto,
      cuerpo: `Hola ${nombre},\n\nDetectamos pendientes en tu analitico.\n\n${pendientes.detalleMail}\n\nPor favor, regularizalo a la brevedad.\n\nSaludos.`
    };
  };

  const copyMailContent = async (student: StudentData | null) => {
    try {
      const { asunto, cuerpo } = getMailContent(student);
      await navigator.clipboard.writeText(`Asunto: ${asunto}\n\n${cuerpo}`);
      toast.success('Texto de mail copiado');
    } catch {
      toast.error('No se pudo copiar el texto del mail');
    }
  };

  const openMailClient = (student: StudentData | null) => {
    if (!student?.email) {
      toast.error('El alumno no tiene email cargado');
      return;
    }

    const { asunto, cuerpo } = getMailContent(student);
    window.location.href = `mailto:${student.email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
  };

  const getLegajoPendings = (student: StudentData | null) => {
    if (!student) return ['No hay alumno seleccionado'];

    const pending: string[] = [];
    const pagosOk = student.estado_analitico === 'emitido' || !!student.pagos_ok;
    const documentacionOk = student.estado_analitico === 'emitido' || !!student.documentacion_ok;
    if (!pagosOk) pending.push('Falta validar pagos');
    if (!documentacionOk) pending.push('Falta validar documentacion');
    if (!student.fecha_fin_cursada) pending.push('Falta cargar fecha de fin de cursada');
    if (!isAnaliticoCompleto(student)) pending.push('Faltan notas o hay materias con nota menor a 6');
    return pending;
  };

  const isReadyToEmitAnalitico = (student: StudentData | null) => getLegajoPendings(student).length === 0;

  // Mapa de notas pendientes de guardar (materia -> valor editado)
  const [pendingNotas, setPendingNotas] = useState<Record<string, string>>({});
  const [savingNota, setSavingNota] = useState<string | null>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeStudentModal();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/api/health`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'ok') setBackendStatus('ok');
        else setBackendStatus('error');
      })
      .catch(() => setBackendStatus('error'));

    // Restaurar sesión si existe
    const saved = localStorage.getItem('mm-user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setUser(parsed);
        
        const isParsedSuperadmin = parsed.role === 'superadmin';
        const hasAnaliticos = isParsedSuperadmin || (parsed.permissions && parsed.permissions['analiticos'] && parsed.permissions['analiticos'] !== 'none');

        if (!isParsedSuperadmin && hasAnaliticos) {
          setActiveTab('alumnos');
        } else if (isParsedSuperadmin) {
          setActiveTab('dashboard');
        }
        fetchStudents();
      } catch (err) {
        console.error('Error al restaurar sesión:', err);
        localStorage.removeItem('mm-user');
      }
    }
  }, []);


  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, licenciaFilter, comisionFilter]);

  // Actualizar detalle mientras el modal esté abierto (incluye cambios de otros usuarios)
  useEffect(() => {
    if (!selectedStudent?.id) return;
    const id = selectedStudent.id;
    loadStudentDetail(id);
    const interval = setInterval(() => loadStudentDetail(id), 5000);
    return () => clearInterval(interval);
  }, [selectedStudent?.id, legajoDirty]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Credenciales inválidas');
        return;
      }
      const userData: UserProfile = { 
        id: data.id, 
        email: data.email, 
        documento: data.documento,
        role: data.role, 
        name: data.nombre,
        licencia: data.licencia,
        permissions: data.permissions || {}
      };
      setUser(userData);
      localStorage.setItem('mm-user', JSON.stringify(userData));
      
      const isDataSuperadmin = data.role === 'superadmin';
      const hasAnaliticos = isDataSuperadmin || (data.permissions && data.permissions['analiticos'] && data.permissions['analiticos'] !== 'none');

      if (!isDataSuperadmin && hasAnaliticos) {
        setActiveTab('alumnos');
      } else {
        setActiveTab('dashboard');
      }
      setError('');
    } catch (err) {
      setError('Error de conexión con el servidor');
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await fetch(`${API_URL}/api/students`);
      const data = await res.json();
      if (data.data) {
        setStudents(data.data.map((s: any) => ({
          ...s,
          fecha: new Date().toLocaleDateString('es-AR')
        })));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadStudentDetail = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/students/${id}`);
      const data = await res.json();
      if (data && data.data) {
        setSelectedStudent(prev => {
          if (legajoDirty && prev && prev.id === data.data.id && data.data.estado_analitico !== 'emitido') {
            return {
              ...data.data,
              pagos_ok: prev.pagos_ok,
              documentacion_ok: prev.documentacion_ok
            };
          }
          return data.data;
        });
      }
    } catch (err) {
      console.warn('No se pudo cargar el detalle del alumno');
    }
  };

  const fetchStudentDetail = async (id: string) => {
    const res = await fetch(`${API_URL}/api/students/${id}`);
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.data) {
      throw new Error(data?.error || 'No se pudo cargar el detalle del alumno');
    }
    return data.data as StudentData;
  };

  const openDiplomaModal = async (student: StudentData) => {
    if (!student?.id) return;
    try {
      const freshStudent = await fetchStudentDetail(student.id);
      setDiplomaModal({ isOpen: true, student: freshStudent });
    } catch (err: any) {
      toast.error(err.message || 'No se pudo cargar el alumno para generar el diploma');
    }
  };

  const getUserQuery = () => `user=${encodeURIComponent(user?.email || user?.documento || 'Sistema')}&nombre=${encodeURIComponent(user?.name || '')}`;

  const fetchAppUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/users`);
      const data = await res.json();
      setAppUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('No se pudieron cargar los usuarios');
    }
  };

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserNombre || (!editingUser && !newUserPassword)) {
      toast.error('Completar todos los campos');
      return;
    }

    if (newUserRole === 'superadmin' && newUserEmail.trim().toLowerCase() !== 'admin@maradonamenotti.com.ar') {
      toast.error('El unico superadmin permitido es admin@maradonamenotti.com.ar');
      return;
    }

    const payload: any = { 
      email: newUserEmail, 
      nombre: newUserNombre, 
      role: newUserRole,
      permissions: newUserPermissions
    };
    if (newUserPassword) payload.password = newUserPassword;

    const url = editingUser ? `${API_URL}/api/users/${editingUser.id}` : `${API_URL}/api/users`;
    const method = editingUser ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) { 
      toast.error(data.error || 'Error al procesar solicitud');
      return; 
    }
    
    toast.success(editingUser ? 'Usuario actualizado' : 'Usuario creado');
    setEditingUser(null);
    setNewUserEmail('');
    setNewUserNombre('');
    setNewUserPassword('');
    setNewUserRole('editor');
    setNewUserPermissions({ 'analiticos': 'none' });
    await fetchAppUsers();
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('\u00bfEliminar este usuario?')) return;
    await fetch(`${API_URL}/api/users/${id}`, { method: 'DELETE' });
    await fetchAppUsers();
  };

  const closeStudentModal = () => {
    setLegajoDirty(false);
    setSelectedStudent(null);
    setEditingDatos(false);
    setShowAddNota(false);
    setEditDni('');
    setEditNombre('');
    setEditApellido('');
    setEditNacionalidad('');
    setEditEmail('');
    setPendingNotas({});
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('mm-user');
    setEmail('');
    setPassword('');
    setStudents([]);
    closeStudentModal();
    setAppUsers([]);
    setActiveTab('dashboard');
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.role === 'viewer') { toast.error('Solo lectura: no puedes crear alumnos.'); return; }
    if (!newStuNombre || !newStuApellido || !newStuDni) { toast.error('Completa nombre, apellido y documento'); return; }
    setIsUploading(true);
    try {
      const payload = {
        nombre: newStuNombre,
        apellido: newStuApellido,
        documento: newStuDni,
        nacionalidad: newStuNacionalidad,
        licencia: newStuLicencia,
        fecha_emision: newStuFechaEmision,
        fecha_fin_cursada: newStuLicencia === 'ACTUALIZACION' ? undefined : newStuFechaFin
      };
      const res = await fetch(`${API_URL}/api/students?${getUserQuery()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error creando alumno');
      toast.success('Alumno creado correctamente');
      setNewStudentModal(false);
      setNewStuNombre('');
      setNewStuApellido('');
      setNewStuDni('');
      setNewStuNacionalidad('ARGENTINA');
      setNewStuFechaFin('');
      setNewStuFechaEmision(new Date().toISOString().split('T')[0]);
      await fetchStudents();
    } catch (err: any) {
      toast.error(err.message || 'Error creando alumno');
    } finally {
      setIsUploading(false);
    }
  };

  const handleModalSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get('excelFile') as File;
    if (!file || file.size === 0) { toast.error('Selecciona un archivo excel'); return; }

    setIsUploading(true);

    const submitData = new FormData();
    submitData.append(importConfig.mode === 'db' ? 'file' : 'excelFile', file);
    submitData.append('licencia', form.get('licencia') as string);
    submitData.append('fecha_fin_cursada', form.get('fecha_fin_cursada') as string);
    submitData.append('fecha_emision', form.get('fecha_emision') as string);

    try {
      if (importConfig.mode === 'db') {
        const res = await fetch(`${API_URL}/api/process-excel?${getUserQuery()}`, { method: 'POST', body: submitData });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Error al importar en servidor');
        }
        const result = await res.json();
        toast.success(`Se vincularon notas a ${result.data.matchCount} alumnos. ${result.data.noMatchCount} IDs sin registro.`);
        await fetchStudents();
      } else {
        const res = await fetch(`${API_URL}/api/generate-certificates`, { method: 'POST', body: submitData });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Error en generación de PDFs masiva');
        }
        const data = await res.json();
        if (data.success && data.downloadUrl) {
          window.location.href = `${API_URL}${data.downloadUrl}`;
          setTimeout(() => toast.success('Certificados generados. La descarga comenzará enseguida.'), 500);
        } else throw new Error('No se recibió la URL de descarga.');
      }
      setImportConfig({ isOpen: false, mode: null });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error de conexión al procesar');
    } finally {
      setIsUploading(false);
    }
  };

  const handleQuinttosUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_URL}/api/quinttos?${getUserQuery()}`, {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();

      if (result.success) {
        toast.success(result.message);
        await fetchStudents();
      } else {
        toast.error(result.error || 'Error al procesar padrón QUINTTOS');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión con el servidor');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id?: string) => {
    if (!id) return;
    setConfirmModal({
      open: true,
      title: 'Eliminar Alumno',
      message: '¿Estás seguro de que deseas eliminar este registro? Esta acción no se puede deshacer.',
      type: 'danger',
      onConfirm: async (_val: string) => {
        try {
          await fetch(`${API_URL}/api/students/${id}?${getUserQuery()}`, { method: 'DELETE' });
          setStudents(prev => prev.filter(s => s.id !== id));
          if (selectedStudent?.id === id) closeStudentModal();
        } catch (err) {
          toast.error('Error al eliminar');
        }
        setConfirmModal(prev => ({ ...prev, open: false }));
      }
    });
  };

  const handleDeleteNotas = async (id?: string) => {
    if (!id) return;
    setConfirmModal({
      open: true,
      title: 'Eliminar Notas',
      message: '¿Estás seguro de que deseas eliminar las notas de este alumno? Volverá a borrador.',
      type: 'warning',
      onConfirm: async (_val: string) => {
        try {
          await fetch(`${API_URL}/api/students/${id}/notas?${getUserQuery()}`, { method: 'DELETE' });
          await fetchStudents();
          if (selectedStudent?.id === id) {
            setSelectedStudent(prev => prev ? ({ ...prev, notas: [], estado_analitico: 'borrador', promedio: 0 }) : null);
          }
          toast.success('Notas eliminadas correctamente.');
        } catch (err) {
          toast.error('Error al eliminar notas');
        }
        setConfirmModal(prev => ({ ...prev, open: false }));
      }
    });
  };

  const toggleSelectStudent = (id: string) => {
    setSelectedStudents(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const currentIds = filteredStudents
      .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
      .map(s => s.id)
      .filter((id): id is string => !!id);
    
    if (currentIds.every(id => selectedStudents.includes(id))) {
      setSelectedStudents(prev => prev.filter(id => !currentIds.includes(id)));
    } else {
      setSelectedStudents(prev => [...new Set([...prev, ...currentIds])]);
    }
  };

  const handleGenerateDiploma = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!diplomaModal.student) return;
    if (user?.role === 'viewer') { toast.error('Solo lectura: no puedes emitir diplomas.'); return; }
    const isAct = (diplomaModal.student.licencia || '').toUpperCase() === 'ACTUALIZACION';
    if (!isAct && !isAnaliticoCompleto(diplomaModal.student)) { toast.error('Analítico incompleto: faltan notas obligatorias.'); return; }

    const formData = new FormData(e.currentTarget);
    const nacionalidad = String(diplomaModal.student.nacionalidad || '').trim();
    if (!nacionalidad) {
      toast.error('No se puede emitir el diploma sin nacionalidad cargada.');
      return;
    }
    const data = {
      fecha_emision: formData.get('fecha_emision'),
      nombre: diplomaModal.student.nombre,
      apellido: diplomaModal.student.apellido
    };

    try {
      setIsUploading(true);
      const res = await fetch(`${API_URL}/api/students/${diplomaModal.student.id}/diploma`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || errData?.error || 'Error al generar diploma');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);

      setDiplomaModal({ isOpen: false, student: null });
      fetchStudents();
    } catch (err) {
      console.error(err);
      alert('Error generando el diploma');
    } finally {
      setIsUploading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedStudents.length === 0) return;
    setConfirmModal({
      open: true,
      title: 'Eliminar Seleccionados',
      message: `¿Estás seguro de que deseas eliminar los ${selectedStudents.length} alumnos seleccionados? Esta acción es permanente.`,
      type: 'danger',
      onConfirm: async () => {
        setIsUploading(true);
        try {
          const res = await fetch(`${API_URL}/api/students/bulk?${getUserQuery()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: selectedStudents })
          });
          const data = await res.json();
          if (res.ok) {
            toast.success(data.message || 'Alumnos eliminados correctamente.');
            setSelectedStudents([]);
            fetchStudents();
          } else {
            toast.error(data.error || 'Error al eliminar alumnos.');
          }
        } catch (err) {
          toast.error('Error de conexión.');
        } finally {
          setIsUploading(false);
          setConfirmModal(prev => ({ ...prev, open: false }));
        }
      }
    });
  };

  const handleResetDatabase = async () => {
    setConfirmInput('');
    setConfirmModal({
      open: true,
      title: 'Reiniciar Base de Datos',
      message: '¡ATENCIÓN! Esta acción eliminará a TODOS los alumnos, sus notas y su historial permanentemente. Para confirmar, escribí "BORRAR TODO" en el campo de abajo:',
      type: 'danger',
      withInput: true,
      inputLabel: 'Confirmación',
      inputPlaceholder: 'BORRAR TODO',
      onConfirm: async (val: string) => {
        if (val.trim() !== 'BORRAR TODO') {
          toast.error('La palabra de confirmación no coincide.');
          return;
        }
        setIsUploading(true);
        try {
          const res = await fetch(`${API_URL}/api/database/reset?${getUserQuery()}`, { method: 'DELETE' });
          const data = await res.json();
          if (res.ok) {
            toast.success(data.message || 'Base de datos reiniciada.');
            fetchStudents();
            closeStudentModal();
          } else {
            toast.error(data.error || 'Error al reiniciar');
          }
        } catch (err) {
          toast.error('Error de conexión');
        } finally {
          setIsUploading(false);
          setConfirmModal(prev => ({ ...prev, open: false }));
        }
      }
    });
  };


  const handleToggleEstado = async (id?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!id) return;
    const nuevoEstado = selectedStudent?.estado_analitico === 'emitido' ? 'borrador' : 'emitido';

    // VALIDACION: Solo si pasa a emitido
    if (nuevoEstado === 'emitido' && selectedStudent) {
      if (!isAnaliticoCompleto(selectedStudent)) {
        toast.error('⚠️ Analítico Incompleto: Faltan materias obligatorias.');
      }
    }

    if (nuevoEstado === 'emitido' && selectedStudent && !isReadyToEmitAnalitico(selectedStudent)) {
      toast.error('El alumno no cumple los requisitos del legajo para emitir el analitico.');
      return;
    }

    const executeToggle = async (motivoAdicional = '') => {
      try {
        const res = await fetch(`${API_URL}/api/students/${id}/estado?${getUserQuery()}`, {
          method: 'PUT',
          body: JSON.stringify({ estado: nuevoEstado, motivo: motivoAdicional }),
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        await fetchStudents();
        if (selectedStudent?.id === id) {
          setSelectedStudent(prev => prev ? ({
            ...prev,
            estado_analitico: data.estado,
            pagos_ok: data.estado === 'emitido' ? true : prev.pagos_ok,
            documentacion_ok: data.estado === 'emitido' ? true : prev.documentacion_ok
          }) : null);
          loadStudentDetail(id);
        }
        toast.success(nuevoEstado === 'emitido' ? '¡Analítico Emitido!' : 'Revertido a Borrador');
      } catch (err: any) {
        toast.error(err.message || 'Error al cambiar estado');
      }
    };

    if (nuevoEstado === 'borrador') {
      setConfirmInput('');
      setConfirmModal({
        open: true,
        title: 'Revertir a Borrador',
        message: 'Ingresá el motivo por el cual se revierte el estado:',
        type: 'warning',
        withInput: true,
        inputLabel: 'Motivo',
        inputPlaceholder: 'Ej: Error en el apellido, nota incorrecta, etc.',
        onConfirm: async (val: string) => {
          await executeToggle(val.trim());
          setConfirmModal(prev => ({ ...prev, open: false }));
        }
      });
      return;
    }

    // Si es a 'emitido', ejecutar directo
    await executeToggle();
  };

  const handleSaveFechas = async () => {
    if (!selectedStudent || !selectedStudent.id) return;
    try {
      const res = await fetch(`${API_URL}/api/students/${selectedStudent.id}/dates?${getUserQuery()}`, {
        method: 'PUT',
        body: JSON.stringify({ fecha_emision: selectedStudent.fecha_emision, fecha_fin_cursada: selectedStudent.fecha_fin_cursada }),
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        toast.success('Fechas guardadas correctamente');
        fetchStudents();
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar fechas');
    }
  };

  const saveLegajo = async () => {
    if (!selectedStudent?.id) return;
    try {
      const res = await fetch(`${API_URL}/api/students/${selectedStudent.id}/legajo?${getUserQuery()}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pagos_ok: !!selectedStudent.pagos_ok,
          documentacion_ok: !!selectedStudent.documentacion_ok
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error actualizando legajo');
      toast.success('Legajo actualizado');
      setLegajoDirty(false);
      await fetchStudents();
      loadStudentDetail(selectedStudent.id);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error actualizando legajo');
    }
  };

  const startEditDatos = () => {
    if (!selectedStudent) return;
    setEditDni(selectedStudent.dni || '');
    setEditNombre(selectedStudent.nombre);
    setEditApellido(selectedStudent.apellido || '');
    setEditNacionalidad(selectedStudent.nacionalidad || '');
    setEditEmail(selectedStudent.email || '');
    setEditingDatos(true);
  };

  const saveDatos = async () => {
    if (!selectedStudent?.id) return;
    try {
      const payload = {
        documento: editDni.trim(),
        nombre: editNombre.trim(),
        apellido: editApellido.trim(),
        nacionalidad: editNacionalidad.trim(),
        email: editEmail.trim()
      };
      const res = await fetch(`${API_URL}/api/students/${selectedStudent.id}/datos?${getUserQuery()}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Error al guardar datos personales');
      await fetchStudents();
      await loadStudentDetail(selectedStudent.id);
      setEditingDatos(false);
      toast.success('Datos personales guardados correctamente.');
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar datos personales');
    }
  };


  const saveNotaManual = async () => {
    if (!selectedStudent?.id || !newMateria.trim() || !newNota) return;
    try {
      const res = await fetch(`${API_URL}/api/students/${selectedStudent.id}/nota?${getUserQuery()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asignatura: newMateria.trim(), nota: parseFloat(newNota) })
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Error'); return; }
      await fetchStudents();
      const updated = await fetch(`${API_URL}/api/students`).then(r => r.json());
      const s = updated.data?.find((x: any) => x.id === selectedStudent.id);
      if (s) setSelectedStudent(s);
      setNewMateria('');
      setNewNota('');
      setShowAddNota(false);
    } catch (err) {
      toast.error('Error al guardar la nota');
    }
  };

  // Solo descarga el PDF sin cambiar el estado (Vista Previa)
  const downloadPDF = (student: StudentData) => {
    if (!student.id) { alert("El alumno no tiene ID registrado."); return; }
    if (user?.role === 'viewer') { toast.error('Solo lectura: no puedes generar PDFs.'); return; }
    
    const errors = getAnaliticoErrors(student);
    if (errors.length > 0) {
      toast.error(
        <div>
          <p className="font-bold">Analítico incompleto/insuficiente:</p>
          <ul className="text-xs list-disc pl-4 mt-1">
            {errors.slice(0, 3).map((e, idx) => <li key={idx}>{e}</li>)}
            {errors.length > 3 && <li>Y {errors.length - 3} materias más...</li>}
          </ul>
        </div>
      );
      return; 
    }

    fetch(`${API_URL}/api/students/${student.id}/certificate`)
      .then(res => {
        if (!res.ok) { toast.error('Error generando el analítico'); return; }
        return res.blob();
      })
      .then(blob => {
        if (!blob) return;
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(url), 60000);
      })
      .catch(() => toast.error('Error al descargar el analítico'));
  };

  /* DESACTIVADO TEMPORALMENTE
  const downloadDiploma = (student: StudentData) => {
    if (!student.id) { alert("El alumno no tiene ID registrado."); return; }
    window.open(`${API_URL}/api/students/${student.id}/diploma`, '_blank');
  };
  */

  // Descarga el PDF y marca automáticamente como Emitido
  const downloadPDFAndEmit = async (student: StudentData) => {
    if (!student.id) { alert("El alumno no tiene ID registrado."); return; }
    if (user?.role === 'viewer') { toast.error('Solo lectura: no puedes emitir.'); return; }
    if (!isAnaliticoCompleto(student)) {
      toast.error('Analítico incompleto: faltan notas obligatorias.');
      return;
    }

    // 1. Descargar Analítico
    // 1. Validar si se puede emitir
    const errors = getAnaliticoErrors(student);
    if (errors.length > 0) {
      toast.error(
        <div>
          <p className="font-bold">No se puede emitir:</p>
          <ul className="text-xs list-disc pl-4 mt-1">
            {errors.slice(0, 3).map((e, idx) => <li key={idx}>{e}</li>)}
            {errors.length > 3 && <li>Y {errors.length - 3} materias más...</li>}
          </ul>
        </div>
      );
      return; 
    }

    // Generar PDF
    downloadPDF(student);
    try {
      const res = await fetch(
        `${API_URL}/api/students/${student.id}/estado?${getUserQuery()}`,
        { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: 'emitido', motivo: 'Generado desde el sistema' }) }
      );
      const data = await res.json();
      await fetchStudents();
      setSelectedStudent(prev => prev ? ({
        ...prev,
        estado_analitico: data.estado,
        pagos_ok: true,
        documentacion_ok: true
      }) : null);
      if (student.id) loadStudentDetail(student.id);
    } catch (err) { console.error('No se pudo marcar como Emitido:', err); }
  };

  const exportToExcel = () => {
    const dataToExport = filteredStudents.map(student => {
      const pendientes = getNotasPendientesParaExport(student);
      return {
      EstadoNotas: (!student.notas || student.notas.length === 0)
        ? 'Esperando Notas'
        : (isAnaliticoCompleto(student) ? 'Completo' : 'Faltan Notas'),
      'Materias Faltantes': pendientes.faltantes.join(' | '),
      'Materias Desaprobadas': pendientes.desaprobadas.join(' | '),
      'Detalle Para Mail': pendientes.detalleMail,
      ID: student.dni,
      Nombre: student.nombre,
      Apellido: student.apellido || '',
      Email: student.email || '',
      'Licencia/Carrera': student.licencia || '',
      Comision: student.comision || '',
      'Situacion Academica': student.situacion || '',
      'Estado Analitico': student.estado_analitico === 'emitido' ? 'Emitido' : 'Borrador',
      Promedio: student.notas && student.notas.length > 0 ? student.promedio.toFixed(2) : 'Sin notas',
      'Materias Aprobadas': student.notas?.length || 0,
      'Fecha Emision': student.fecha_emision || '',
      'Fecha Fin Cursada': student.fecha_fin_cursada || '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Alumnos");
    XLSX.writeFile(workbook, "Listado_Alumnos.xlsx");
  };

  const uniqueStatuses = Array.from(new Set(students.map(s => s.situacion).filter(Boolean)));
  const uniqueLicencias = Array.from(new Set(students.map(s => s.licencia).filter(Boolean)));
  const uniqueComisiones = Array.from(new Set(students.map(s => s.comision).filter(Boolean)));

  const formatLicencia = (lic?: string) => {
    if (!lic) return 'S/LI';
    const upper = lic.toUpperCase();
    if (upper.includes('TRAYECTORIA DESTACADA') && upper.includes('1')) return 'TD 1';
    if (upper.includes('TRAYECTORIA DESTACADA') && upper.includes('2')) return 'TD 2';
    return lic;
  };



  const formatUserDisplay = (email?: string, nombre?: string) => {
    if (nombre && nombre.trim()) return nombre;
    if (!email) return 'Sin usuario';
    if (email.includes('@')) return email.split('@')[0];
    return email;
  };

  const filteredStudents = students.filter(s => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      s.nombre.toLowerCase().includes(term) ||
      (s.apellido || '').toLowerCase().includes(term) ||
      s.dni.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || s.situacion === statusFilter;
    const matchesLicencia = licenciaFilter === 'all' || (s.licencia || '').toUpperCase() === licenciaFilter.toUpperCase();
    const matchesComision = comisionFilter === 'all' || (s.comision || '').toUpperCase() === comisionFilter.toUpperCase();
    const completo = isAnaliticoCompleto(s);
    const matchesCompleteness =
      completenessFilter === 'all' ||
      (completenessFilter === 'completos' && completo) ||
      (completenessFilter === 'incompletos' && !completo);
    return matchesSearch && matchesStatus && matchesLicencia && matchesComision && matchesCompleteness;
  });

  if (!user) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 20%, rgba(15, 90, 92, 0.28), transparent 26%),
            radial-gradient(circle at 80% 10%, rgba(12, 64, 78, 0.38), transparent 22%),
            radial-gradient(110% 120% at 50% 0%, rgba(4, 18, 24, 0.9), rgba(4, 12, 18, 0.95)),
            linear-gradient(135deg, #031219 0%, #071f2a 60%, #031017 100%)`,
          backgroundColor: '#041218'
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-xl bg-[#041218cc] backdrop-blur-xl border border-white/5 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)] rounded-[28px] overflow-hidden"
        >
          <div className="flex flex-col items-center gap-3 px-10 pt-10 pb-6 text-center">
            <img src={logo} alt="Escuela Maradona Menotti" className="h-24 w-auto object-contain drop-shadow-[0_16px_34px_rgba(0,45,43,0.45)]" />
            <div className="px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-white bg-[#00968f]/70 border border-[#0ffff4]/50 rounded-full shadow-sm drop-shadow">
              Acceso seguro
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 px-10 pb-10 text-white">
            <div className="space-y-1">
              <label className="block text-sm font-semibold text-white/90">Usuario / Documento</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[#0ffff4]/20 bg-white/88 text-slate-800 placeholder:text-slate-500 focus:ring-2 focus:ring-[#00968f] focus:border-transparent outline-none transition-all shadow-[0_10px_35px_-30px_rgba(0,0,0,0.35)]"
                placeholder="DNI o email institucional"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-semibold text-white/90">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[#0ffff4]/20 bg-white/88 text-slate-800 placeholder:text-slate-500 focus:ring-2 focus:ring-[#00968f] focus:border-transparent outline-none transition-all shadow-[0_10px_35px_-30px_rgba(0,0,0,0.35)]"
                  placeholder="Ingresa tu contraseña"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute inset-y-0 right-3 my-1 px-3 text-xs font-bold text-[#002d2b] bg-[#0ffff4]/30 hover:bg-[#0ffff4]/50 rounded-lg transition-colors"
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>
            {error && <p className="text-red-500 text-xs mt-1 font-semibold">{error}</p>}
            <button
              type="submit"
              disabled={backendStatus === 'checking'}
              className="w-full bg-gradient-to-r from-[#0ffff4] to-[#00968f] disabled:from-slate-400 disabled:to-slate-500 text-[#002d2b] font-extrabold py-3.5 rounded-xl transition-all shadow-[0_16px_50px_-22px_rgba(0,255,244,0.35)] hover:-translate-y-0.5 active:scale-[0.98]"
            >
              {backendStatus === 'checking' ? 'Iniciando...' : 'Ingresar al Sistema'}
            </button>
          </form>

          <div className="px-10 pb-10">
            <div className="rounded-2xl bg-[#0ffff4]/12 border border-[#0ffff4]/30 px-4 py-3 text-center">
              <p className="text-xs text-white/90 font-medium">Acceso restringido a personal autorizado y alumnos matriculados.</p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  const renderDashboard = () => {
    const totalAlumnos = students.length;
    const conAnalitico = students.filter(s => s.notas && s.notas.length > 0).length;
    const sinAnalitico = totalAlumnos - conAnalitico;

    // Agrupar por Carrera
    const porCarrera = students.reduce((acc, curr) => {
      const c = curr.licencia || 'Sin Carrera Especificada';
      acc[c] = (acc[c] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Emitidos por licencia
    const emitidosPorLicencia = students
      .filter(s => s.estado_analitico === 'emitido')
      .reduce((acc, curr) => {
        const c = curr.licencia || 'Sin licencia';
        acc[c] = (acc[c] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    // Analíticos completos por licencia
    const completosPorLicencia = students
      .filter(s => isAnaliticoCompleto(s))
      .reduce((acc, curr) => {
        const c = curr.licencia || 'Sin licencia';
        acc[c] = (acc[c] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    // Últimos 5 días emitidos
    const today = new Date();
    const recentEmitidos = students
      .filter(s => s.estado_analitico === 'emitido' && s.fecha_emision)
      .filter(s => {
        const f = new Date(s.fecha_emision as string);
        const diff = (today.getTime() - f.getTime()) / (1000 * 60 * 60 * 24);
        return diff <= 5;
      })
      .sort((a, b) => new Date(b.fecha_emision || '').getTime() - new Date(a.fecha_emision || '').getTime());

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h2 className="text-3xl font-bold text-slate-900 drop-shadow-sm">Dashboard General</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="kpi-card-total p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-slate-500 text-sm font-medium mb-3 uppercase tracking-wider">Total Alumnos</h3>
            <p className="text-4xl font-extrabold value-text">{totalAlumnos}</p>
          </div>
          <div className="kpi-card-completo p-6 rounded-2xl border border-emerald-200 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="lbl-text text-sm font-medium mb-3 uppercase tracking-wider">Con Analítico</h3>
            <p className="text-4xl font-extrabold value-text">{conAnalitico}</p>
          </div>
          <div className="kpi-card-espera p-6 rounded-2xl border border-amber-200 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="lbl-text text-sm font-medium mb-3 uppercase tracking-wider">Esperando Notas</h3>
            <p className="text-4xl font-extrabold value-text">{sinAnalitico}</p>
          </div>
        </div>

        {/* Vista colapsada manual eliminada para favorecer navegación por sidebar */}


        <div className="pt-6 border-t border-slate-200">
          <h3 className="text-xl font-bold text-slate-800 mb-6 drop-shadow-sm">Distribucion por Licencia / Carrera</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Object.entries(porCarrera).map(([carr, count]) => (
              <div key={carr} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:bg-slate-50 transition-colors">
                <span className="font-semibold text-slate-700 line-clamp-1" title={carr}>{carr}</span>
                <span className="distribution-badge px-4 py-1.5 rounded-full text-sm font-black shadow-inner border">{count}</span>
              </div>
            ))}
            {Object.keys(porCarrera).length === 0 && (
              <p className="text-slate-500 italic">Cargue el padron QUINTTOS para ver estadisticas.</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Emitidos por Licencia</h3>
            <div className="space-y-3">
              {Object.entries(emitidosPorLicencia).map(([lic, count]) => (
                <div key={lic} className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-100 bg-slate-50/60">
                  <span className="font-semibold text-slate-700">{lic}</span>
                  <span className="distribution-badge text-sm font-black rounded-full px-3 py-1 border">{count}</span>
                </div>
              ))}
              {Object.keys(emitidosPorLicencia).length === 0 && (
                <p className="text-slate-500 text-sm">Aún no hay analíticos emitidos.</p>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Emitidos últimos 5 días</h3>
            <div className="space-y-3">
              {recentEmitidos.slice(0, 8).map((s, idx) => (
                <div key={`${s.id}-${idx}`} className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-100 bg-[#0ffff4]/10">
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{s.nombre}</p>
                    <p className="text-xs text-slate-500">Licencia {s.licencia || 'S/LI'} · ID {s.dni}</p>
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#00968f]">{s.fecha_emision}</span>
                </div>
              ))}
              {recentEmitidos.length === 0 && (
                <p className="text-slate-500 text-sm">Sin emisiones en los últimos 5 días.</p>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Analíticos completos por Licencia</h3>
            <div className="space-y-3">
              {Object.entries(completosPorLicencia).map(([lic, count]) => (
                <div key={lic} className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-100 bg-slate-50/60">
                  <span className="font-semibold text-slate-700">{lic}</span>
                  <span className="text-sm font-black text-[#00968f] bg-[#0ffff4]/15 border border-[#0ffff4]/40 rounded-full px-3 py-1">{count}</span>
                </div>
              ))}
              {Object.keys(completosPorLicencia).length === 0 && (
                <p className="text-slate-500 text-sm">Sin analíticos completos aún.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAlumnos = () => (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Alumnos</h2>
          <p className="text-slate-500 text-sm">Aca se gestionan todos los alumnos de Titulos: los sincronizados desde QUINTTOS y los creados manualmente.</p>
        </div>

        <div className="flex items-center justify-end gap-3 flex-wrap">
          {canEditAnaliticos && (
            <button
              onClick={() => setNewStudentModal(true)}
              disabled={isUploading}
              className={`flex items-center gap-2 px-4 py-3 bg-[#0f766e] hover:bg-[#0b5f59] text-white font-medium rounded-xl transition-all shadow hover:-translate-y-0.5 active:scale-[0.98] ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <User className="w-4 h-4" />
              <span>Nuevo Alumno</span>
            </button>
          )}

          {(isSuperadmin || canEditAnaliticos) && (
            <>
              {isSuperadmin && (
                <>
                  <button
                    onClick={handleResetDatabase}
                    disabled={isUploading}
                    className={`flex items-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-all shadow ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title="Borrar TODOS los alumnos y notas (Reset Total)"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Reiniciar BD</span>
                  </button>
                  {selectedStudents.length > 0 && (
                    <button
                      onClick={handleBulkDelete}
                      disabled={isUploading}
                      className={`flex items-center gap-2 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl transition-all shadow ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title="Eliminar alumnos seleccionados"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Eliminar {selectedStudents.length}</span>
                    </button>
                  )}
                </>
              )}
              <label className={`flex items-center gap-2 px-4 py-3 bg-[#002d2b] hover:bg-[#00968f] text-white font-medium rounded-xl cursor-pointer transition-all shadow hover:-translate-y-0.5 active:scale-[0.98] ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <Upload className="w-4 h-4" />
                <span>Sincronizar QUINTTOS</span>
                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleQuinttosUpload} disabled={isUploading} />
              </label>
              <button onClick={() => setImportConfig({ isOpen: true, mode: 'db' })} disabled={isUploading} className={`flex items-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-all shadow ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <Upload className="w-4 h-4" />
                <span>Importar Notas</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-3 mb-3 items-stretch">
          <div className="relative shadow-sm rounded-xl col-span-1 xl:col-span-2 min-w-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nombre, apellido o ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-14 pl-12 pr-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00968f] outline-none transition-all bg-white font-medium"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="min-w-0 h-14 px-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00968f] outline-none transition-all bg-white font-medium text-slate-700 cursor-pointer shadow-sm"
          >
            <option value="all">Todas las situaciones</option>
            {uniqueStatuses.map(st => (
              <option key={st as string} value={st as string}>{st as string}</option>
            ))}
          </select>
          <select
            value={licenciaFilter}
            onChange={(e) => setLicenciaFilter(e.target.value)}
            className="min-w-0 h-14 px-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00968f] outline-none transition-all bg-white font-medium text-slate-700 cursor-pointer shadow-sm"
          >
            <option value="all">Todas las licencias</option>
            {uniqueLicencias.map(l => (
              <option key={l as string} value={l as string}>{l as string}</option>
            ))}
          </select>
          <select
            value={comisionFilter}
            onChange={(e) => setComisionFilter(e.target.value)}
            className="min-w-0 h-14 px-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00968f] outline-none transition-all bg-white font-medium text-slate-700 cursor-pointer shadow-sm"
          >
            <option value="all">Todas las comisiones</option>
            {uniqueComisiones.map(c => (
              <option key={c as string} value={c as string}>{c as string}</option>
            ))}
          </select>
          <div className="flex gap-2 items-center">
            <select
              value={completenessFilter}
              onChange={(e) => setCompletenessFilter(e.target.value as 'all' | 'completos' | 'incompletos')}
              className="min-w-0 h-14 px-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#00968f] outline-none transition-all bg-white font-medium text-slate-700 cursor-pointer shadow-sm flex-1"
            >
              <option value="all">Completos e incompletos</option>
              <option value="completos">Solo completos</option>
              <option value="incompletos">Solo incompletos</option>
            </select>
            <button
              onClick={exportToExcel}
              className="h-14 px-4 bg-[#002d2b] hover:bg-[#00968f] text-white rounded-xl font-bold transition-all shadow-sm whitespace-nowrap hover:-translate-y-0.5 active:scale-[0.98]"
              title="Exportar listado actual a Excel"
            >
              <FileSpreadsheet className="w-5 h-5 inline-block mr-2 align-middle" />
              <span className="align-middle">Exportar</span>
            </button>
          </div>
        </div>

        {/* LIST VIEW INSTED OF GRID */}
        <div className="flex flex-col space-y-3">
          {filteredStudents.length > 0 && (
            <div className="flex items-center gap-4 px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 mb-2">
              <input 
                type="checkbox" 
                className="w-5 h-5 rounded border-slate-300 text-[#002d2b] focus:ring-[#00968f] cursor-pointer"
                checked={filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).every(s => s.id && selectedStudents.includes(s.id))}
                onChange={toggleSelectAll}
              />
              <span className="text-sm font-bold text-slate-600">Seleccionar todos en esta página</span>
            </div>
          )}
          <AnimatePresence mode="popLayout">
            {filteredStudents.length > 0 ? (
              filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((student, idx) => {
                const hasInsufficientNotes = !!student.notas?.some(n => n.nota > 0 && n.nota < 6);
                return (
                <motion.div
                  key={student.dni + idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onClick={() => { setLegajoDirty(false); setSelectedStudent(student); if (student.id) loadStudentDetail(student.id); }}
                  className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer group min-h-[110px] ${
                    selectedStudents.includes(student.id || '') 
                      ? 'bg-[#0ffff4]/15 border-[#00968f] shadow-md ring-1 ring-[#00968f]' 
                      : student.situacion === 'DUPLICADO'
                        ? 'bg-rose-50 border-rose-300 hover:border-rose-400 hover:shadow-md'
                        : hasInsufficientNotes
                          ? 'bg-red-50 border-red-200 hover:border-red-300 hover:shadow-md'
                        : 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-[#00968f33]'
                  }`}
                >
                  {/* Left: Checkbox, Icon, Details */}
                  <div className="flex items-center gap-4">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded border-slate-300 text-[#002d2b] focus:ring-[#00968f] cursor-pointer"
                      checked={selectedStudents.includes(student.id || '')}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleSelectStudent(student.id || '')}
                    />
                    <div className={`p-3 rounded-xl hidden sm:flex shrink-0 transition-colors ${
                      selectedStudents.includes(student.id || '')
                        ? 'bg-[#0ffff4]/30 text-slate-900'
                        : student.situacion === 'DUPLICADO' 
                          ? 'bg-rose-100 group-hover:bg-rose-200' 
                          : hasInsufficientNotes
                            ? 'bg-red-100 group-hover:bg-red-200'
                          : 'bg-[#0ffff4]/10 group-hover:bg-[#0ffff4]/20'
                    }`}>
                      <User className={`w-5 h-5 ${student.situacion === 'DUPLICADO' ? 'text-rose-700' : hasInsufficientNotes ? 'text-red-700' : 'text-slate-900'}`} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <h3 className="text-lg font-bold text-slate-900 leading-tight">
                        {student.nombre} {student.apellido && student.apellido !== 'Sin Apellido' && !student.nombre.includes(student.apellido) ? student.apellido : ''} {student.situacion === 'DUPLICADO' && <span className="text-rose-600 text-sm ml-2">(DUPLICADO)</span>}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-slate-600 text-xs font-semibold">
                        <span className="flex items-center gap-1 text-slate-500">ID: {student.dni}</span>
                        <span className="hidden sm:inline text-slate-300">⬢</span>
                        <span className="flex items-center gap-1 text-slate-500">MATRÍCULA: {student.dni}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-slate-600 text-xs font-semibold">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded uppercase tracking-wider border border-slate-200">
                          LICENCIA {formatLicencia(student.licencia)}
                        </span>
                        <span className="text-slate-900 bg-[#0ffff4]/15 px-2 py-0.5 rounded uppercase tracking-wider border border-[#0ffff4]/40">
                          COMISIÓN {student.comision || '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between w-full md:w-auto gap-4 border-t md:border-0 pt-3 md:pt-0 border-slate-100">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${student.estado_analitico === 'emitido' ? 'bg-[#00968f] text-white border-[#00968f]' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      {student.estado_analitico === 'emitido' ? 'Emitido' : 'Borrador'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${isAnaliticoCompleto(student) ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                      {isAnaliticoCompleto(student) ? 'Completo' : 'Incompleto'}
                    </span>
                    {hasInsufficientNotes && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-red-100 text-red-700 border-red-200">
                        Nota menor a 6
                      </span>
                    )}
                    {(!student.notas || student.notas.length === 0) && (
                      <span className="text-amber-700 font-bold text-xs bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-lg shadow-sm whitespace-nowrap">Esperando Notas</span>
                    )}

                    {/* Quick actions row */}
                    <div className="flex items-center gap-1 border-l pl-3 border-slate-100" onClick={(e) => e.stopPropagation()}>
                      {isSuperadmin && (
                        <button
                          onClick={() => handleDelete(student.id as any)}
                          className="p-2 text-red-400 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors"
                          title="Eliminar Alumno"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {student.notas && student.notas.length > 0 && (
                        <button
                          onClick={() => downloadPDF(student)}
                          className="p-2 text-[#00968f] hover:bg-[#0ffff4]/15 hover:text-[#002d2b] rounded-lg transition-colors"
                          title="Descargar Analítico"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                      )}
                      {student.notas && student.notas.length > 0 && (
                        <button
                          onClick={() => openDiplomaModal(student)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800 rounded-lg transition-colors"
                          title="Generar Diploma"
                        >
                          <School className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )})
            ) : (
              <div className="w-full py-24 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200 border-dashed">
                <FileSpreadsheet className="w-16 h-16 text-slate-200 mb-4" />
                <p className="text-slate-500 font-medium">No se encontraron alumnos para mostrar.</p>
              </div>
            )}
          </AnimatePresence>
          {/* Paginator Controls */}
          {filteredStudents.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6 mt-4 border-t border-slate-200 text-sm font-medium text-slate-600 bg-white/50 backdrop-blur-sm rounded-2xl px-6">
              <div className="flex items-center gap-2">
                <span>Mostrar:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-[#00968f] outline-none cursor-pointer"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={500}>500</option>
                </select>
                <span>por página</span>
              </div>

              <div className="flex items-center gap-1.5 bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-bold text-slate-700"
                >
                  Anterior
                </button>
                <div className="distribution-badge px-4 py-2 rounded-lg font-black text-sm border">
                  {currentPage} de {Math.max(1, Math.ceil(filteredStudents.length / itemsPerPage))}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredStudents.length / itemsPerPage), p + 1))}
                  disabled={currentPage >= Math.ceil(filteredStudents.length / itemsPerPage)}
                  className="px-4 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-bold text-slate-700"
                >
                  Siguiente
                </button>
              </div>
              <div className="text-slate-500 whitespace-nowrap font-bold bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">
                Total: {filteredStudents.length} alumnos
              </div>
            </div>
          )}
      </div>
    </div>
  </div>
);

  const renderAnaliticoModals = () => (
    <>

      {/* MODAL PARA DIPLOMA */}
      {diplomaModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 bg-indigo-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                    <School className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800">Generar Diploma</h2>
                </div>
                <button onClick={() => setDiplomaModal({ isOpen: false, student: null })} className="text-slate-400 hover:text-slate-600 transition-colors bg-white p-1 rounded-full border border-slate-100 shadow-sm">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <form onSubmit={handleGenerateDiploma} className="p-6 space-y-5">
              <p className="text-sm text-slate-500">
                Confirmá los datos para el diploma de <span className="font-bold text-slate-800">{diplomaModal.student?.nombre} {diplomaModal.student?.apellido}</span>.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nacionalidad</label>
                  <div className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 text-slate-700 font-medium">
                    {diplomaModal.student?.nacionalidad || 'SIN NACIONALIDAD CARGADA'}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Fecha de Emisión</label>
                  <input 
                    required 
                    type="date" 
                    name="fecha_emision" 
                    defaultValue={new Date().toISOString().split('T')[0]} 
                    className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 ring-indigo-100 outline-none font-medium" 
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setDiplomaModal({ isOpen: false, student: null })} className="flex-1 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
                <button type="submit" disabled={isUploading} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2">
                  {isUploading ? 'Generando...' : <><Download className="w-4 h-4" />Descargar</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <AnimatePresence>
        {selectedStudent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 shadow-2xl"
            onClick={closeStudentModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl"
              onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-6 md:px-8 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                <div className="flex-1">
                  {!editingDatos ? (
                    <>
                      <h2 className="text-2xl font-black text-slate-900">
                        {[selectedStudent.nombre, selectedStudent.apellido].filter(Boolean).join(' ').trim()}
                      </h2>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-slate-500 text-sm font-medium">
                        <span className="bg-white border border-slate-200 px-3 py-1 rounded shadow-sm">ID: {selectedStudent.dni}</span>
                        {selectedStudent.email && (
                          <span className="bg-white border border-slate-200 px-3 py-1 rounded shadow-sm">Email: {selectedStudent.email}</span>
                        )}
                        {canEditAnaliticos && (
                          <button
                            onClick={startEditDatos}
                            className="action-badge text-xs font-bold border px-2 py-0.5 rounded transition-colors"
                          >
                            Editar Datos
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Editando Datos Personales</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">ID</label>
                          <input
                            value={editDni}
                            onChange={e => setEditDni(e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00968f] outline-none"
                            placeholder="Nro. documento"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Nombre</label>
                          <input
                            value={editNombre}
                            onChange={e => setEditNombre(e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00968f] outline-none"
                            placeholder="Nombre(s)"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Apellido</label>
                          <input
                            value={editApellido}
                            onChange={e => setEditApellido(e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00968f] outline-none"
                            placeholder="Apellido"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Nacionalidad</label>
                          <input
                            value={editNacionalidad}
                            onChange={e => setEditNacionalidad(e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00968f] outline-none"
                            placeholder="Ej: Argentina"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={saveDatos} className="bg-[#002d2b] hover:bg-[#00968f] text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-colors">Guardar</button>
                        <button onClick={() => setEditingDatos(false)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-1.5 rounded-lg text-sm font-bold transition-colors">Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={closeStudentModal}
                  className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-full transition-colors shrink-0 ml-4"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar">
                {selectedStudent.estado_analitico === 'emitido' && !isAnaliticoCompleto(selectedStudent) && (
                  <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-800 animate-pulse shadow-sm">
                    <AlertTriangle className="w-6 h-6 shrink-0" />
                    <div>
                      <p className="font-bold text-sm text-amber-900 leading-tight">⚠️ Analítico Generado: Faltan Notas</p>
                      <p className="text-xs text-amber-700 mt-0.5">Marcado como emitido pero con materias obligatorias pendientes.</p>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-8">
                  <div className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Legajo del Alumno</p>
                        <h3 className="text-lg font-bold text-slate-900 mt-1">Estado para emitir analitico</h3>
                        <p className="text-sm text-slate-500 mt-1">Pagos y documentacion se validan manualmente. Fecha de fin de cursada y notas se controlan automaticamente.</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${isReadyToEmitAnalitico(selectedStudent) ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                        {isReadyToEmitAnalitico(selectedStudent) ? 'Listo para emitir' : 'Pendiente'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
                      <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div>
                          <p className="text-sm font-bold text-slate-800">Pagos OK</p>
                          <p className="text-xs text-slate-500">Validacion manual desde Titulos</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={selectedStudent.estado_analitico === 'emitido' || !!selectedStudent.pagos_ok}
                          onChange={(e) => {
                            setLegajoDirty(true);
                            setSelectedStudent(prev => prev ? ({ ...prev, pagos_ok: e.target.checked }) : prev);
                          }}
                          disabled={!canEditAnaliticos || selectedStudent.estado_analitico === 'emitido'}
                          className="h-5 w-5 accent-[#00968f]"
                        />
                      </label>

                      <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div>
                          <p className="text-sm font-bold text-slate-800">Documentacion OK</p>
                          <p className="text-xs text-slate-500">Validacion manual desde Titulos</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={selectedStudent.estado_analitico === 'emitido' || !!selectedStudent.documentacion_ok}
                          onChange={(e) => {
                            setLegajoDirty(true);
                            setSelectedStudent(prev => prev ? ({ ...prev, documentacion_ok: e.target.checked }) : prev);
                          }}
                          disabled={!canEditAnaliticos || selectedStudent.estado_analitico === 'emitido'}
                          className="h-5 w-5 accent-[#00968f]"
                        />
                      </label>

                      <div className={`rounded-xl border px-4 py-3 ${selectedStudent.fecha_fin_cursada ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                        <p className="text-sm font-bold text-slate-800">Fin de cursada</p>
                        <p className={`text-xs mt-1 font-bold ${selectedStudent.fecha_fin_cursada ? 'text-emerald-700' : 'text-amber-800'}`}>
                          {selectedStudent.fecha_fin_cursada ? `Fecha cargada: ${selectedStudent.fecha_fin_cursada}` : 'Pendiente de carga'}
                        </p>
                      </div>

                      <div className={`rounded-xl border px-4 py-3 ${isAnaliticoCompleto(selectedStudent) ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                        <p className="text-sm font-bold text-slate-800">Notas analitico</p>
                        <p className={`text-xs mt-1 font-bold ${isAnaliticoCompleto(selectedStudent) ? 'text-emerald-700' : 'text-amber-800'}`}>
                          {isAnaliticoCompleto(selectedStudent) ? 'OK' : 'Pendiente o incompleto'}
                        </p>
                      </div>
                    </div>

                    {!isReadyToEmitAnalitico(selectedStudent) && (
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <p className="text-xs font-black uppercase tracking-widest text-amber-700">Pendientes detectados</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {getLegajoPendings(selectedStudent).map((pending) => (
                            <span key={pending} className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white text-amber-800 border border-amber-200">
                              {pending}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {canEditAnaliticos && (
                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={saveLegajo}
                          className="bg-[#002d2b] hover:bg-[#00968f] text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                        >
                          Guardar Legajo
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="bg-[#0ffff4]/12 p-4 border border-[#0ffff4]/35 rounded-2xl">
                    <p className="text-[11px] font-black text-[#00968f] uppercase tracking-widest">Licencia / Carrera</p>
                    <p className="font-bold text-slate-800 mt-1 text-base">{selectedStudent.licencia || 'NO ASIGNADA'}</p>
                  </div>
                  <div className="bg-emerald-50 p-4 border border-emerald-100 rounded-2xl">
                    <p className="text-[11px] font-black text-emerald-600 uppercase tracking-widest">Nacionalidad</p>
                    <p className="font-bold text-slate-800 mt-1 text-base">{selectedStudent.nacionalidad || 'SIN ESPECIFICAR'}</p>
                  </div>
                  <div className="bg-emerald-50 p-4 border border-emerald-100 rounded-2xl">
                    <p className="text-[11px] font-black text-emerald-600 uppercase tracking-widest">Comisión</p>
                    <p className="font-bold text-slate-800 mt-1 text-base">{selectedStudent.comision || 'SIN COMISIÓN'}</p>
                  </div>
                  {selectedStudent.situacion && (
                    <div className="col-span-2 bg-indigo-50 p-4 border border-indigo-100 rounded-2xl flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-black text-indigo-500 uppercase tracking-widest">Situación Académica</p>
                        <p className="font-bold text-slate-800 mt-1 text-base">{selectedStudent.situacion}</p>
                      </div>
                      <div className="bg-indigo-100 w-10 h-10 rounded-full flex items-center justify-center">
                        <FileText className="w-5 h-5 text-indigo-600" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900">Materias Aprobadas ({selectedStudent.notas?.length || 0})</h3>
                  {canEditAnaliticos && (
                    <button
                      onClick={() => setShowAddNota(prev => !prev)}
                      className="text-xs font-bold bg-[#002d2b] hover:bg-[#00968f] text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      + Agregar Nota
                    </button>
                  )}
                </div>

                {(() => {
                  const mailContent = getMailContent(selectedStudent);
                  return (
                    <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Comunicacion</p>
                          <h3 className="text-base font-bold text-slate-900 mt-1">Mail para seguimiento</h3>
                          <p className="text-sm text-slate-500 mt-1">
                            {selectedStudent.email ? `Destino: ${selectedStudent.email}` : 'El alumno no tiene email cargado. Podés copiar el texto y usarlo manualmente.'}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => copyMailContent(selectedStudent)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 text-sm font-bold transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                            Copiar
                          </button>
                          <button
                            onClick={() => openMailClient(selectedStudent)}
                            disabled={!selectedStudent.email}
                            className="action-badge inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Mail className="w-4 h-4" />
                            Abrir mail
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-bold text-slate-500 mb-2">Asunto</p>
                        <p className="text-sm font-semibold text-slate-800">{mailContent.asunto}</p>
                        <p className="text-xs font-bold text-slate-500 mt-3 mb-2">Mensaje</p>
                        <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans leading-relaxed">{mailContent.cuerpo}</pre>
                      </div>
                    </div>
                  );
                })()}

                {showAddNota && (
                  <div className="mb-4 p-4 bg-[#0ffff4]/12 border border-[#0ffff4]/35 rounded-xl space-y-3">
                    <p className="text-xs font-bold text-[#00968f] uppercase tracking-widest">Nueva Materia / Nota</p>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="block text-xs text-slate-500 mb-1">Materia</label>
                        <input
                          value={newMateria}
                          onChange={e => setNewMateria(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00968f] outline-none"
                          placeholder="Ej: TÉCNICA TÁCTICA I"
                        />
                      </div>
                      <div className="w-24">
                        <label className="block text-xs text-slate-500 mb-1">Nota (0-10)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="10"
                          value={newNota}
                          onChange={e => setNewNota(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00968f] outline-none"
                          placeholder="8.5"
                        />
                      </div>
                      <button onClick={saveNotaManual} className="bg-[#002d2b] hover:bg-[#00968f] text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shrink-0">
                        Guardar
                      </button>
                    </div>
                  </div>
                )}

                {(() => {
                  const stripAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[,.:;]/g, '').replace(/\s+/g, ' ').toUpperCase().trim();
                  const planMaterias = getSubjectsByLicencia(selectedStudent.licencia || '');
                  const notasMap = Object.fromEntries(
                    (selectedStudent.notas || []).map(n => [stripAccents(n.materia), n.nota])
                  );

                  return planMaterias.length > 0 ? (
                    <div className="space-y-1 border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                      {planMaterias.map((materia, i) => {
                        const notaActual = notasMap[stripAccents(materia)] ?? 0;
                        const tiene = notaActual > 0;
                        const esInsuficiente = notaActual > 0 && notaActual < 6;
                        const pending = pendingNotas[materia];
                        const hasPending = pending !== undefined && parseFloat(pending) !== notaActual;
                        const isSaving = savingNota === materia;

                        const guardarNota = async (mat: string, val: string) => {
                          const num = parseFloat(val);
                          if (isNaN(num) || num < 0 || num > 10) {
                            toast.error(`Nota inválida: "${val}". Debe ser un número entre 0 y 10.`);
                            return;
                          }
                          if (num === notaActual) return;
                          setSavingNota(mat);
                          try {
                            const url = `${API_URL}/api/students/${selectedStudent.id}/nota?${getUserQuery()}`;
                            console.log('[guardarNota] POST', url, { asignatura: mat, nota: num });
                            const res = await fetch(url, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ asignatura: mat, nota: num })
                            });
                            const data = await res.json();
                            console.log('[guardarNota] respuesta:', data);
                            if (!res.ok) {
                              toast.error(`Error al guardar: ${data.error || res.status}`);
                              setSavingNota(null);
                              return;
                            }
                            await fetchStudents();
                            const updated = await fetch(`${API_URL}/api/students`).then(r => r.json());
                            const s = updated.data?.find((x: any) => x.id === selectedStudent.id);
                            if (s) setSelectedStudent(s);
                            setPendingNotas(prev => { const nx = { ...prev }; delete nx[mat]; return nx; });
                          } catch (err: any) {
                            toast.error(`Error de red: ${err.message}`);
                          }
                          setSavingNota(null);
                        };

                        return (
                          <div key={i} className={`flex justify-between items-center px-4 py-2.5 border-b border-slate-50 last:border-0 transition-colors ${tiene && !hasPending ? 'bg-white' : hasPending ? 'bg-yellow-50' : 'bg-amber-50'}`}>
                            <span className="font-medium text-slate-700 text-sm flex-1 pr-4">{materia}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              {canEditAnaliticos ? (
                                <>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="10"
                                    value={pending !== undefined ? pending : (notaActual || '')}
                                    onChange={e => setPendingNotas(prev => ({ ...prev, [materia]: e.target.value }))}
                                    onKeyDown={e => { if (e.key === 'Enter') guardarNota(materia, pending ?? String(notaActual)); }}
                                    className={`w-16 text-center px-2 py-1 rounded-lg text-sm font-black border outline-none focus:ring-2 focus:ring-[#00968f] transition-colors ${hasPending ? 'bg-yellow-100 border-yellow-400 text-yellow-900' : esInsuficiente ? 'bg-red-50 text-red-600 border-red-200' : tiene ? 'grade-badge-passed' : 'bg-red-50 text-red-500 border-red-200'}`}
                                    placeholder="0"
                                  />
                                  {hasPending && (
                                    <button
                                      onClick={() => guardarNota(materia, pending!)}
                                      disabled={isSaving}
                                      className="text-xs bg-[#002d2b] hover:bg-[#00968f] text-white px-2 py-1 rounded-lg font-bold transition-colors disabled:opacity-50"
                                    >
                                      {isSaving ? '...' : 'OK'}
                                    </button>
                                  )}
                                </>
                              ) : (
                                <span className={`w-10 text-center py-1 rounded font-black text-sm ${esInsuficiente ? 'bg-red-50 text-red-600' : tiene ? 'grade-badge-passed' : 'bg-red-50 text-red-400'}`}>{notaActual || '-'}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    // Fallback: si la licencia no tiene plan definido, mostrar las notas cargadas
                    selectedStudent.notas && selectedStudent.notas.length > 0 ? (
                      <div className="space-y-2 border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                        {selectedStudent.notas.map((nota, i) => (
                          <div key={i} className="flex justify-between items-center p-3.5 bg-white border-b border-slate-50 hover:bg-slate-50 transition-colors last:border-0">
                            <span className="font-semibold text-slate-700 text-sm">{nota.materia}</span>
                            <span className={`w-10 text-center py-1 rounded font-black ${nota.nota < 6 ? 'bg-red-50 text-red-600' : 'grade-badge-passed'}`}>{nota.nota}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-100 p-6 rounded-2xl text-center">
                        <p className="text-amber-700 font-semibold mb-1">Licencia no reconocida o sin plan definido.</p>
                        <p className="text-amber-600/70 text-sm">Verificá que el alumno tenga una licencia CB, A o PRO asignada.</p>
                      </div>
                    )
                  );
                })()}

                {/* Fechas Importantes */}
                <div className="mt-8 border-t border-slate-100 pt-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Fechas Importantes</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Fecha Fin de Cursada</label>
                      <input
                        type="date"
                        value={selectedStudent.fecha_fin_cursada || ''}
                        onChange={(e) => setSelectedStudent({ ...selectedStudent, fecha_fin_cursada: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00968f] outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Fecha de Emisión</label>
                      <input
                        type="date"
                        value={selectedStudent.fecha_emision || ''}
                        onChange={(e) => setSelectedStudent({ ...selectedStudent, fecha_emision: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00968f] outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button onClick={handleSaveFechas} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                      Guardar Fechas
                    </button>
                  </div>
                </div>

                {/* Historial de Actividad */}
                {selectedStudent.historial && selectedStudent.historial.length > 0 && (
                  <div className="mt-8 border-t border-slate-100 pt-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">Historial de Actividad</h3>
                    <div className="space-y-3">
                      {selectedStudent.historial.slice().reverse().map((log: any, i: number) => (
                        <div key={i} className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-sm">
                          <div className="flex justify-between items-center mb-1">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-700">{formatUserDisplay(log.usuario, log.nombre)}</span>
                              {log.usuario && <span className="text-[11px] text-slate-400">{log.usuario}</span>}
                            </div>
                            <span className="text-xs text-slate-400 font-medium">{new Date(log.fecha).toLocaleString()}</span>
                          </div>
                          <p className="text-slate-600">{log.accion}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

                                          {/* Modal Footer */}
              <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-between items-center shrink-0 flex-wrap gap-4">
                <div className="flex flex-wrap items-center gap-3 w-full justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${selectedStudent.estado_analitico === 'emitido' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-700'}`}>
                      Analítico {selectedStudent.estado_analitico === 'emitido' ? 'Emitido' : 'Borrador'}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${selectedStudent.diploma_emitido ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-700'}`}>
                      Diploma {selectedStudent.diploma_emitido ? 'Emitido' : 'Pendiente'}
                    </span>
                    {!isAnaliticoCompleto(selectedStudent) && (
                      <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 text-amber-700">
                        Incompleto (faltan notas)
                      </span>
                    )}
                    {user.role === 'viewer' && (
                      <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-slate-200 text-slate-700">
                        Solo lectura
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 w-full justify-end flex-wrap mt-2">
                    {canEditAnaliticos && selectedStudent.estado_analitico === 'emitido' && (
                      <button
                        onClick={() => handleToggleEstado(selectedStudent.id as any)}
                        className="px-3.5 py-2 rounded-lg text-sm font-bold flex gap-2 items-center transition-all shadow-sm border bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300"
                        title="Revertir a Borrador (requiere justificación)"
                      >
                        Desmarcar Emitido
                      </button>
                    )}

                    {canEditAnaliticos && selectedStudent.notas && selectedStudent.notas.length > 0 && (
                      <button
                        onClick={() => handleDeleteNotas(selectedStudent.id as any)}
                        className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors border border-transparent hover:border-red-200"
                        title="Eliminar solo las notas (Quedar en Borrador)"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}

                    {(() => {
                      const errors = getAnaliticoErrors(selectedStudent);
                      const isComplete = errors.length === 0;
                      const isLegajoReady = isReadyToEmitAnalitico(selectedStudent);
                      const isViewer = user.role === 'viewer';
                      const disabled = isViewer; // Solo deshabilitamos si es viewer. Si es incompleto, dejamos clickear para ver el error (Toast).
                      const opacityClasses = disabled ? ' opacity-50 cursor-not-allowed' : '';
                      
                      const handleDownloadClick = (type: 'preview' | 'emit' | 'diploma') => {
                        if (type === 'emit' && !isLegajoReady) {
                          toast.error(
                            <div>
                              <p className="font-bold">No se puede emitir el analitico:</p>
                              <ul className="text-xs list-disc pl-4 mt-1">
                                {getLegajoPendings(selectedStudent).map((pending: string, idx: number) => <li key={idx}>{pending}</li>)}
                              </ul>
                            </div>
                          );
                          return;
                        }

                        if (type === 'diploma' && !String(selectedStudent.nacionalidad || '').trim()) {
                          toast.error('No se puede emitir el diploma sin nacionalidad cargada.');
                          return;
                        }

                        if (errors.length > 0) {
                          toast.error(
                            <div>
                              <p className="font-bold">No se puede emitir {type === 'diploma' ? 'el diploma' : 'el analítico'}:</p>
                              <ul className="text-xs list-disc pl-4 mt-1">
                                {errors.slice(0, 3).map((err: string, idx: number) => <li key={idx}>{err}</li>)}
                                {errors.length > 3 && <li>Y {errors.length - 3} más...</li>}
                              </ul>
                            </div>
                          );
                          return;
                        }

                        if (type === 'preview') downloadPDF(selectedStudent);
                        else if (type === 'emit') downloadPDFAndEmit(selectedStudent);
                        else if (type === 'diploma') openDiplomaModal(selectedStudent);
                      };

                      return (
                        <>
                          <button
                            onClick={() => !disabled && handleDownloadClick('preview')}
                            disabled={disabled}
                            className={`action-badge px-4 py-2 rounded-lg text-sm font-bold flex gap-2 items-center transition-all border ${opacityClasses} ${!isComplete ? 'grayscale-[0.5]' : ''}`}
                            title={isComplete ? "Vista previa del PDF" : "Faltan notas o hay notas menores a 6"}
                          >
                            <Download className="w-4 h-4" /> Vista Previa
                          </button>
                          <button
                            onClick={() => !disabled && handleDownloadClick('diploma')}
                            disabled={disabled}
                            className={`flex items-center justify-center gap-2 px-4 py-2 border-2 border-indigo-600 text-indigo-700 hover:bg-indigo-50 rounded-lg text-sm font-bold transition-all${opacityClasses} ${!isComplete ? 'grayscale-[0.5]' : ''}`}
                          >
                            <School className="w-5 h-5" />
                            Generar Diploma
                          </button>
                          <button
                            onClick={() => !disabled && handleDownloadClick('emit')}
                            disabled={disabled}
                            className={`flex items-center justify-center gap-2 px-4 py-2 bg-[#002d2b] hover:bg-[#00968f] text-white rounded-lg text-sm font-bold transition-all shadow-md shadow-[#002d2b]/20${opacityClasses} ${!isLegajoReady ? 'grayscale-[0.5]' : ''}`}
                            title="Genera el PDF y marca el analítico como Emitido"
                          >
                            <Download className="w-5 h-5" />
                            Generar Analítico PDF
                          </button>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );



  const renderUsuarios = () => {
    const handleEditClick = (u: any) => {
      setEditingUser(u);
      setNewUserNombre(u.nombre);
      setNewUserEmail(u.email);
      setNewUserPassword(''); // No mostramos el password
      setNewUserRole(u.role);
      setNewUserPermissions(u.permissions || { 'analiticos': 'none' });
    };

    const togglePermission = (module: string) => {
      setNewUserPermissions(prev => {
        const current = prev[module] || 'none';
        const next = current === 'none' ? 'editor' : 'none';
        return { ...prev, [module]: next };
      });
    };

    const updateModuleRole = (module: string, role: string) => {
      setNewUserPermissions(prev => ({ ...prev, [module]: role }));
    };

    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
        <h2 className="text-3xl font-bold text-slate-900">Gestión de Usuarios</h2>

        {/* Formulario crear/editar */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">{editingUser ? `Editando Usuario: ${editingUser.nombre}` : 'Crear nuevo usuario'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Nombre</label>
              <input
                value={newUserNombre}
                onChange={e => setNewUserNombre(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00968f] outline-none"
                placeholder="Ej: Maria Gonzalez"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Email</label>
              <input
                type="email"
                value={newUserEmail}
                onChange={e => setNewUserEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00968f] outline-none"
                placeholder="editor@ejemplo.com"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Contrasena {editingUser && '(dejar vacío para no cambiar)'}</label>
              <input
                type="text"
                value={newUserPassword}
                onChange={e => setNewUserPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00968f] outline-none"
                placeholder={editingUser ? "********" : "Contrasena temporal"}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Rol Global</label>
              <select
                value={newUserRole}
                onChange={e => setNewUserRole(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00968f] outline-none bg-white"
              >
                {canAssignSuperadmin && <option value="superadmin">Superadmin (Acceso Total)</option>}
                <option value="editor">Editor (Personalizado)</option>
                <option value="viewer">Viewer (Solo Lectura)</option>
              </select>
            </div>
          </div>

          {newUserRole !== 'superadmin' && (
            <div className="space-y-4 mb-6">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">Permisos por Módulo</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Modulo Analíticos */}
                <div className={`p-4 rounded-xl border transition-all ${newUserPermissions['analiticos'] !== 'none' ? 'border-[#0ffff4] bg-[#0ffff4]/5' : 'border-slate-100 bg-slate-50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-slate-400" />
                      <span className="font-bold text-slate-700">Módulo Analíticos</span>
                    </div>
                    <button 
                      onClick={() => togglePermission('analiticos')}
                      className={`px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all ${newUserPermissions['analiticos'] !== 'none' ? 'bg-[#002d2b] text-white' : 'bg-slate-200 text-slate-500'}`}
                    >
                      {newUserPermissions['analiticos'] !== 'none' ? 'Habilitado' : 'Deshabilitado'}
                    </button>
                  </div>
                  {newUserPermissions['analiticos'] !== 'none' && (
                    <select
                      value={newUserPermissions['analiticos']}
                      onChange={e => updateModuleRole('analiticos', e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-[#00968f]"
                    >
                      <option value="viewer">Solo Lectura (Viewer)</option>
                      <option value="editor">Edición (Editor)</option>
                    </select>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-4">
            {editingUser && (
              <button
                onClick={() => {
                  setEditingUser(null);
                  setNewUserNombre('');
                  setNewUserEmail('');
                  setNewUserPassword('');
                  setNewUserRole('editor');
                  setNewUserPermissions({ 'analiticos': 'none' });
                }}
                className="px-6 py-2 rounded-lg text-sm font-bold text-slate-500 hover:bg-slate-100 transition-all"
              >
                Cancelar Edición
              </button>
            )}
            <button
              onClick={handleCreateUser}
              className="bg-[#002d2b] hover:bg-[#00968f] text-white px-6 py-2 rounded-lg text-sm font-bold transition-all shadow hover:-translate-y-0.5 active:scale-[0.98]"
            >
              {editingUser ? 'Actualizar Usuario' : 'Crear Usuario'}
            </button>
          </div>
        </div>

        {/* Lista de usuarios */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-800">Usuarios del Sistema ({appUsers.length})</h3>
          </div>
          {appUsers.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <p>No hay usuarios registrados todavía.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {appUsers.map(u => (
                <div key={u.id} className="flex items-center justify-between px-6 py-5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-xl ${u.role === 'superadmin' ? 'bg-[#0ffff4]/20' : 'bg-emerald-100'}`}>
                      <User className={`w-5 h-5 ${u.role === 'superadmin' ? 'text-[#002d2b]' : 'text-emerald-700'}`} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{u.nombre}</p>
                      <p className="text-sm text-slate-500">{u.email}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    {/* Resumen de permisos */}
                    <div className="hidden md:flex items-center gap-2">
                      {u.role === 'superadmin' ? (
                        <span className="px-2 py-0.5 bg-slate-900 text-white text-[8px] font-black rounded uppercase tracking-widest">Superadmin</span>
                      ) : (
                        <>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${u.permissions?.['analiticos'] !== 'none' ? 'distribution-badge' : 'bg-slate-100 text-slate-300 border-slate-200'}`}>
                            Analíticos: {u.permissions?.['analiticos'] || 'none'}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditClick(u)}
                        className="p-2 text-slate-400 hover:bg-slate-100 hover:text-[#00968f] rounded-lg transition-colors"
                        title="Editar usuario"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {u.role !== 'superadmin' && (
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="p-2 text-red-300 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors"
                          title="Eliminar usuario"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen font-sans flex overflow-hidden text-slate-900">
      {/* SIDEBAR */}
      <aside
        style={{ width: sidebarCollapsed ? '72px' : '288px', transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)', minWidth: sidebarCollapsed ? '72px' : '288px' }}
        className="bg-brand-sidebar flex flex-col shadow-2xl relative z-20 shrink-0 text-white overflow-hidden"
      >
        {/* Logo / Header */}
        <div className="px-4 h-16 flex items-center border-b border-white/10 shrink-0 overflow-hidden">
          {sidebarCollapsed ? (
            <div className="w-10 h-10 flex items-center justify-center mx-auto">
              <School className="w-6 h-6 text-[#0ffff4]" />
            </div>
          ) : (
            <img src={logoHorizontal} alt="Escuela Maradona Menotti" className="h-10 w-auto object-contain" />
          )}
        </div>

        {/* Collapse toggle — pinned to right edge */}
        <button
          onClick={() => setSidebarCollapsed(c => !c)}
          title={sidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
          style={{ position: 'absolute', top: '18px', right: '-13px', zIndex: 30 }}
          className="w-6 h-6 rounded-full bg-[#1D9E75] border-2 border-brand-sidebar flex items-center justify-center shadow-lg hover:bg-[#0ffff4] hover:border-[#0ffff4] transition-all group"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
            className="text-white group-hover:text-[#002d2b] transition-colors"
            style={{ transform: sidebarCollapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.25s' }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {/* SECCIÓN DASHBOARD */}
          {(isSuperadmin || user.permissions?.['analiticos'] === 'editor') && (
            <div className="space-y-1">
              {!sidebarCollapsed && <p className="px-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#0ffff4]/60 mb-1 mt-3">General</p>}
              {sidebarCollapsed && <div className="h-4" />}
              <button
                onClick={() => setActiveTab('dashboard')}
                title="Dashboard General"
                className={`sidebar-link ${activeTab === 'dashboard' ? 'sidebar-link-active' : 'sidebar-link-inactive'}`}
              >
                <LayoutDashboard className="w-5 h-5 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">Dashboard General</span>}
              </button>
            </div>
          )}

          {/* SECCIÓN ANALÍTICOS */}
          {user.role !== 'student' && hasAnaliticosAccess && (
            <div className="space-y-1">
              {!sidebarCollapsed && <p className="px-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#0ffff4]/60 mb-1 mt-3">Padrón</p>}
              {sidebarCollapsed && <div className="h-2" />}
              <button
                onClick={() => setActiveTab('alumnos')}
                title="Alumnos"
                className={`sidebar-link ${activeTab === 'alumnos' ? 'sidebar-link-active' : 'sidebar-link-inactive'}`}
              >
                <Users className="w-5 h-5 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">Alumnos</span>}
              </button>
            </div>
          )}

          {/* SECCIÓN CRM — grupo colapsable */}
          {user.role !== 'student' && hasCrmAccess && (
            <div className="space-y-0.5">
              {/* Header del grupo CRM */}
              {!sidebarCollapsed ? (
                <button
                  onClick={() => setCrmExpanded(e => !e)}
                  className="w-full flex items-center justify-between px-3 py-1 mt-3 mb-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#0ffff4]/60 hover:text-white/70 transition-colors rounded-lg hover:bg-white/5 group"
                >
                  <span>CRM</span>
                  <ChevronDown
                    className="w-3 h-3 transition-transform duration-200"
                    style={{ transform: crmExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                  />
                </button>
              ) : (
                <div className="h-2" />
              )}

              {/* Sub-ítems: visibles si expandido (o siempre en modo icono-solo) */}
              {(crmExpanded || sidebarCollapsed) && (
                <div className={`space-y-0.5 ${!sidebarCollapsed ? 'pl-2 border-l border-white/10 ml-3' : ''}`}>
                  <button onClick={() => { setActiveTab('crm-kpis'); setCrmExpanded(true); }} title="KPIs & Pipeline"
                    className={`sidebar-link ${activeTab === 'crm-kpis' ? 'sidebar-link-active' : 'sidebar-link-inactive'}`}>
                    <BarChart3 className="w-4 h-4 shrink-0" />
                    {!sidebarCollapsed && <span className="truncate">KPIs</span>}
                  </button>

                  <button onClick={() => { setActiveTab('crm-kanban'); setCrmExpanded(true); }} title="Kanban"
                    className={`sidebar-link ${activeTab === 'crm-kanban' ? 'sidebar-link-active' : 'sidebar-link-inactive'}`}>
                    <Columns className="w-4 h-4 shrink-0" />
                    {!sidebarCollapsed && <span className="truncate">Kanban</span>}
                  </button>

                  <button onClick={() => { setActiveTab('crm-lista'); setCrmExpanded(true); }} title="Lista de prospectos"
                    className={`sidebar-link ${activeTab === 'crm-lista' ? 'sidebar-link-active' : 'sidebar-link-inactive'}`}>
                    <List className="w-4 h-4 shrink-0" />
                    {!sidebarCollapsed && <span className="truncate">Lista</span>}
                  </button>

                  <button onClick={() => { setActiveTab('crm-wa'); setCrmExpanded(true); }} title="Bandeja WhatsApp"
                    className={`sidebar-link ${activeTab === 'crm-wa' ? 'sidebar-link-active' : 'sidebar-link-inactive'}`}>
                    <MessageCircle className="w-4 h-4 shrink-0" />
                    {!sidebarCollapsed && <span className="truncate">Bandeja WA</span>}
                  </button>

                  <button onClick={() => { setActiveTab('crm-plantillas'); setCrmExpanded(true); }} title="Plantillas WA"
                    className={`sidebar-link ${activeTab === 'crm-plantillas' ? 'sidebar-link-active' : 'sidebar-link-inactive'}`}>
                    <BookMarked className="w-4 h-4 shrink-0" />
                    {!sidebarCollapsed && <span className="truncate">Plantillas WA</span>}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SECCIÓN Gestión Usuarios */}
          {canManageUsers && (
            <div className="space-y-1">
              {!sidebarCollapsed && <p className="px-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#0ffff4]/60 mb-1 mt-3">Seguridad</p>}
              {sidebarCollapsed && <div className="h-2" />}
              <button
                onClick={() => { setActiveTab('usuarios'); fetchAppUsers(); }}
                title="Gestión de Usuarios"
                className={`sidebar-link ${activeTab === 'usuarios' ? 'sidebar-link-active' : 'sidebar-link-inactive'}`}
              >
                <UserPlus className="w-5 h-5 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">Gestión de Usuarios</span>}
              </button>
            </div>
          )}
        </nav>

        {/* User info & logout */}
        <div className="p-3 bg-white/5 mt-auto border-t border-white/10 shrink-0">
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div className="bg-white/10 p-2 rounded-xl ring-2 ring-[#0ffff4]/25">
                <User className="w-5 h-5 text-[#0ffff4]" />
              </div>
              <button
                onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
                title={theme === 'light' ? 'Activar Night Shift' : 'Activar Light Shift'}
                className="sidebar-btn-secondary w-10 h-10 flex items-center justify-center rounded-xl transition-all"
              >
                {theme === 'light' ? <Moon className="w-4 h-4 text-[#0ffff4]" /> : <Sun className="w-4 h-4 text-yellow-400" />}
              </button>
              <button
                onClick={handleLogout}
                title="Cerrar Sesión"
                className="sidebar-btn-secondary w-10 h-10 flex items-center justify-center rounded-xl transition-all"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 px-1">
                <div className="bg-white/10 p-2.5 rounded-xl shadow-sm ring-2 ring-[#0ffff4]/25 shrink-0">
                  <User className="w-5 h-5 text-[#0ffff4]" />
                </div>
                <div className="flex flex-col overflow-hidden min-w-0">
                  <span className="sidebar-user-name text-sm font-semibold truncate" title={user.name}>{user.name}</span>
                  <span className="sidebar-user-role text-[11px] font-black uppercase tracking-wider mt-0.5">{user.role}</span>
                </div>
              </div>

              {/* Selector de Tema */}
              <div className="flex items-center justify-between p-1 bg-black/25 rounded-xl border border-white/10">
                <button
                  onClick={() => setTheme('light')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${theme === 'light' ? 'sidebar-theme-active-light' : 'sidebar-theme-inactive'}`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>Light Shift</span>
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${theme === 'dark' ? 'sidebar-theme-active-dark' : 'sidebar-theme-inactive'}`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>Night Shift</span>
                </button>
              </div>

              <button
                onClick={handleLogout}
                className="sidebar-btn-secondary flex items-center justify-center gap-2 w-full py-2.5 rounded-xl transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm font-bold">Cerrar Sesión</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-full bg-transparent min-w-0 overflow-hidden">
        {/* Header: oculto cuando Bandeja WA está activa para máximo espacio */}
        {!isCrmWa && (
          <header className="h-16 bg-white/90 backdrop-blur-xl border-b border-[#00968f26] px-8 flex items-center shrink-0 shadow-sm">
            <h1 className="text-slate-900 text-xl font-black tracking-tight">
              {activeTab === 'dashboard' ? 'Módulo Analíticos: Panel de Control' :
               activeTab === 'alumnos' ? 'Padrón de Alumnos' :
               activeTab === 'usuarios' ? 'Gestión de Usuarios' :
               activeTab === 'crm-kpis' ? 'CRM — KPIs & Pipeline' :
               activeTab === 'crm-kanban' ? 'CRM — Vista Kanban' :
               activeTab === 'crm-lista' ? 'CRM — Lista de Prospectos' :
               activeTab === 'crm-plantillas' ? 'CRM — Plantillas WA' : ''}
            </h1>
          </header>
        )}

        {/* Bandeja WA: ocupa TODO el espacio sin header ni padding */}
        {isCrmWa ? (
          <div className="flex-1 min-h-0 overflow-hidden">
            <CrmModule
              apiUrl={API_URL}
              isSuperadmin={isSuperadmin}
              userPermissions={user?.permissions}
              subView="whatsapp"
              onNavigate={(v) => setActiveTab(v === 'lista' ? 'crm-lista' : `crm-${v}` as any)}
            />
          </div>
        ) : isCrmTab ? (
          /* Otras vistas CRM: con padding, scrollable dentro de CrmModule */
          <div className="flex-1 min-h-0 overflow-hidden">
            <CrmModule
              apiUrl={API_URL}
              isSuperadmin={isSuperadmin}
              userPermissions={user?.permissions}
              subView={crmSubView}
              onNavigate={(v) => setActiveTab(v === 'lista' ? 'crm-lista' : `crm-${v}` as any)}
            />
          </div>
        ) : (
          /* Vistas no-CRM: scrollable con padding */
          <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="max-w-7xl mx-auto pb-12">
              {activeTab === 'dashboard' ? renderDashboard() :
               activeTab === 'usuarios' ? renderUsuarios() :
               renderAlumnos()}
            </div>
          </main>
        )}
      </div>

      {renderAnaliticoModals()}

      {/* TOASTER para notificaciones */}
      <Toaster position="bottom-right" toastOptions={{ duration: 4000, style: { fontWeight: 'bold' } }} />

      {/* MODAL DE CONFIRMACIÓN CUSTOM */}
      <AnimatePresence>
        {confirmModal.open && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 flex flex-col"
            >
              <div className={`p-5 flex items-start gap-4 border-b border-slate-100 ${confirmModal.type === 'danger' ? 'bg-red-50' : confirmModal.type === 'warning' ? 'bg-amber-50' : 'bg-[#0ffff4]/10'}`}>
                <div className={`shrink-0 p-3 rounded-xl ${confirmModal.type === 'danger' ? 'bg-red-100 text-red-600' : confirmModal.type === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-[#00968f]/10 text-[#00968f]'}`}>
                  {confirmModal.type === 'danger' ? <Trash2 className="w-6 h-6" /> : confirmModal.type === 'warning' ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{confirmModal.title}</h3>
                  <p className="text-slate-600 text-sm mt-1">{confirmModal.message}</p>
                </div>
              </div>

              {confirmModal.withInput && (
                <div className="p-5 border-b border-slate-100">
                  <label className="block text-sm font-bold text-slate-700 mb-2">{confirmModal.inputLabel || 'Motivo'}</label>
                  <input
                    type="text"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    placeholder={confirmModal.inputPlaceholder}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#00968f] outline-none transition-all shadow-sm"
                    autoFocus
                  />
                </div>
              )}

              <div className="p-4 bg-slate-50 flex justify-end gap-3">
                <button
                  onClick={() => setConfirmModal(prev => ({ ...prev, open: false }))}
                  className="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (confirmModal.withInput && !confirmInput.trim()) {
                      toast.error('Debe completar este campo.');
                      return;
                    }
                    confirmModal.onConfirm(confirmInput);
                  }}
                  className={`px-5 py-2.5 rounded-lg text-sm font-bold text-white transition-colors shadow-sm ${confirmModal.type === 'danger' ? 'bg-red-600 hover:bg-red-700' : confirmModal.type === 'warning' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[#002d2b] hover:bg-[#00968f]'}`}
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {importConfig.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800">
                {importConfig.mode === 'db' ? 'Importar Notas' : 'Generar ZIP Masivo'}
              </h2>
              <button type="button" onClick={() => setImportConfig({ isOpen: false, mode: null })} className="text-slate-400 hover:text-slate-600 transition-colors bg-white p-1 rounded-full shadow-sm border border-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleModalSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Archivo de Notas Excel (.xlsx)</label>
                <input required type="file" accept=".xlsx, .xls" name="excelFile" className="w-full border border-slate-200 rounded-xl p-2 focus:ring-2 outline-none focus:ring-[#0ffff4]/50" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Licencia Correspondiente</label>
                <select required name="licencia" className="w-full border border-slate-200 rounded-xl p-2.5 bg-white focus:ring-2 outline-none focus:ring-[#0ffff4]/50">
                  <option value="CB">Licencia CB</option>
                  <option value="A">Licencia A</option>
                  <option value="B">Licencia B</option>
                  <option value="PRO">Licencia PRO</option>
                  <option value="TD1">TD1 (Trayectoria I)</option>
                  <option value="TD2">TD2 (Trayectoria II)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1 opacity-90">Fecha Fin Cursada</label>
                  <input type="date" name="fecha_fin_cursada" className="w-full text-sm border border-slate-200 rounded-xl p-2" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1 opacity-90">Fecha Emisión</label>
                  <input type="date" name="fecha_emision" className="w-full text-sm border border-slate-200 rounded-xl p-2" />
                </div>
              </div>
              <div className="pt-5 border-t border-slate-100 flex gap-3">
                <button type="button" onClick={() => setImportConfig({ isOpen: false, mode: null })} className="flex-1 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
                <button type="submit" disabled={isUploading} className="flex-1 py-3 bg-[#002d2b] hover:bg-[#00968f] text-white rounded-xl font-bold transition-all shadow shadow-[#002d2b]/30 hover:-translate-y-0.5 active:scale-[0.98]">
                  {isUploading ? 'Procesando...' : (importConfig.mode === 'db' ? 'Subir Notas' : 'Crear ZIP')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {newStudentModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800">Nuevo Alumno</h2>
              <button type="button" onClick={() => setNewStudentModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors bg-white p-1 rounded-full shadow-sm border border-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateStudent} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre</label>
                  <input required value={newStuNombre} onChange={e => setNewStuNombre(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Apellido</label>
                  <input required value={newStuApellido} onChange={e => setNewStuApellido(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Documento</label>
                  <input required value={newStuDni} onChange={e => setNewStuDni(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nacionalidad</label>
                  <input value={newStuNacionalidad} onChange={e => setNewStuNacionalidad(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm uppercase" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Carrera / Licencia</label>
                  <select value={newStuLicencia} onChange={e => setNewStuLicencia(e.target.value as any)} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-white">
                    <option value="CB">Licencia CB</option>
                    <option value="A">Licencia A</option>
                    <option value="PRO">Licencia PRO</option>
                    <option value="TD1">TD1</option>
                    <option value="TD2">TD2</option>
                    <option value="ACTUALIZACION">Curso de Actualización</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha de Emisión</label>
                  <input type="date" value={newStuFechaEmision} onChange={e => setNewStuFechaEmision(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm" />
                </div>
              </div>
              {newStuLicencia !== 'ACTUALIZACION' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha de Graduación / Fin de cursada</label>
                    <input type="date" value={newStuFechaFin} onChange={e => setNewStuFechaFin(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm" />
                  </div>
                  <div className="flex items-center text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3">
                    Al guardar se crean todas las materias de la licencia con nota 0.
                  </div>
                </div>
              )}
              {newStuLicencia === 'ACTUALIZACION' && (
                <p className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  Solo se piden los datos que requiere el certificado del Curso de Actualización.
                </p>
              )}
              <div className="pt-4 border-t border-slate-100 flex gap-3">
                <button type="button" onClick={() => setNewStudentModal(false)} className="flex-1 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
                <button type="submit" disabled={isUploading} className="flex-1 py-3 bg-[#002d2b] hover:bg-[#00968f] text-white rounded-xl font-bold transition-all shadow hover:-translate-y-0.5 active:scale-[0.98]">
                  {isUploading ? 'Guardando...' : 'Crear alumno'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}


















