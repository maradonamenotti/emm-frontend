import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import toast, { Toaster } from 'react-hot-toast';
import {
  FileSpreadsheet,
  Download,
  Upload,
  User,
  LogOut,
  FileText,
  Search,
  School,
  Trash2,
  LayoutDashboard,
  Users,
  X,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { type StudentData as BaseStudentData, getSubjectsByLicencia } from './services/pdfService';

type UserRole = 'admin' | 'staff' | 'student';

interface UserProfile {
  email: string;
  role: UserRole;
  name: string;
}

interface StudentData extends BaseStudentData {
  email?: string;
  comision?: string;
  situacion?: string;
  estado_analitico?: 'borrador' | 'emitido';
  fecha_emision?: string;
  fecha_fin_cursada?: string;
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
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const [activeTab, setActiveTab] = useState<'dashboard' | 'alumnos' | 'usuarios'>('dashboard');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [students, setStudents] = useState<StudentData[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [importConfig, setImportConfig] = useState<{ isOpen: boolean; mode: 'db' | 'zip' | null }>({ isOpen: false, mode: null });
  // Gestión de usuarios
  const [appUsers, setAppUsers] = useState<any[]>([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserNombre, setNewUserNombre] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');

  // Modal de confirmación personalizado
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void; type?: 'danger' | 'warning' | 'info'; withInput?: boolean; inputLabel?: string; inputPlaceholder?: string }>({ open: false, title: '', message: '', onConfirm: () => { } });
  const [confirmInput, setConfirmInput] = useState('');

  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);
  const [editingDatos, setEditingDatos] = useState(false);
  const [editDni, setEditDni] = useState('');
  const [editNombre, setEditNombre] = useState('');
  const [editApellido, setEditApellido] = useState('');
  const [showAddNota, setShowAddNota] = useState(false);
  const [newMateria, setNewMateria] = useState('');
  const [newNota, setNewNota] = useState('');
  // Mapa de notas pendientes de guardar (materia -> valor editado)
  const [pendingNotas, setPendingNotas] = useState<Record<string, string>>({});
  const [savingNota, setSavingNota] = useState<string | null>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedStudent(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

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

  useEffect(() => {
    fetch(`${API_URL}/api/health`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'ok') setBackendStatus('ok');
        else setBackendStatus('error');
      })
      .catch(() => setBackendStatus('error'));
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    if (user) {
      fetchStudents();
    }
  }, [user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Credenciales inválidas');
        return;
      }
      setUser({ email: data.email, role: data.role, name: data.nombre });
      setError('');
    } catch (err) {
      setError('Error de conexión con el servidor');
    }
  };

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
    if (!newUserEmail || !newUserNombre || !newUserPassword) {
      toast.error('Completar todos los campos');
      return;
    }
    const res = await fetch(`${API_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newUserEmail, nombre: newUserNombre, password: newUserPassword })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Error'); return; }
    setNewUserEmail('');
    setNewUserNombre('');
    setNewUserPassword('');
    await fetchAppUsers();
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('\u00bfEliminar este usuario?')) return;
    await fetch(`${API_URL}/api/users/${id}`, { method: 'DELETE' });
    await fetchAppUsers();
  };

  const handleLogout = () => {
    setUser(null);
    setEmail('');
    setPassword('');
    setStudents([]);
    setSelectedStudent(null);
    setAppUsers([]);
    setActiveTab('dashboard');
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
        const res = await fetch(`${API_URL}/api/process-excel?user=${encodeURIComponent(user?.email || 'Sistema')}`, { method: 'POST', body: submitData });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Error al importar en servidor');
        }
        const result = await res.json();
        toast.success(`Se vincularon notas a ${result.data.matchCount} alumnos. ${result.data.noMatchCount} DNIs sin registro.`);
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
      const response = await fetch(`${API_URL}/api/quinttos?user=${encodeURIComponent(user?.email || 'Sistema')}`, {
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
      onConfirm: async () => {
        try {
          await fetch(`${API_URL}/api/students/${id}?user=${encodeURIComponent(user?.email || 'Sistema')}`, { method: 'DELETE' });
          setStudents(prev => prev.filter(s => s.id !== id));
          if (selectedStudent?.id === id) setSelectedStudent(null);
          toast.success('Alumno eliminado correctamente.');
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
      onConfirm: async () => {
        try {
          await fetch(`${API_URL}/api/students/${id}/notas?user=${encodeURIComponent(user?.email || 'Sistema')}`, { method: 'DELETE' });
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


  const handleToggleEstado = async (id?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!id) return;
    const nuevoEstado = selectedStudent?.estado_analitico === 'emitido' ? 'borrador' : 'emitido';

    const executeToggle = async (motivoAdicional = '') => {
      try {
        const res = await fetch(`${API_URL}/api/students/${id}/estado?user=${encodeURIComponent(user?.email || 'Sistema')}`, {
          method: 'PUT',
          body: JSON.stringify({ estado: nuevoEstado, motivo: motivoAdicional }),
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        await fetchStudents();
        if (selectedStudent?.id === id) {
          setSelectedStudent(prev => prev ? ({ ...prev, estado_analitico: data.estado }) : null);
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
        onConfirm: async () => {
          await executeToggle(confirmInput.trim());
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
      const res = await fetch(`${API_URL}/api/students/${selectedStudent.id}/dates?user=${encodeURIComponent(user?.email || 'Sistema')}`, {
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

  const startEditDatos = () => {
    if (!selectedStudent) return;
    const parts = selectedStudent.nombre.trim().split(' ');
    const apellido = parts.length > 1 ? parts[parts.length - 1] : '';
    const nombre = parts.slice(0, -1).join(' ') || parts[0];
    setEditDni(selectedStudent.dni || '');
    setEditNombre(nombre);
    setEditApellido(apellido);
    setEditingDatos(true);
  };

  const saveDatos = async () => {
    if (!selectedStudent?.id) return;
    try {
      await fetch(`${API_URL}/api/students/${selectedStudent.id}/datos?user=${encodeURIComponent(user?.email || 'Sistema')}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documento: editDni, nombre: editNombre, apellido: editApellido })
      });
      await fetchStudents();
      setEditingDatos(false);
      setSelectedStudent(prev => prev ? ({
        ...prev,
        dni: editDni,
        nombre: `${editNombre} ${editApellido}`.trim()
      }) : null);
      toast.success('Datos personales guardados correctamente.');
    } catch (err) {
      toast.error('Error al guardar datos personales');
    }
  };

  const saveNotaManual = async () => {
    if (!selectedStudent?.id || !newMateria.trim() || !newNota) return;
    try {
      const res = await fetch(`${API_URL}/api/students/${selectedStudent.id}/nota?user=${encodeURIComponent(user?.email || 'Sistema')}`, {
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
    window.open(`${API_URL}/api/students/${student.id}/certificate`, '_blank');
  };

  // Descarga el PDF y marca automáticamente como Emitido
  const downloadPDFAndEmit = async (student: StudentData) => {
    if (!student.id) { alert("El alumno no tiene ID registrado."); return; }
    // 1. Descargar
    window.open(`${API_URL}/api/students/${student.id}/certificate`, '_blank');
    // 2. Marcar como Emitido si todavía no lo estaba
    if (student.estado_analitico !== 'emitido') {
      try {
        const res = await fetch(
          `${API_URL}/api/students/${student.id}/estado?user=${encodeURIComponent(user?.email || 'Sistema')}`,
          { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: 'emitido', motivo: 'Generado desde el sistema' }) }
        );
        const data = await res.json();
        await fetchStudents();
        setSelectedStudent(prev => prev ? ({ ...prev, estado_analitico: data.estado }) : null);
      } catch (err) { console.error('No se pudo marcar como Emitido:', err); }
    }
  };

  const exportToExcel = () => {
    const dataToExport = filteredStudents.map(student => ({
      DNI: student.dni,
      Nombre: student.nombre,
      Email: student.email || '',
      'Licencia/Carrera': student.licencia || '',
      Comision: student.comision || '',
      'Situacion Academica': student.situacion || '',
      'Estado Analitico': student.estado_analitico === 'emitido' ? 'Emitido' : 'Borrador',
      Promedio: student.notas && student.notas.length > 0 ? student.promedio.toFixed(2) : 'Sin notas',
      'Materias Aprobadas': student.notas?.length || 0,
      'Fecha Emision': student.fecha_emision || '',
      'Fecha Fin Cursada': student.fecha_fin_cursada || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Alumnos");
    XLSX.writeFile(workbook, "Listado_Alumnos.xlsx");
  };

  const uniqueStatuses = Array.from(new Set(students.map(s => s.situacion).filter(Boolean)));

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || s.dni.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || s.situacion === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-200"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="bg-blue-900 p-4 rounded-full mb-4">
              <School className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 text-center">ESCUELA MARADONA MENOTTI</h1>
            <p className="text-slate-500 text-sm">Sistema de Gestión de Analíticos</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email Institucional</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-900 focus:border-transparent outline-none transition-all"
                placeholder="ej: titulos@maradonamenotti.com.ar"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-900 focus:border-transparent outline-none transition-all"
                placeholder="••••••••"
                required
              />
            </div>
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
            <button
              type="submit"
              disabled={backendStatus === 'checking'}
              className="w-full bg-blue-900 hover:bg-blue-800 disabled:bg-slate-400 text-white font-semibold py-3 rounded-lg transition-colors shadow-lg"
            >
              {backendStatus === 'checking' ? 'Iniciando...' : 'Ingresar al Sistema'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">Acceso restringido a personal autorizado y alumnos matriculados.</p>
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

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h2 className="text-3xl font-bold text-slate-900 drop-shadow-sm">Dashboard General</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-slate-500 text-sm font-medium mb-3 uppercase tracking-wider">Total Alumnos</h3>
            <p className="text-4xl font-extrabold text-blue-900">{totalAlumnos}</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 rounded-2xl border border-emerald-200 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-emerald-700 text-sm font-medium mb-3 uppercase tracking-wider">Con Analítico</h3>
            <p className="text-4xl font-extrabold text-emerald-800">{conAnalitico}</p>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-2xl border border-amber-200 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-amber-700 text-sm font-medium mb-3 uppercase tracking-wider">Esperando Notas</h3>
            <p className="text-4xl font-extrabold text-amber-800">{sinAnalitico}</p>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-200">
          <h3 className="text-xl font-bold text-slate-800 mb-6 drop-shadow-sm">Distribución por Licencia / Carrera</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Object.entries(porCarrera).map(([carr, count]) => (
              <div key={carr} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:bg-slate-50 transition-colors">
                <span className="font-semibold text-slate-700 line-clamp-1" title={carr}>{carr}</span>
                <span className="bg-blue-100 text-blue-900 px-4 py-1.5 rounded-full text-sm font-black shadow-inner">{count}</span>
              </div>
            ))}
            {Object.keys(porCarrera).length === 0 && (
              <p className="text-slate-500 italic">Cargue el padrón QUINTTOS para ver estadísticas.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderAlumnos = () => (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Padrón de Alumnos y Analíticos</h2>
          <p className="text-slate-500 text-sm">Sincronice el padrón e importe notas para generar certificados.</p>
        </div>

        {(user.role === 'admin' || user.role === 'staff') && (
          <div className="flex items-center justify-end gap-3 flex-wrap">
            <button
              onClick={async () => {
                if (!confirm('¿Quitar todos los acentos de los nombres y apellidos de la base de datos?')) return;
                setIsUploading(true);
                try {
                  await fetch(`${API_URL}/api/students/remove-accents?user=${encodeURIComponent(user?.email || 'Sistema')}`, { method: 'POST' });
                  await fetchStudents();
                  alert('Acentos eliminados correctamente.');
                } catch (e) {
                  alert('Error eliminando acentos');
                } finally {
                  setIsUploading(false);
                }
              }}
              disabled={isUploading}
              className={`flex items-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-xl transition-all shadow ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Eliminar acentos de todos los alumnos"
            >
              <span className="font-bold text-sm leading-none">A^</span>
              <span>Limpiar Acentos</span>
            </button>
            <label className={`flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl cursor-pointer transition-all shadow ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <Upload className="w-4 h-4" />
              <span>Sincronizar QUINTTOS</span>
              <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleQuinttosUpload} disabled={isUploading} />
            </label>
            <button onClick={() => setImportConfig({ isOpen: true, mode: 'db' })} disabled={isUploading} className={`flex items-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-all shadow ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <Upload className="w-4 h-4" />
              <span>Importar Notas</span>
            </button>
            <button onClick={() => setImportConfig({ isOpen: true, mode: 'zip' })} disabled={isUploading} className={`flex items-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-all shadow ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <FileText className="w-4 h-4" />
              <span>Generar Analíticos ZIP</span>
            </button>
          </div>
        )}
      </div>

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
                <input required type="file" accept=".xlsx, .xls" name="excelFile" className="w-full border border-slate-200 rounded-xl p-2 focus:ring-2 outline-none focus:ring-blue-100" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Licencia Correspondiente</label>
                <select required name="licencia" className="w-full border border-slate-200 rounded-xl p-2.5 bg-white focus:ring-2 outline-none focus:ring-blue-100">
                  <option value="CB">Licencia CB</option>
                  <option value="A">Licencia A</option>
                  <option value="B">Licencia B</option>
                  <option value="PRO">Licencia PRO</option>
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
                <button type="submit" disabled={isUploading} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow shadow-blue-200">
                  {isUploading ? 'Procesando...' : (importConfig.mode === 'db' ? 'Subir Notas' : 'Crear ZIP')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-4 mb-2">
          <div className="relative shadow-sm rounded-xl flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nombre o DNI..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-900 outline-none transition-all bg-white font-medium"
            />
          </div>
          <div className="flex gap-3 shrink-0 overflow-x-auto pb-1 md:pb-0">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full md:w-auto md:min-w-[180px] h-full min-h-[56px] px-4 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-900 outline-none transition-all bg-white font-medium text-slate-700 cursor-pointer shadow-sm"
            >
              <option value="all">Todas las situaciones</option>
              {uniqueStatuses.map(st => (
                <option key={st as string} value={st as string}>{st as string}</option>
              ))}
            </select>
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 h-full min-h-[56px] px-5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl font-bold transition-all shadow-sm shrink-0 whitespace-nowrap"
              title="Exportar listado actual a Excel"
            >
              <FileSpreadsheet className="w-5 h-5" />
              <span className="hidden md:inline">Exportar Excel</span>
            </button>
          </div>
        </div>

        {/* LIST VIEW INSTED OF GRID */}
        <div className="flex flex-col space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredStudents.length > 0 ? (
              filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((student, idx) => (
                <motion.div
                  key={student.dni + idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onClick={() => setSelectedStudent(student)}
                  className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer group ${student.situacion === 'DUPLICADO'
                    ? 'bg-rose-50 border-rose-300 hover:border-rose-400 hover:shadow-md'
                    : 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300'
                    }`}
                >
                  {/* Left: Icon, Details */}
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl hidden sm:flex shrink-0 transition-colors ${student.situacion === 'DUPLICADO' ? 'bg-rose-100 group-hover:bg-rose-200' : 'bg-blue-50 group-hover:bg-blue-100'
                      }`}>
                      <User className={`w-5 h-5 ${student.situacion === 'DUPLICADO' ? 'text-rose-700' : 'text-blue-900'}`} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 mb-0.5 line-clamp-1">
                        {student.nombre} {student.situacion === 'DUPLICADO' && <span className="text-rose-600 text-sm ml-2">(DUPLICADO)</span>}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-slate-600 text-xs font-semibold mt-1">
                        <span className="flex items-center gap-1 text-slate-500">DNI: {student.dni}</span>
                        <span className="hidden sm:inline text-slate-300">•</span>
                        <span className="flex items-center gap-1 text-slate-500">MATRÍCULA: {student.dni}</span>
                        <span className="hidden sm:inline text-slate-300">•</span>
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded uppercase tracking-wider border border-slate-200">
                          LICENCIA {student.licencia || 'S/LI'}
                        </span>
                        <span className="hidden sm:inline text-slate-300">•</span>
                        <span className="text-blue-800 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wider border border-blue-100">
                          COMISIÓN {student.comision || '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between w-full md:w-auto gap-4 border-t md:border-0 pt-3 md:pt-0 border-slate-100">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold md:hidden lg:inline-block uppercase tracking-wider border ${student.estado_analitico === 'emitido' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      {student.estado_analitico === 'emitido' ? 'Emitido' : 'Borrador'}
                    </span>
                    {student.situacion && student.situacion !== 'DUPLICADO' && (
                      <span className="md:hidden lg:inline-block px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-indigo-100 whitespace-nowrap">
                        {student.situacion}
                      </span>
                    )}
                    {(!student.notas || student.notas.length === 0) && (
                      <span className="text-amber-700 font-bold text-xs bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-lg shadow-sm whitespace-nowrap">Esperando Notas</span>
                    )}

                    {/* Quick actions row */}
                    <div className="flex items-center gap-1 border-l pl-3 border-slate-100" onClick={(e) => e.stopPropagation()}>
                      {(user.role === 'admin' || user.role === 'staff') && (
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
                          className="p-2 text-blue-600 hover:bg-blue-50 hover:text-blue-800 rounded-lg transition-colors"
                          title="Descargar Analítico"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
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
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-900 outline-none cursor-pointer"
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
                <div className="px-4 py-2 bg-blue-50 text-blue-800 rounded-lg font-black text-sm border border-blue-100/50">
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

      {/* MODAL FICHA DEL ALUMNO */}
      <AnimatePresence>
        {selectedStudent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 shadow-2xl"
            onClick={() => setSelectedStudent(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-6 md:px-8 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                <div className="flex-1">
                  {!editingDatos ? (
                    <>
                      <h2 className="text-2xl font-black text-slate-900">{selectedStudent.nombre}</h2>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-slate-500 text-sm font-medium">
                        <span className="bg-white border border-slate-200 px-3 py-1 rounded shadow-sm">ID: {selectedStudent.dni}</span>
                        {selectedStudent.email && (
                          <span className="bg-white border border-slate-200 px-3 py-1 rounded shadow-sm">Email: {selectedStudent.email}</span>
                        )}
                        {(user?.role === 'admin' || user?.role === 'staff') && (
                          <button
                            onClick={startEditDatos}
                            className="text-blue-600 hover:text-blue-800 text-xs font-bold border border-blue-200 bg-blue-50 px-2 py-0.5 rounded transition-colors"
                          >
                            ✏️ Editar Datos
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Editando Datos Personales</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">ID / DNI</label>
                          <input
                            value={editDni}
                            onChange={e => setEditDni(e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-900 outline-none"
                            placeholder="Nro. documento"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Nombre</label>
                          <input
                            value={editNombre}
                            onChange={e => setEditNombre(e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-900 outline-none"
                            placeholder="Nombre(s)"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Apellido</label>
                          <input
                            value={editApellido}
                            onChange={e => setEditApellido(e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-900 outline-none"
                            placeholder="Apellido"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={saveDatos} className="bg-blue-900 hover:bg-blue-950 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-colors">Guardar</button>
                        <button onClick={() => setEditingDatos(false)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-1.5 rounded-lg text-sm font-bold transition-colors">Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-full transition-colors shrink-0 ml-4"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-blue-50 p-4 border border-blue-100 rounded-2xl">
                    <p className="text-[11px] font-black text-blue-500 uppercase tracking-widest">Licencia / Carrera</p>
                    <p className="font-bold text-slate-800 mt-1 text-base">{selectedStudent.licencia || 'NO ASIGNADA'}</p>
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
                  {(user?.role === 'admin' || user?.role === 'staff') && (
                    <button
                      onClick={() => setShowAddNota(prev => !prev)}
                      className="text-xs font-bold bg-blue-900 hover:bg-blue-950 text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      + Agregar Nota
                    </button>
                  )}
                </div>

                {showAddNota && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-widest">Nueva Materia / Nota</p>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="block text-xs text-slate-500 mb-1">Materia</label>
                        <input
                          value={newMateria}
                          onChange={e => setNewMateria(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-900 outline-none"
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
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-900 outline-none"
                          placeholder="8.5"
                        />
                      </div>
                      <button onClick={saveNotaManual} className="bg-blue-900 hover:bg-blue-950 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shrink-0">
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
                            const url = `${API_URL}/api/students/${selectedStudent.id}/nota?user=${encodeURIComponent(user?.email || 'Sistema')}`;
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
                              {(user?.role === 'admin' || user?.role === 'staff') ? (
                                <>
                                  <input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    max="10"
                                    value={pending !== undefined ? pending : (notaActual || '')}
                                    onChange={e => setPendingNotas(prev => ({ ...prev, [materia]: e.target.value }))}
                                    onKeyDown={e => { if (e.key === 'Enter') guardarNota(materia, pending ?? String(notaActual)); }}
                                    className={`w-16 text-center px-2 py-1 rounded-lg text-sm font-black border outline-none focus:ring-2 focus:ring-blue-900 transition-colors ${hasPending ? 'bg-yellow-100 border-yellow-400 text-yellow-900' : tiene ? 'bg-blue-50 text-blue-900 border-blue-200' : 'bg-red-50 text-red-500 border-red-200'}`}
                                    placeholder="0"
                                  />
                                  {hasPending && (
                                    <button
                                      onClick={() => guardarNota(materia, pending!)}
                                      disabled={isSaving}
                                      className="text-xs bg-blue-900 hover:bg-blue-950 text-white px-2 py-1 rounded-lg font-bold transition-colors disabled:opacity-50"
                                    >
                                      {isSaving ? '...' : '✓'}
                                    </button>
                                  )}
                                </>
                              ) : (
                                <span className={`w-10 text-center py-1 rounded font-black text-sm ${tiene ? 'bg-blue-100 text-blue-900' : 'bg-red-50 text-red-400'}`}>{notaActual || '-'}</span>
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
                            <span className="bg-blue-100 text-blue-900 w-10 text-center py-1 rounded font-black">{nota.nota}</span>
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
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-900 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Fecha de Emisión</label>
                      <input
                        type="date"
                        value={selectedStudent.fecha_emision || ''}
                        onChange={(e) => setSelectedStudent({ ...selectedStudent, fecha_emision: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-900 outline-none transition-all"
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
                            <span className="font-bold text-slate-700">{log.usuario}</span>
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
                <div className="flex items-center gap-3 w-full justify-end flex-wrap mt-2">
                  {/* Desmarcar Emitido — solo admin, solo cuando ya está emitido */}
                  {user.role === 'admin' && selectedStudent.estado_analitico === 'emitido' && (
                    <button
                      onClick={() => handleToggleEstado(selectedStudent.id as any)}
                      className="px-4 py-2.5 rounded-xl font-bold flex gap-2 items-center transition-all shadow-sm border bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300"
                      title="Revertir a Borrador (requiere justificación)"
                    >
                      ↩ Desmarcar Emitido
                    </button>
                  )}

                  {/* Eliminar notas — solo admin */}
                  {user.role === 'admin' && selectedStudent.notas && selectedStudent.notas.length > 0 && (
                    <button
                      onClick={() => handleDeleteNotas(selectedStudent.id as any)}
                      className="p-2.5 text-red-500 hover:bg-red-100 rounded-xl transition-colors border border-transparent hover:border-red-200"
                      title="Eliminar solo las notas (Quedar en Borrador)"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}

                  {/* Vista previa — no cambia el estado */}
                  <button
                    onClick={() => downloadPDF(selectedStudent)}
                    className="px-5 py-2.5 rounded-xl font-bold flex gap-2 items-center transition-all border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-900"
                    title="Abre el PDF para verlo, sin marcarlo como Emitido"
                  >
                    <Download className="w-4 h-4" /> Vista Previa
                  </button>

                  {/* Generar y Emitir — descarga y marca como emitido */}
                  <button
                    onClick={() => downloadPDFAndEmit(selectedStudent)}
                    className="bg-blue-900 hover:bg-blue-800 text-white px-6 py-2.5 rounded-xl font-bold flex gap-2 items-center transition-all shadow-md hover:shadow-lg"
                    title="Genera el PDF y marca el analítico como Emitido"
                  >
                    <Download className="w-5 h-5" /> Generar Analítico PDF
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const renderUsuarios = () => (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
      <h2 className="text-3xl font-bold text-slate-900">Gestión de Usuarios</h2>

      {/* Formulario crear operadora */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">➕ Crear Nueva Operadora</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Nombre</label>
            <input
              value={newUserNombre}
              onChange={e => setNewUserNombre(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-900 outline-none"
              placeholder="Ej: María González"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Email</label>
            <input
              type="email"
              value={newUserEmail}
              onChange={e => setNewUserEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-900 outline-none"
              placeholder="operadora@ejemplo.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Contraseña</label>
            <input
              type="text"
              value={newUserPassword}
              onChange={e => setNewUserPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-900 outline-none"
              placeholder="Contraseña temporal"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleCreateUser}
            className="bg-blue-900 hover:bg-blue-950 text-white px-6 py-2 rounded-lg text-sm font-bold transition-colors shadow"
          >
            Crear Operadora
          </button>
        </div>
        <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
          <strong>Permisos de Operadora:</strong> Ver alumnos · Descargar PDF analítico · Editar DNI / Nombre / Apellido · Cargar Fecha de Emisión
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
              <div key={u.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-xl ${u.role === 'admin' ? 'bg-blue-100' : 'bg-emerald-100'}`}>
                    <User className={`w-5 h-5 ${u.role === 'admin' ? 'text-blue-700' : 'text-emerald-700'}`} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{u.nombre}</p>
                    <p className="text-sm text-slate-500">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${u.role === 'admin' ? 'bg-blue-100 text-blue-900' : 'bg-emerald-100 text-emerald-700'}`}>
                    {u.role}
                  </span>
                  {u.role !== 'admin' && (
                    <button
                      onClick={() => handleDeleteUser(u.id)}
                      className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                      title="Eliminar usuario"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-slate-50 font-sans flex overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-72 bg-blue-950 flex flex-col shadow-2xl relative z-20 shrink-0">
        <div className="p-6 flex items-center gap-3 text-white border-b border-blue-900/50">
          <School className="w-9 h-9 text-blue-400 drop-shadow-md" />
          <span className="font-extrabold text-xl tracking-tight drop-shadow-sm">MARADONA MENOTTI</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-3">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-blue-800 text-white font-bold shadow-inner border border-blue-700/50' : 'text-blue-200/80 hover:bg-blue-900 hover:text-white font-medium'}`}
          >
            <LayoutDashboard className={`w-5 h-5 ${activeTab === 'dashboard' ? 'text-blue-300' : ''}`} />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('alumnos')}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all ${activeTab === 'alumnos' ? 'bg-blue-800 text-white font-bold shadow-inner border border-blue-700/50' : 'text-blue-200/80 hover:bg-blue-900 hover:text-white font-medium'}`}
          >
            <Users className={`w-5 h-5 ${activeTab === 'alumnos' ? 'text-blue-300' : ''}`} />
            Padrón de Alumnos
          </button>
          {user.role === 'admin' && (
            <button
              onClick={() => { setActiveTab('usuarios'); fetchAppUsers(); }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all ${activeTab === 'usuarios' ? 'bg-blue-800 text-white font-bold shadow-inner border border-blue-700/50' : 'text-blue-200/80 hover:bg-blue-900 hover:text-white font-medium'}`}
            >
              <User className={`w-5 h-5 ${activeTab === 'usuarios' ? 'text-blue-300' : ''}`} />
              Usuarios
            </button>
          )}
        </nav>

        <div className="p-5 bg-blue-900/50 mt-auto border-t border-blue-900">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 px-2">
              <div className="bg-blue-800 p-2.5 rounded-xl shadow-sm">
                <User className="w-5 h-5 text-blue-300" />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-semibold text-white truncate" title={user.name}>{user.name}</span>
                <span className="text-[11px] font-black uppercase text-blue-400 tracking-wider mt-0.5">{user.role}</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl transition-all border border-red-500/20"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-bold">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT HEADER + SCROLLABLE AREA */}
      <div className="flex-1 flex flex-col h-full bg-slate-50 min-w-0">
        <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center sticky top-0 z-10 shadow-sm">
          <h1 className="text-slate-800 text-2xl font-black tracking-tight">
            {activeTab === 'dashboard' ? 'Panel de Control' : activeTab === 'usuarios' ? 'Gestión de Usuarios' : 'Base de Datos de Alumnos'}
          </h1>
        </header>

        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto pb-12">
            {activeTab === 'dashboard' ? renderDashboard() : activeTab === 'usuarios' ? renderUsuarios() : renderAlumnos()}
          </div>
        </main>
      </div>

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
              <div className={`p-5 flex items-start gap-4 border-b border-slate-100 ${confirmModal.type === 'danger' ? 'bg-red-50' : confirmModal.type === 'warning' ? 'bg-amber-50' : 'bg-blue-50'}`}>
                <div className={`shrink-0 p-3 rounded-xl ${confirmModal.type === 'danger' ? 'bg-red-100 text-red-600' : confirmModal.type === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
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
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-900 outline-none transition-all shadow-sm"
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
                    confirmModal.onConfirm();
                  }}
                  className={`px-5 py-2.5 rounded-lg text-sm font-bold text-white transition-colors shadow-sm ${confirmModal.type === 'danger' ? 'bg-red-600 hover:bg-red-700' : confirmModal.type === 'warning' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
