import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface StudentData {
  id?: string;
  nombre: string;
  dni: string;
  licencia: string; // CB, A, PRO, BA
  notas: { materia: string; nota: number; fecha?: string }[];
  promedio: number;
  fecha: string;
  horasPracticas?: string;
  comision?: string;
  quinttos_id?: number;
  matricula?: string;
  telefono?: string;
  datos_extra?: any;
}

const numberToWords = (n: number): string => {
  const words: Record<number, string> = {
    0: "CERO", 1: "UNO", 2: "DOS", 3: "TRES", 4: "CUATRO",
    5: "CINCO", 6: "SEIS", 7: "SIETE", 8: "OCHO", 9: "NUEVE", 10: "DIEZ"
  };
  return words[n] || n.toString();
};

const normalizeAcademicText = (value?: string | null): string =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace("LICENCIA ", "")
    .trim();

const isTrayectoria1Lic = (value?: string | null): boolean => {
  const lic = normalizeAcademicText(value);
  return lic === "BA"
    || lic === "B Y A"
    || lic === "TD1"
    || lic.includes("TRAYECTORIA DESTACADA I")
    || lic.includes("TRAYECTORIA DESTACADA 1")
    || lic.includes("TRAYECTORIA I")
    || lic.includes("TRAYECTORIA 1");
};

const isTrayectoria2Lic = (value?: string | null): boolean => {
  const lic = normalizeAcademicText(value);
  return lic === "TD2"
    || lic.includes("TRAYECTORIA DESTACADA II")
    || lic.includes("TRAYECTORIA DESTACADA 2")
    || lic.includes("TRAYECTORIA II")
    || lic.includes("TRAYECTORIA 2");
};

const isComision03 = (value?: string | null): boolean => {
  const comision = normalizeAcademicText(value);
  return comision === "3"
    || comision === "03"
    || /\bCOMISION\s*0?3\b/.test(comision);
};

export const getHorasPracticasByLicencia = (licencia?: string | null, comision?: string | null): string => {
  const lic = normalizeAcademicText(licencia || "CB");
  const combined = `${lic} ${normalizeAcademicText(comision)}`.trim();
  const isComision03Trayectoria2 = isTrayectoria2Lic(combined)
    && (isComision03(comision) || /\bCOMISION\s*0?3\b/.test(combined));

  if (isComision03Trayectoria2 || isTrayectoria1Lic(lic) || isTrayectoria2Lic(lic)) return "94";
  if (lic === "A") return "128";
  if (lic === "PRO") return "188";
  return "108";
};

