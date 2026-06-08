import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { UploadCloud, FileText, CheckCircle, Download, Trash2, ArrowRight, Search, ArrowUpDown, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';

interface StudentData {
  [key: string]: any;
}

export default function AlumnosRecibidos() {
  const [baseFile, setBaseFile] = useState<File | null>(null);
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [processedData, setProcessedData] = useState<StudentData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc'|'desc' } | null>(null);
  const [showMissingDniOnly, setShowMissingDniOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, showMissingDniOnly, processedData]);

  const filteredAndSortedData = React.useMemo(() => {
    let result = [...processedData];
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(row => 
        Object.values(row).some(val => 
          String(val || '').toLowerCase().includes(lowerSearch)
        )
      );
    }
    if (showMissingDniOnly) {
      result = result.filter(row => !row['Documento'] || String(row['Documento']).trim() === '');
    }
    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = String(a[sortConfig.key] || '').toLowerCase();
        const bVal = String(b[sortConfig.key] || '').toLowerCase();
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [processedData, searchTerm, sortConfig]);

  const handleBaseFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setBaseFile(file);
      try {
        const data = await readExcel(file);
        const standardized = data.map(row => {
          const newRow = { ...row };
          const keys = Object.keys(newRow);
          const docKey = keys.find(k => ['documento', 'dni', 'id'].includes(k.toLowerCase().trim()));
          const val = docKey ? newRow[docKey] : '';
          
          if (docKey && docKey !== 'Documento') {
            delete newRow[docKey];
          }
          newRow['Documento'] = val;
          return newRow;
        });
        setProcessedData(standardized);
      } catch (err) {
        toast.error('Error al previsualizar el archivo base');
      }
    }
  };

  const handleReferenceFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setReferenceFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeReferenceFile = (index: number) => {
    setReferenceFiles(prev => prev.filter((_, i) => i !== index));
  };

  const processFiles = async () => {
    if (!baseFile) {
      toast.error('Por favor, sube un archivo base primero.');
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Leer el archivo base
      const baseData = await readExcel(baseFile);
      
      // 2. Leer todos los archivos de referencia y crear un mapa por email
      const referenceMap = new Map<string, StudentData>();
      
      for (const file of referenceFiles) {
        const data = await readExcel(file);
        data.forEach(row => {
          // Buscamos claves que puedan ser el email
          const emailKey = Object.keys(row).find(k => k.toLowerCase().includes('mail') || k.toLowerCase() === 'correo');
          if (emailKey && row[emailKey]) {
            const email = String(row[emailKey]).trim().toLowerCase();
            // Guardamos la fila completa en el mapa
            referenceMap.set(email, { ...(referenceMap.get(email) || {}), ...row });
          }
        });
      }

      // 3. Cruzar los datos
      const mergedData = baseData.map(baseRow => {
        const baseEmailKey = Object.keys(baseRow).find(k => k.toLowerCase().includes('mail') || k.toLowerCase() === 'correo');
        const email = baseEmailKey ? String(baseRow[baseEmailKey]).trim().toLowerCase() : null;

        if (email && referenceMap.has(email)) {
          const refRow = referenceMap.get(email)!;
          
          // Buscar columna de País
          const paisKey = Object.keys(refRow).find(k => k.toLowerCase() === 'país de residencia' || k.toLowerCase() === 'pais de residencia' || k.toLowerCase() === 'país' || k.toLowerCase() === 'pais');
          const idKey = Object.keys(refRow).find(k => ['id', 'documento', 'dni'].includes(k.toLowerCase().trim()));

          const newRow = { ...baseRow };
          const existingDoc = newRow['Documento'] || '';
          
          if (!existingDoc && idKey) {
            newRow['Documento'] = refRow[idKey];
          }
          if (!newRow['País de Residencia'] && paisKey) {
            newRow['País de Residencia'] = refRow[paisKey];
          }

          return newRow;
        }

        return baseRow;
      });

      setProcessedData(mergedData);
      toast.success('Datos procesados correctamente.');
    } catch (error) {
      console.error(error);
      toast.error('Error al procesar los archivos.');
    } finally {
      setIsProcessing(false);
    }
  };

  const readExcel = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet);
          resolve(json);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsBinaryString(file);
    });
  };

  const generatePDF = () => {
    if (filteredAndSortedData.length === 0) return;

    const doc = new jsPDF('landscape');
    
    // Título
    doc.setFontSize(18);
    doc.setTextColor(0, 45, 43); // #002d2b
    doc.text('Listado de Alumnos Recibidos', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generado el ${new Date().toLocaleDateString()}`, 14, 30);

    // Obtener columnas dinámicamente juntando todas las claves únicas
    const allKeys = Array.from(new Set(filteredAndSortedData.flatMap(row => Object.keys(row))));
    const columns = allKeys.map(key => ({
      header: key,
      dataKey: key
    }));

    autoTable(doc, {
      columns: columns,
      body: filteredAndSortedData,
      startY: 35,
      styles: {
        fontSize: 9,
        cellPadding: 4,
      },
      headStyles: {
        fillColor: [0, 45, 43], // #002d2b
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250],
      },
      margin: { top: 35 },
    });

    doc.save('alumnos_recibidos.pdf');
    toast.success('PDF generado exitosamente');
  };

  const generateExcel = () => {
    if (filteredAndSortedData.length === 0) return;

    const worksheet = XLSX.utils.json_to_sheet(filteredAndSortedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Alumnos");
    
    XLSX.writeFile(workbook, 'alumnos_recibidos.xlsx');
    toast.success('Excel generado exitosamente');
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-[#002d2b]">Validación de Alumnos Recibidos</h1>
        <p className="text-slate-500 mt-2">Cruza tus listados de Excel para completar los datos faltantes como País de Residencia e ID.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Archivo Base */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-start gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <UploadCloud size={24} />
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-800">1. Archivo Base</h3>
            <p className="text-sm text-slate-500 mb-4">Sube el Excel principal que contiene a los alumnos y los datos faltantes.</p>
          </div>
          <div className="w-full">
            <input
              type="file"
              id="base-file"
              accept=".xlsx, .xls"
              className="hidden"
              onChange={handleBaseFileUpload}
            />
            <label
              htmlFor="base-file"
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl p-4 text-slate-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all cursor-pointer"
            >
              <FileText size={20} />
              <span className="font-medium text-sm">Seleccionar Excel Base</span>
            </label>
          </div>
          {baseFile && (
            <div className="w-full flex items-center gap-2 bg-slate-50 p-3 rounded-lg text-sm border border-slate-200">
              <CheckCircle size={16} className="text-green-500" />
              <span className="font-medium text-slate-700 truncate flex-1">{baseFile.name}</span>
            </div>
          )}
        </div>

        {/* Archivos de Referencia */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-start gap-4">
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
            <UploadCloud size={24} />
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-800">2. Archivos de Referencia</h3>
            <p className="text-sm text-slate-500 mb-4">Sube uno o varios Excels donde el sistema buscará los datos faltantes (por email).</p>
          </div>
          <div className="w-full">
            <input
              type="file"
              id="ref-files"
              accept=".xlsx, .xls"
              multiple
              className="hidden"
              onChange={handleReferenceFilesUpload}
            />
            <label
              htmlFor="ref-files"
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl p-4 text-slate-600 hover:border-purple-500 hover:text-purple-600 hover:bg-purple-50 transition-all cursor-pointer"
            >
              <FileText size={20} />
              <span className="font-medium text-sm">Añadir Excels de Referencia</span>
            </label>
          </div>
          
          {referenceFiles.length > 0 && (
            <div className="w-full space-y-2 max-h-32 overflow-y-auto pr-2">
              {referenceFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg text-sm border border-slate-200">
                  <CheckCircle size={16} className="text-purple-500 flex-shrink-0" />
                  <span className="font-medium text-slate-700 truncate flex-1">{f.name}</span>
                  <button onClick={() => removeReferenceFile(i)} className="text-slate-400 hover:text-red-500 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-center gap-4">
        <button
          onClick={processFiles}
          disabled={!baseFile || referenceFiles.length === 0 || isProcessing}
          className="flex items-center gap-2 bg-[#002d2b] hover:bg-opacity-90 text-[#0ffff4] font-bold py-3 px-8 rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
        >
          {isProcessing ? 'Procesando...' : 'Cruzar Datos'}
          <ArrowRight size={20} />
        </button>
      </div>

      {/* Resultados */}
      {processedData.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-fade-in">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-bold text-lg text-slate-800">Vista Previa de Resultados</h3>
              <p className="text-sm text-slate-500">Revisa que los datos estén correctos antes de exportar.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={generateExcel}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-5 rounded-lg transition-all"
              >
                <FileSpreadsheet size={18} />
                Excel
              </button>
              <button
                onClick={generatePDF}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded-lg transition-all"
              >
                <Download size={18} />
                PDF
              </button>
            </div>
          </div>
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6">
              <div className="relative w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={16} className="text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Buscar alumnos..."
                  className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0ffff4]/50 focus:border-[#0ffff4] outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 select-none">
                <input 
                  type="checkbox" 
                  checked={showMissingDniOnly}
                  onChange={(e) => setShowMissingDniOnly(e.target.checked)}
                  className="rounded w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                Solo mostrar sin Documento
              </label>
            </div>
            <div className="text-sm text-slate-500">
              Mostrando {filteredAndSortedData.length} registros
            </div>
          </div>
          <div className="overflow-x-auto">
            {(() => {
              const allKeys = Array.from(new Set(filteredAndSortedData.flatMap(row => Object.keys(row))));
              
              const handleSort = (key: string) => {
                setSortConfig(prev => {
                  if (prev?.key === key) return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
                  return { key, direction: 'asc' };
                });
              };

              const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
              const paginatedData = filteredAndSortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

              return (
                <div className="w-full">
                  <table className="w-full text-left text-sm whitespace-nowrap table-fixed">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        {allKeys.map((key, index) => (
                          <th key={index} className="px-6 py-4 font-semibold truncate" style={{ width: `${100 / allKeys.length}%` }}>
                            <button onClick={() => handleSort(key)} className="flex items-center gap-1 hover:text-blue-600 transition-colors w-full overflow-hidden">
                              <span className="truncate">{key}</span>
                              <ArrowUpDown size={14} className="opacity-50 shrink-0" />
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedData.map((row, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-slate-50 transition-colors">
                          {allKeys.map((key, colIndex) => (
                            <td key={colIndex} className="px-6 py-4 text-slate-700 truncate" style={{ width: `${100 / allKeys.length}%` }}>
                              {String(row[key] || '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {totalPages > 1 && (
                    <div className="p-4 flex items-center justify-between bg-slate-50 border-t border-slate-100">
                      <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors"
                      >
                        Anterior
                      </button>
                      <span className="text-sm text-slate-600 font-medium">Página {currentPage} de {totalPages}</span>
                      <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors"
                      >
                        Siguiente
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
