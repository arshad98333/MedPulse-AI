
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../services/firebase';
import { Loader2, ArrowLeft, Download, Mail, Ban, AlertTriangle, Check, FileText, Activity, Stethoscope, Utensils } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { DietCategory, DietItem } from '../types';

const THEME = {
  colors: {
    primary: [15, 23, 42], // Slate 900
    accent: [37, 99, 235], // Blue 600
    text: [30, 41, 59],
    lightGray: [241, 245, 249],
    white: [255, 255, 255],
    success: [22, 163, 74],
    warning: [234, 179, 8],
    danger: [220, 38, 38]
  }
};

const ReportView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [cloudUrl, setCloudUrl] = useState('');
  const [patientEmail, setPatientEmail] = useState('');

  useEffect(() => {
    const fetchReport = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'consultations', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const reportData = docSnap.data();
          setData(reportData);
          if (reportData.reportUrl) {
            setCloudUrl(reportData.reportUrl);
          }
          
          if (reportData.patientId) {
             const patientRef = doc(db, 'patients', reportData.patientId);
             const patientSnap = await getDoc(patientRef);
             if (patientSnap.exists()) {
                 const pData = patientSnap.data();
                 setPatientEmail(pData.email);
                 
                 // CRITICAL: Merge patient data into state to ensure Age/Gender availability
                 setData((prev: any) => ({
                    ...prev,
                    patientName: prev.patientName || pData.name,
                    patient: {
                        ...prev.patient,
                        age: pData.age ?? prev.patient?.age,
                        gender: pData.gender || prev.patient?.gender
                    }
                 }));
             }
          }
        }
      } catch (error) {
        console.error("Error fetching report:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [id]);

  const createPdfDoc = () => {
    if (!data) return null;
    const doc = new jsPDF();
    const { colors } = THEME;
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // --- HELPER FUNCTIONS ---
    const drawHeader = () => {
        // Top Bar
        doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
        doc.rect(0, 0, pageWidth, 25, 'F'); // Reduced height slightly
        
        // Logo / Title area
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text("MedPulse AI", 15, 14);
        doc.setFontSize(9);
        doc.setFont("courier", "normal");
        doc.text("CLINICAL REPORT", 15, 20);

        // Doctor Details
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Dr. Usman", pageWidth - 15, 10, { align: "right" });
        doc.setFont("courier", "normal");
        doc.setFontSize(8);
        doc.text("BAMS Generalist", pageWidth - 15, 15, { align: "right" });
        doc.text("Reg: MP-2024-8892", pageWidth - 15, 19, { align: "right" });
    };

    const drawFooter = (pageNumber: number, totalPages: number) => {
        doc.setPage(pageNumber);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`MedPulse AI Report | Page ${pageNumber} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: "center" });
    };

    // --- PAGE 1 CONTENT ---
    drawHeader();
    let yPos = 35; // Started higher up

    // 1. Patient Info (Compact)
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(252, 252, 252);
    doc.roundedRect(15, yPos, pageWidth - 30, 18, 2, 2, 'FD');
    
    const labelY = yPos + 5;
    const valY = yPos + 12;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text("PATIENT NAME", 20, labelY);
    doc.text("AGE / GENDER", 90, labelY);
    doc.text("DATE", 130, labelY);
    doc.text("ID", 170, labelY);

    doc.setFont("courier", "bold");
    doc.setFontSize(10);
    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.text(data.patientName || "Unknown", 20, valY);
    
    // Fallback logic for age/gender
    const age = data.patient?.age !== undefined ? data.patient.age : "--";
    const gender = data.patient?.gender ? data.patient.gender.charAt(0) : "-";
    doc.text(`${age} / ${gender}`, 90, valY);
    
    doc.text(new Date(data.date).toLocaleDateString(), 130, valY);
    doc.text(id?.substring(0, 6).toUpperCase() || "---", 170, valY);

    yPos += 24;

    // 2. Vitals
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(colors.accent[0], colors.accent[1], colors.accent[2]);
    doc.text("VITALS", 15, yPos);
    
    yPos += 4;
    const vitals = [
      { label: "BP", val: `${data.vitals?.bpSystolic}/${data.vitals?.bpDiastolic}`, unit: "mmHg" },
      { label: "Pulse", val: data.vitals?.pulse, unit: "bpm" },
      { label: "SpO2", val: data.vitals?.spo2, unit: "%" },
      { label: "Temp", val: data.vitals?.temperature, unit: "°C" },
      { label: "Weight", val: data.vitals?.weight, unit: "kg" },
    ];

    const boxWidth = (pageWidth - 30 - (4 * 3)) / 5; // fit 5 items
    vitals.forEach((v, i) => {
       const x = 15 + (i * (boxWidth + 3));
       doc.setDrawColor(230, 230, 230);
       doc.rect(x, yPos, boxWidth, 12); // Reduced height
       
       doc.setFont("helvetica", "bold");
       doc.setFontSize(6);
       doc.setTextColor(150, 150, 150);
       doc.text(v.label, x + 2, yPos + 4);
       
       doc.setFont("courier", "bold");
       doc.setFontSize(9);
       doc.setTextColor(0, 0, 0);
       doc.text(`${v.val || '--'}`, x + 2, yPos + 10);
       doc.setFontSize(6);
       doc.text(v.unit, x + boxWidth - 2, yPos + 10, {align: 'right'});
    });

    yPos += 18;

    // 3. Diagnosis & Notes
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(colors.accent[0], colors.accent[1], colors.accent[2]);
    doc.text("DIAGNOSIS & NOTES", 15, yPos);
    
    yPos += 3;
    doc.setDrawColor(colors.accent[0], colors.accent[1], colors.accent[2]);
    doc.setLineWidth(0.5);
    doc.line(15, yPos, pageWidth - 15, yPos);
    
    yPos += 6;
    doc.setFont("courier", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(data.finalDiagnosis?.toUpperCase() || "PENDING EVALUATION", 15, yPos);
    
    yPos += 5;
    if (data.treatmentNotes) {
        doc.setFont("courier", "normal");
        doc.setFontSize(9);
        doc.setTextColor(50, 50, 50);
        
        // JUSTIFIED TEXT
        // Note: jsPDF text with maxWidth and align justify works in newer versions
        // If exact justify fails, it falls back to left, but maxWidth handles wrapping
        doc.text(data.treatmentNotes, 15, yPos, { 
            maxWidth: pageWidth - 30, 
            align: "justify" 
        });
        
        // Calculate height taken by text
        const dim = doc.getTextDimensions(data.treatmentNotes, { maxWidth: pageWidth - 30 });
        yPos += dim.h + 5;
    } else {
        yPos += 5;
    }

    // 4. Rx Section
    yPos += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.text("Rx", 15, yPos);
    
    yPos += 5;
    // Rx Header
    doc.setFillColor(240, 240, 240);
    doc.rect(15, yPos, pageWidth - 30, 6, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    doc.text("MEDICINE", 18, yPos + 4);
    doc.text("DOSAGE", 80, yPos + 4);
    doc.text("FREQUENCY", 120, yPos + 4);
    doc.text("NOTES", 150, yPos + 4);
    
    yPos += 7;
    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);

    if (data.medicines && data.medicines.length > 0) {
        data.medicines.forEach((med: any) => {
             // Check for page break
             if (yPos > pageHeight - 30) {
                 doc.addPage();
                 drawHeader();
                 yPos = 35;
             }

             doc.text(med.name || "--", 18, yPos + 4);
             doc.text(med.dosage || "--", 80, yPos + 4);
             doc.text(med.frequency || "--", 120, yPos + 4);
             doc.text(med.notes || "--", 150, yPos + 4);
             
             doc.setDrawColor(240, 240, 240);
             doc.setLineWidth(0.1);
             doc.line(15, yPos + 6, pageWidth - 15, yPos + 6);
             yPos += 7;
        });
    } else {
        doc.text("No medicines prescribed.", 18, yPos + 4);
        yPos += 7;
    }

    // 5. Diet Prescription
    let hasDiet = false;
    let filteredDietPlan: DietCategory[] = [];
    if (data.dietPlan && data.dietPlan.length > 0) {
        filteredDietPlan = data.dietPlan.map((cat: DietCategory) => ({
            ...cat,
            items: cat.items.filter(item => item.selected !== false)
        })).filter((cat: DietCategory) => cat.items.length > 0);
        hasDiet = filteredDietPlan.length > 0;
    }

    if (hasDiet) {
        yPos += 8;
        // Smart Page Break: If remaining space is small (< 50mm), push to new page.
        // Otherwise start here to fit on 2 pages.
        if (yPos > pageHeight - 60) {
            doc.addPage();
            drawHeader();
            yPos = 35;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
        doc.text("DIET PRESCRIPTION", pageWidth / 2, yPos, { align: "center" });
        yPos += 8;

        // 4-Column Grid Logic
        const colCount = 4;
        const colWidth = (pageWidth - 30) / colCount;
        const xPositions = [15, 15 + colWidth, 15 + (colWidth * 2), 15 + (colWidth * 3)];
        
        let colIndex = 0;
        let rowStartY = yPos;
        let maxYInRow = yPos;

        filteredDietPlan.forEach((cat) => {
            const currentX = xPositions[colIndex];
            let currentY = rowStartY;

            // Cat Header
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7);
            doc.setTextColor(colors.accent[0], colors.accent[1], colors.accent[2]);
            const catNameLines = doc.splitTextToSize(cat.category.toUpperCase(), colWidth - 4);
            doc.text(catNameLines, currentX, currentY);
            currentY += (catNameLines.length * 3) + 2;

            // Items
            doc.setFont("courier", "normal");
            doc.setFontSize(6);
            
            cat.items.forEach((item) => {
                 let marker = "[ ]";
                 if (item.status === 'allowed') {
                     doc.setTextColor(colors.success[0], colors.success[1], colors.success[2]);
                     marker = "[/]";
                 } else if (item.status === 'limited') {
                     doc.setTextColor(colors.warning[0], colors.warning[1], colors.warning[2]);
                     marker = "[!]";
                 } else {
                     doc.setTextColor(colors.danger[0], colors.danger[1], colors.danger[2]);
                     marker = "[X]";
                 }
                 
                 // Truncate if too long
                 const itemName = item.name.length > 22 ? item.name.substring(0, 20) + '..' : item.name;
                 doc.text(`${marker} ${itemName}`, currentX, currentY);
                 currentY += 3;
            });

            if (currentY > maxYInRow) maxYInRow = currentY;

            colIndex++;
            if (colIndex >= colCount) {
                colIndex = 0;
                rowStartY = maxYInRow + 6; // Start next row below the tallest column
                // Check if we need a page break within the grid
                if (rowStartY > pageHeight - 20) {
                     doc.addPage();
                     drawHeader();
                     rowStartY = 35;
                     maxYInRow = 35;
                }
            }
        });
        
        yPos = maxYInRow + 10;
    }

    // 6. Lifestyle & Signature
    // If not enough space for signature block (approx 35mm needed), add page
    if (yPos > pageHeight - 35) {
        doc.addPage();
        drawHeader();
        yPos = 35;
    }

    if (data.lifestyle?.exercise) {
        doc.setDrawColor(colors.accent[0], colors.accent[1], colors.accent[2]);
        doc.roundedRect(15, yPos, pageWidth - 30, 14, 2, 2, 'S');
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(colors.accent[0], colors.accent[1], colors.accent[2]);
        doc.text("LIFESTYLE ADVICE", 18, yPos + 5);
        
        doc.setFont("courier", "bold");
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text(data.lifestyle.exercise, 18, yPos + 10);
        yPos += 20;
    } else {
        yPos += 10;
    }

    // Signature - positioned at bottom right relative to current content
    doc.setFont("helvetica", "italic");
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("Dr. Usman", pageWidth - 30, yPos + 5, { align: 'center' });
    
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(pageWidth - 50, yPos + 7, pageWidth - 10, yPos + 7);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text("Doctor's Signature", pageWidth - 30, yPos + 11, { align: 'center' });

    // Page Numbers
    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
        drawFooter(i, pageCount);
    }

    return doc;
  };

  const handleDownload = () => {
    const pdf = createPdfDoc();
    if (pdf) {
      pdf.save(`MedPulse_Report_${data.patientName.replace(/\s+/g, '_')}.pdf`);
    }
  };

  const handleUploadToCloud = async () => {
    const pdf = createPdfDoc();
    if (!pdf || !id) return null;
    setUploading(true);
    try {
      const blob = pdf.output('blob');
      const filename = `reports/${data.patientId}/${id}_${Date.now()}.pdf`;
      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      await updateDoc(doc(db, 'consultations', id), { reportUrl: downloadURL });
      setCloudUrl(downloadURL);
      return downloadURL;
    } catch (error) {
      console.error("Upload failed", error);
      alert('Failed to upload report.');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleEmailReport = async () => {
    if (!patientEmail) return alert("No email found.");
    setEmailing(true);
    try {
        let reportLink = cloudUrl;
        if (!reportLink) {
            const url = await handleUploadToCloud();
            if (!url) { setEmailing(false); return; }
            reportLink = url;
        }
        await addDoc(collection(db, 'mail'), {
            to: [patientEmail],
            message: {
                subject: `Prescription - Dr. Usman`,
                html: `<p>Dear ${data.patientName},</p><p>Please find your prescription attached.</p><p><a href="${reportLink}">Download Prescription PDF</a></p><p>Regards,<br>Dr. Usman</p>`
            }
        });
        alert(`Email sent to ${patientEmail}`);
    } catch (error) {
        console.error(error);
        alert("Email failed.");
    } finally {
        setEmailing(false);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={40}/></div>;
  if (!data) return <div className="p-10 text-center">Report not found</div>;

  // Filter for Web View
  const filteredDietPlanForWeb = (data.dietPlan || [])
     .map((cat: DietCategory) => ({
         ...cat,
         items: cat.items.filter(item => item.selected !== false)
     }))
     .filter((cat: DietCategory) => cat.items.length > 0);

  return (
    <div className="p-8 max-w-5xl mx-auto min-h-screen pb-20 bg-slate-50">
      <div className="flex items-center justify-between mb-8 print:hidden">
         <button onClick={() => navigate('/reports')} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-medium">
            <ArrowLeft size={20} /> Back to Reports
         </button>
         <div className="flex gap-3">
             <button onClick={handleEmailReport} disabled={emailing} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 font-medium transition-all shadow-sm">
                {emailing ? <Loader2 size={18} className="animate-spin"/> : <Mail size={18} />} Email
             </button>
             <button onClick={handleDownload} className="flex items-center gap-2 px-4 py-2 bg-[#0A6DD8] text-white rounded-lg hover:bg-blue-700 font-medium transition-all shadow-md">
                <Download size={18} /> Download PDF
             </button>
         </div>
      </div>

      {/* WEB PREVIEW AREA */}
      <div className="bg-white shadow-xl rounded-lg overflow-hidden max-w-[210mm] mx-auto min-h-[297mm] flex flex-col font-sans border border-slate-200">
         {/* HEADER */}
         <div className="bg-slate-900 text-white p-6 border-b-4 border-blue-600">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">MedPulse AI</h1>
                    <p className="font-mono text-xs opacity-80 mt-1">CLINICAL REPORT</p>
                </div>
                <div className="text-right">
                    <h2 className="text-lg font-bold">Dr. Usman</h2>
                    <p className="font-mono text-xs opacity-70">BAMS Generalist</p>
                    <p className="font-mono text-xs opacity-70">Reg: MP-2024-8892</p>
                </div>
            </div>
         </div>

         {/* BODY */}
         <div className="p-6 space-y-6 flex-1">
            {/* Patient Info */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Patient Name</p>
                    <p className="font-mono font-bold text-sm text-slate-900">{data.patientName}</p>
                 </div>
                 <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Age / Gender</p>
                    <p className="font-mono text-sm text-slate-900">{data.patient?.age || '--'} / {data.patient?.gender?.charAt(0) || '-'}</p>
                 </div>
                 <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Date</p>
                    <p className="font-mono text-sm text-slate-900">{new Date(data.date).toLocaleDateString()}</p>
                 </div>
                 <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">ID</p>
                    <p className="font-mono text-sm text-slate-900">{id?.substring(0,6).toUpperCase()}</p>
                 </div>
            </div>

            {/* Vitals Grid */}
            <div>
                <h3 className="flex items-center gap-2 font-bold text-blue-700 mb-3 border-b border-slate-100 pb-1 text-sm">
                    <Activity size={16} /> VITALS
                </h3>
                <div className="grid grid-cols-5 gap-2">
                    {[
                        { l: 'BP', v: `${data.vitals?.bpSystolic}/${data.vitals?.bpDiastolic}`, u: 'mmHg' },
                        { l: 'Pulse', v: data.vitals?.pulse, u: 'bpm' },
                        { l: 'SpO2', v: data.vitals?.spo2, u: '%' },
                        { l: 'Temp', v: data.vitals?.temperature, u: '°C' },
                        { l: 'Weight', v: data.vitals?.weight, u: 'kg' }
                    ].map((item, i) => (
                        <div key={i} className="bg-white border border-slate-200 p-2 rounded text-center shadow-sm">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{item.l}</p>
                            <p className="font-mono font-bold text-sm text-slate-800">{item.v || '--'} <span className="text-[10px] font-normal text-slate-400">{item.u}</span></p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Diagnosis */}
            <div>
                <h3 className="flex items-center gap-2 font-bold text-blue-700 mb-3 border-b border-slate-100 pb-1 text-sm">
                    <Stethoscope size={16} /> DIAGNOSIS
                </h3>
                <div className="pl-3 border-l-4 border-blue-500 py-1 bg-blue-50/30">
                    <p className="font-mono font-bold text-base text-slate-900">{data.finalDiagnosis || 'Evaluation Pending'}</p>
                </div>
                {data.treatmentNotes && (
                    <p className="mt-2 font-mono text-xs text-slate-600 bg-slate-50 p-2 rounded text-justify leading-relaxed">
                        {data.treatmentNotes}
                    </p>
                )}
            </div>

            {/* Medicines Prescription */}
            <div>
                <h3 className="flex items-center gap-2 font-bold text-blue-700 mb-3 border-b border-slate-100 pb-1 text-sm">
                    <FileText size={16} /> Rx (PRESCRIPTION)
                </h3>
                <div className="overflow-hidden border border-slate-200 rounded-lg">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-100 text-slate-500 font-bold uppercase text-[10px]">
                            <tr>
                                <th className="px-3 py-2 text-left">Medicine</th>
                                <th className="px-3 py-2 text-left">Dosage</th>
                                <th className="px-3 py-2 text-left">Frequency</th>
                                <th className="px-3 py-2 text-left">Notes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {data.medicines?.map((med: any, i: number) => (
                                <tr key={i} className="hover:bg-slate-50 font-mono text-xs text-slate-800">
                                    <td className="px-3 py-2 font-bold">{med.name}</td>
                                    <td className="px-3 py-2">{med.dosage}</td>
                                    <td className="px-3 py-2">{med.frequency}</td>
                                    <td className="px-3 py-2 text-slate-500">{med.notes}</td>
                                </tr>
                            ))}
                            {(!data.medicines || data.medicines.length === 0) && (
                                <tr>
                                    <td colSpan={4} className="px-3 py-3 text-center text-slate-400 italic text-xs">No medicines prescribed.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Diet Grid (Web View - 4 Columns) */}
            {filteredDietPlanForWeb.length > 0 && (
                <div className="break-before-page">
                    <h3 className="flex items-center gap-2 font-bold text-blue-700 mb-4 border-b border-slate-100 pb-1 text-sm mt-6">
                        <Utensils size={16} /> DIET PRESCRIPTION
                    </h3>
                    <div className="grid grid-cols-4 gap-3">
                       {filteredDietPlanForWeb.map((cat: DietCategory, i: number) => (
                           <div key={i} className="border border-slate-100 rounded p-2 bg-slate-50/50">
                               <p className="font-bold text-[9px] text-blue-600 uppercase mb-1.5 tracking-wider truncate">{cat.category}</p>
                               <div className="space-y-1">
                                   {cat.items.map((item: DietItem, j: number) => {
                                       let colorClass = "text-slate-300";
                                       let icon = null;
                                       if (item.status === 'allowed') { colorClass = "text-green-700 font-bold"; icon = <Check size={8} />; }
                                       else if (item.status === 'limited') { colorClass = "text-orange-600"; icon = <AlertTriangle size={8} />; }
                                       else if (item.status === 'avoid') { colorClass = "text-red-600"; icon = <Ban size={8} />; }
                                       
                                       return (
                                           <div key={j} className={`flex items-center gap-1 text-[9px] font-mono ${colorClass}`}>
                                               {icon}
                                               <span className="truncate">{item.name}</span>
                                           </div>
                                       );
                                   })}
                               </div>
                           </div>
                       ))}
                    </div>
                </div>
            )}
            
            {/* Signature Block */}
            <div className="mt-8 flex justify-end">
                <div className="text-center">
                     <div className="font-serif italic text-lg text-slate-800 mb-1">Dr. Usman</div>
                     <div className="w-32 h-px bg-slate-300"></div>
                     <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wide">Doctor's Signature</p>
                </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default ReportView;