export const LICENCIA_SUBJECTS: Record<string, string[]> = {
  // Licencia CB - materias exactas del certificado PDF
  "C": [
    "METODOLOGÍA DE LA ENSEÑANZA I",
    "TÉCNICA, TÁCTICA Y ESTRATEGIA I",
    "MEDICINA I",
    "FÚTBOL Y CULTURA",
    "COMPETENCIAS PARA LA VIDA",
    "REGLAMENTO I",
    "PROMEDIO GENERAL DE PRÁCTICAS"
  ],
  "B": [
    "METODOLOGÍA DE LA ENSEÑANZA II",
    "TÉCNICA, TÁCTICA Y ESTRATEGIA II",
    "REGLAMENTO II",
    "PREPARACIÓN FÍSICA I",
    "MEDICINA II",
    "PLANIFICACIÓN DEL ENTRENAMIENTO I",
    "PSICOLOGÍA I",
    "ÉTICA Y VALORES",
    "HISTORIA DEL FÚTBOL ARGENTINO",
    "PROMEDIO GENERAL DE PRÁCTICAS"
  ],
  "CB": [
    "METODOLOGÍA DE LA ENSEÑANZA I",
    "TÉCNICA, TÁCTICA Y ESTRATEGIA I",
    "MEDICINA I",
    "FÚTBOL Y CULTURA",
    "COMPETENCIAS PARA LA VIDA",
    "REGLAMENTO I",
    "METODOLOGÍA DE LA ENSEÑANZA II",
    "TÉCNICA, TÁCTICA Y ESTRATEGIA II",
    "REGLAMENTO II",
    "PREPARACIÓN FÍSICA I",
    "MEDICINA II",
    "PLANIFICACIÓN DEL ENTRENAMIENTO I",
    "PSICOLOGÍA I",
    "ÉTICA Y VALORES",
    "HISTORIA DEL FÚTBOL ARGENTINO",
    "PROMEDIO GENERAL DE PRÁCTICAS"
  ],
  "A": [
    "TÉCNICA, TÁCTICA Y ESTRATEGIA III",
    "PLANIFICACIÓN DEL ENTRENAMIENTO II",
    "DESARROLLO DE TALENTOS",
    "DIRECCIÓN DE JUGADORES Y EQUIPOS I",
    "DERECHO DEPORTIVO I",
    "ORGANIZACIÓN DEPORTIVA",
    "ADMINISTRACIÓN DEPORTIVA",
    "PREPARACIÓN FÍSICA II",
    "PSICOLOGÍA III",
    "MEDICINA III",
    "REGLAMENTO III",
    "PROMEDIO GENERAL DE PRÁCTICAS"
  ],
  "PRO": [
    "FÚTBOL INTERNACIONAL",
    "TÉCNICA, TÁCTICA Y ESTRATEGIA IV",
    "PREPARACIÓN FÍSICA III",
    "PLANIFICACIÓN DEL ENTRENAMIENTO III",
    "DERECHO DEPORTIVO II",
    "ADMINISTRACIÓN Y PLANEAMIENTO ESTRATÉGICO",
    "DIRECCIÓN DE JUGADORES Y EQUIPOS II",
    "REGLAMENTO PRO",
    "MEDICINA IV",
    "TECNOLOGÍA APLICADA",
    "PSICOLOGÍA IV",
    "RECURSOS HUMANOS",
    "PROMEDIO GENERAL DE PRÁCTICAS"
  ],
  "TD1": [
    "METODOLOGÍA DE LA ENSEÑANZA II",
    "TÉCNICA, TÁCTICA Y ESTRATEGIA II",
    "REGLAMENTO II",
    "PREPARACIÓN FÍSICA I",
    "MEDICINA II",
    "PLANIFICACIÓN DEL ENTRENAMIENTO I",
    "PSICOLOGÍA I",
    "ÉTICA Y VALORES",
    "HISTORIA DEL FÚTBOL ARGENTINO",
    "TÉCNICA, TÁCTICA Y ESTRATEGIA III",
    "PLANIFICACIÓN DEL ENTRENAMIENTO II",
    "DESARROLLO DE TALENTOS",
    "DIRECCIÓN DE JUGADORES Y EQUIPOS I",
    "DERECHO DEPORTIVO I",
    "ORGANIZACIÓN DEPORTIVA",
    "ADMINISTRACIÓN DEPORTIVA",
    "PREPARACIÓN FÍSICA II",
    "PSICOLOGÍA II",
    "MEDICINA III",
    "REGLAMENTO III",
    "PROMEDIO GENERAL DE PRÁCTICAS"
  ],
  "TD2": [
    "FÚTBOL INTERNACIONAL",
    "TÉCNICA, TÁCTICA Y ESTRATEGIA IV",
    "PREPARACIÓN FÍSICA III",
    "PLANIFICACIÓN DEL ENTRENAMIENTO III",
    "DERECHO DEPORTIVO II",
    "ADMINISTRACIÓN Y PLANEAMIENTO ESTRATÉGICO",
    "DIRECCIÓN DE JUGADORES Y EQUIPOS II",
    "REGLAMENTO PRO",
    "MEDICINA IV",
    "TECNOLOGÍA APLICADA",
    "PSICOLOGÍA IV",
    "RECURSOS HUMANOS",
    "PROMEDIO GENERAL DE PRÁCTICAS"
  ],
  "ACTUALIZACION": [],
  "SELECCIONES_NACIONALES": []
};

export const getSubjectsByLicencia = (licencia: string): string[] => {
  const lic = (licencia || '').toUpperCase().trim();
  if (!lic) return [];

  const isTrayectoria1 = lic === 'BA'
    || lic === 'B Y A'
    || lic.includes('TD1')
    || lic.includes('DESTACADA I')
    || lic.includes('DESTACADA 1')
    || lic.includes('TRAYECTORIA I')
    || lic.includes('TRAYECTORIA 1');
  const isTrayectoria2 = lic.includes('TD2')
    || lic.includes('DESTACADA II')
    || lic.includes('DESTACADA 2')
    || lic.includes('TRAYECTORIA II')
    || lic.includes('TRAYECTORIA 2');

  if (lic === 'PRO' || lic.includes('PROFESIONAL') || lic.includes('PRO ') || isTrayectoria2) return LICENCIA_SUBJECTS['PRO'];
  if (lic === 'CB' || lic.includes('COMBO') || (lic.includes('C') && lic.includes('B'))) return LICENCIA_SUBJECTS['CB'];
  if (isTrayectoria1) return LICENCIA_SUBJECTS['TD1'];
  if (isTrayectoria2) return LICENCIA_SUBJECTS['PRO'];
  if (lic.includes('ACTUALIZACION')) return LICENCIA_SUBJECTS['ACTUALIZACION'];
  if (lic.includes('SELECCIONES_NACIONALES')) return LICENCIA_SUBJECTS['SELECCIONES_NACIONALES'];
  if (lic === 'A' || lic.endsWith(' A') || lic.includes(' A ')) return LICENCIA_SUBJECTS['A'];
  if (lic === 'B' || lic.endsWith(' B') || lic.includes(' B ')) return LICENCIA_SUBJECTS['B'];
  if (lic === 'C' || lic.endsWith(' C') || lic.includes(' C ')) return LICENCIA_SUBJECTS['C'];

  return LICENCIA_SUBJECTS[lic] || [];
};

