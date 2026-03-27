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
}

const numberToWords = (n: number): string => {
  const words: Record<number, string> = {
    0: "CERO", 1: "UNO", 2: "DOS", 3: "TRES", 4: "CUATRO",
    5: "CINCO", 6: "SEIS", 7: "SIETE", 8: "OCHO", 9: "NUEVE", 10: "DIEZ"
  };
  return words[n] || n.toString();
};

export const LICENCIA_SUBJECTS: Record<string, string[]> = {
  // Licencia CB — materias exactas del certificado PDF
  "C": [
    "METODOLOGÍA DE LA ENSEÑANZA I",
    "TÉCNICA TÁCTICA Y ESTRATEGIA I",
    "MEDICINA I",
    "FÚTBOL Y CULTURA",
    "COMPETENCIAS PARA LA VIDA",
    "REGLAMENTO I"
  ],
  "B": [
    "METODOLOGÍA DE LA ENSEÑANZA II",
    "TÉCNICA TÁCTICA Y ESTRATEGIA II",
    "REGLAMENTO II",
    "PREPARACIÓN FÍSICA I",
    "MEDICINA II",
    "PLANIFICACIÓN DEL ENTRENAMIENTO I",
    "PSICOLOGÍA I",
    "ÉTICA Y VALORES",
    "HISTORIA DEL FÚTBOL ARGENTINO"
  ],
  "CB": [
    "METODOLOGÍA DE LA ENSEÑANZA I",
    "TÉCNICA TÁCTICA Y ESTRATEGIA I",
    "MEDICINA I",
    "FÚTBOL Y CULTURA",
    "COMPETENCIAS PARA LA VIDA",
    "REGLAMENTO I",
    "METODOLOGÍA DE LA ENSEÑANZA II",
    "TÉCNICA TÁCTICA Y ESTRATEGIA II",
    "REGLAMENTO II",
    "PREPARACIÓN FÍSICA I",
    "MEDICINA II",
    "PLANIFICACIÓN DEL ENTRENAMIENTO I",
    "PSICOLOGÍA I",
    "ÉTICA Y VALORES",
    "HISTORIA DEL FÚTBOL ARGENTINO"
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
    "REGLAMENTO III"
  ],
  "PRO": [
    "TÉCNICA, TÁCTICA Y ESTRATEGIA PRO",
    "PREPARACIÓN FÍSICA PRO",
    "PLANIFICACIÓN DEL ENTRENAMIENTO PRO",
    "DERECHO DEPORTIVO",
    "ADMINISTRACIÓN DEPORTIVA PRO",
    "DIRECCIÓN DE EQUIPOS PRO",
    "REGLAMENTO PRO",
    "MEDICINA PRO",
    "TECNOLOGÍA APLICADA",
    "PSICOLOGÍA PRO",
    "RECURSOS HUMANOS",
    "FÚTBOL INTERNACIONAL"
  ]
};

export const getSubjectsByLicencia = (licencia: string): string[] => {
  const lic = licencia?.toUpperCase().trim() || '';
  return LICENCIA_SUBJECTS[lic] || [];
};

export const generateAnaliticoPDF = (student: StudentData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Logo Placeholder (Simulating the M logo)
  doc.setFillColor(0, 0, 0);
  doc.rect(pageWidth / 2 - 10, 10, 20, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text("M", pageWidth / 2, 24, { align: "center" });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.text("MARADONA", pageWidth / 2, 32, { align: "center" });
  doc.text("MENOTTI", pageWidth / 2, 35, { align: "center" });

  // Title
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("CERTIFICADO ANALÍTICO", pageWidth / 2, 45, { align: "center" });
  doc.setLineWidth(0.5);
  doc.line(pageWidth / 2 - 25, 46, pageWidth / 2 + 25, 46);

  // Main Text
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const mainText = `La Escuela de Entrenadores César Luis Menotti, certifica según datos y documentación que ${student.nombre}, DNI ${student.dni} ha cursado y aprobado las siguientes materias correspondientes a la carrera de Entrenador Nacional de Fútbol, haciéndose acreedor al título de ENTRENADOR DE FUTBOL LICENCIA ${student.licencia}.`;
  const splitText = doc.splitTextToSize(mainText, pageWidth - 40);
  doc.text(splitText, 20, 55);

  // Table Data Preparation with Grouping
  const body: any[] = [];
  const licenseType = student.licencia.toUpperCase();

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

  if (licenseType === "CB") {
    addGroup("C");
    addGroup("B");
  } else if (licenseType === "BA" || licenseType === "B Y A") {
    addGroup("B");
    addGroup("A");
  } else if (licenseType === "A") {
    addGroup("A");
  } else if (licenseType === "PRO") {
    addGroup("PRO");
  } else {
    // Fallback for other types
    student.notas.forEach(n => {
      body.push([n.materia, n.nota.toString(), numberToWords(n.nota)]);
    });
  }

  // Table
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
    body: body,
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
      // Footer of the table
      const finalY = data.cursor?.y || 200;
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");

      doc.rect(20, finalY, pageWidth - 40, 7);
      doc.text("TOTAL HORAS PRÁCTICAS EN CAMPO", 25, finalY + 5);
      doc.text(student.horasPracticas || "-", pageWidth - 45, finalY + 5, { align: "right" });

      doc.rect(20, finalY + 7, pageWidth - 40, 7);
      doc.text("PROMEDIO GENERAL PRACTICAS", 25, finalY + 12);
      doc.text(student.promedio.toFixed(2), pageWidth - 45, finalY + 12, { align: "right" });
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 20;

  // Final Text
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const footerText = `En fe de lo cual se expide el presente certificado ORIGINAL sin raspaduras ni enmiendas en la ciudad de Buenos Aires a los ${new Date().getDate()} días del mes de ${new Date().toLocaleString('es-AR', { month: 'long' })} del año ${new Date().getFullYear()}.`;
  const splitFooter = doc.splitTextToSize(footerText, pageWidth - 40);
  doc.text(splitFooter, 20, finalY + 10);

  // Signature
  doc.setFontSize(10);
  doc.text("César Mario Menotti", pageWidth - 60, finalY + 40, { align: "center" });
  doc.text("Vicepresidente", pageWidth - 60, finalY + 45, { align: "center" });
  doc.text("17366697", pageWidth - 60, finalY + 50, { align: "center" });

  // Bottom Info
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text("SAN MARTIN 536 Piso 6 - Ciudad Autónoma de Buenos Aires, República Argentina – Teléfono 1143130221", pageWidth / 2, 285, { align: "center" });

  return doc;
};