export const generateAnaliticoPDF = (student: StudentData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const horasPracticas = student.horasPracticas || getHorasPracticasByLicencia(student.licencia, student.comision);

  doc.setFillColor(0, 0, 0);
  doc.rect(pageWidth / 2 - 10, 10, 20, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text("M", pageWidth / 2, 24, { align: "center" });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.text("MARADONA", pageWidth / 2, 32, { align: "center" });
  doc.text("MENOTTI", pageWidth / 2, 35, { align: "center" });

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("CERTIFICADO ANALÍTICO", pageWidth / 2, 45, { align: "center" });
  doc.setLineWidth(0.5);
  doc.line(pageWidth / 2 - 25, 46, pageWidth / 2 + 25, 46);

  const licenseType = student.licencia.toUpperCase().trim();
  const isTrayectoria1 = licenseType === 'BA'
    || licenseType === 'B Y A'
    || licenseType.includes('TD1')
    || licenseType.includes('TRAYECTORIA DESTACADA I')
    || licenseType.includes('TRAYECTORIA DESTACADA 1')
    || licenseType.includes('TRAYECTORIA I')
    || licenseType.includes('TRAYECTORIA 1');
  const isTrayectoria2 = licenseType.includes('TD2')
    || licenseType.includes('TRAYECTORIA DESTACADA II')
    || licenseType.includes('TRAYECTORIA DESTACADA 2')
    || licenseType.includes('TRAYECTORIA II')
    || licenseType.includes('TRAYECTORIA 2');

  let displayLicense = student.licencia.toUpperCase();
  if (isTrayectoria2) displayLicense = 'PRO';
  if (isTrayectoria1) displayLicense = 'B Y A';

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const mainText = `La Escuela de Entrenadores César Luis Menotti, certifica según datos y documentación que ${student.nombre}, DNI ${student.dni} ha cursado y aprobado las siguientes materias correspondientes a la carrera de Entrenador Nacional de Fútbol, haciéndose acreedor al título de ENTRENADOR DE FUTBOL LICENCIA ${displayLicense}.`;
  const splitText = doc.splitTextToSize(mainText, pageWidth - 40);
  doc.text(splitText, 20, 55);

  const body: any[] = [];

  const addGroup = (level: string) => {
    const subjects = LICENCIA_SUBJECTS[level] || [];
    if (subjects.length > 0) {
      body.push([{ content: `LICENCIA ${level} -`, styles: { fontStyle: "bold", fillColor: [240, 240, 240] }, colSpan: 3 }]);
      subjects.forEach(sub => {
        const notaObj = student.notas.find(n => n.materia.toUpperCase() === sub.toUpperCase());
        if (notaObj) {
          body.push([sub, notaObj.nota.toString(), numberToWords(notaObj.nota)]);
        } else {
          body.push([sub, "-", "-"]);
        }
      });
    }
  };

  if (licenseType === "CB" || licenseType.includes('COMBO') || (licenseType.includes('C') && licenseType.includes('B'))) {
    addGroup("C");
    addGroup("B");
  } else if (isTrayectoria1) {
    addGroup("B");
    addGroup("A");
  } else if (licenseType === "A") {
    addGroup("A");
  } else if (licenseType === "PRO" || isTrayectoria2) {
    addGroup("PRO");
  } else {
    student.notas.forEach(n => {
      body.push([n.materia, n.nota.toString(), numberToWords(n.nota)]);
    });
  }

  autoTable(doc, {
    startY: 75,
    head: [
      [
        { content: "ASIGNATURAS", styles: { halign: "center" } },
        { content: "CALIFICACIONES", colSpan: 2, styles: { halign: "center" } }
      ],
      [
        "",
        { content: "EN Nº", styles: { halign: "center" } },
        { content: "EN LETRAS", styles: { halign: "center" } }
      ]
    ],
    body,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 40, halign: "center" }
    },
    didDrawPage: (data) => {
      const finalY = data.cursor?.y || 200;
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");

      doc.rect(20, finalY, pageWidth - 40, 7);
      doc.text("TOTAL HORAS PRÁCTICAS EN CAMPO", 25, finalY + 5);
      doc.text(horasPracticas, pageWidth - 45, finalY + 5, { align: "right" });

      doc.rect(20, finalY + 7, pageWidth - 40, 7);
      doc.text("PROMEDIO GENERAL PRACTICAS", 25, finalY + 12);
      doc.text(student.promedio.toFixed(2), pageWidth - 45, finalY + 12, { align: "right" });
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 20;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const footerText = `En fe de lo cual se expide el presente certificado ORIGINAL sin raspaduras ni enmiendas en la ciudad de Buenos Aires a los ${new Date().getDate()} días del mes de ${new Date().toLocaleString('es-AR', { month: 'long' })} del año ${new Date().getFullYear()}.`;
  const splitFooter = doc.splitTextToSize(footerText, pageWidth - 40);
  doc.text(splitFooter, 20, finalY + 10);

  doc.setFontSize(10);
  doc.text("César Mario Menotti", pageWidth - 60, finalY + 40, { align: "center" });
  doc.text("Vicepresidente", pageWidth - 60, finalY + 45, { align: "center" });
  doc.text("17366697", pageWidth - 60, finalY + 50, { align: "center" });

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text("SAN MARTIN 536 Piso 6 - Ciudad Autónoma de Buenos Aires, República Argentina - Teléfono 1143130221", pageWidth / 2, 285, { align: "center" });

  return doc;
};
