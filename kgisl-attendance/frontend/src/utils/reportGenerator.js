// Institutional PDF and CSV/Excel Report Generator Utility

export function generateInstitutionalCSV({ title = 'ATTENDANCE SUMMARY REPORT', period = 'Current Academic Term', department = 'Department of Computer Applications', batch = 'MCA-C', records = [] }) {
  const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  
  const headerRows = [
    `\uFEFFKGISL INSTITUTE OF INFORMATION MANAGEMENT`,
    `OFFICIAL INSTITUTIONAL ATTENDANCE REPORT`,
    `Title: ${title}`,
    `Period: ${period}`,
    `Department: ${department}`,
    `Batch: ${batch}`,
    `Generated On: ${dateStr}`,
    ``,
    `S.No,Roll No,Register No,Student Name,Total Sessions,Attended Sessions,Attendance %,Status,Eligibility Status`,
  ];

  const dataRows = records.length > 0
    ? records.map((r, idx) => {
        const pct = r.percentage ?? (r.attended && r.total ? Math.round((r.attended / r.total) * 100) : 85);
        const status = pct >= 75 ? 'SAFE (>=75%)' : 'SHORTAGE ALERT (<75%)';
        return `${idx + 1},"${r.rollNo || ''}","${r.regNo || ''}","${r.name || 'Student'}",${r.total || 40},${r.attended || 34},${pct}%,${r.status || 'PRESENT'},"${status}"`;
      })
    : [
        `1,"25MCA95","711725MCA095","SASIDHARAN G R",40,38,95%,PRESENT,"SAFE (>=75%)"`,
        `2,"25MCA01","711725MCA001","Aadhiran M",40,36,90%,PRESENT,"SAFE (>=75%)"`,
        `3,"25MCA12","711725MCA012","Bhavani K",40,34,85%,PRESENT,"SAFE (>=75%)"`,
        `4,"25MCA28","711725MCA028","Dinesh R",40,28,70%,ABSENT,"SHORTAGE ALERT (<75%)"`,
      ];

  const footerRows = [
    ``,
    `--- INSTITUTIONAL ENDORSEMENT ---`,
    `Prepared By: System Administrator`,
    `Verified By: Head of Department (HOD)`,
    `Approved By: Principal / Director`,
  ];

  return [...headerRows, ...dataRows, ...footerRows].join('\n');
}

export function downloadInstitutionalReport(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function printInstitutionalPDF({ title = 'ATTENDANCE REPORT', period = 'Current Academic Term', department = 'MCA Department', records = [] }) {
  const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const rows = records.length > 0 ? records : [
    { rollNo: '25MCA95', name: 'SASIDHARAN G R', total: 40, attended: 38, percentage: 95, status: 'SAFE' },
    { rollNo: '25MCA01', name: 'Aadhiran M', total: 40, attended: 36, percentage: 90, status: 'SAFE' },
    { rollNo: '25MCA12', name: 'Bhavani K', total: 40, attended: 34, percentage: 85, status: 'SAFE' },
    { rollNo: '25MCA28', name: 'Dinesh R', total: 40, attended: 28, percentage: 70, status: 'SHORTAGE' },
  ];

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title} - KGiSL-IIM</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #1e293b; background: #fff; }
        .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; }
        .header h1 { margin: 0; font-size: 22px; color: #0f172a; text-transform: uppercase; letter-spacing: 1px; }
        .header h2 { margin: 5px 0 0; font-size: 14px; color: #475569; font-weight: 500; }
        .meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
        th { background: #0f172a; color: #fff; text-transform: uppercase; font-size: 11px; }
        tr:nth-child(even) { background: #f8fafc; }
        .badge-safe { color: #166534; background: #dcfce7; padding: 3px 8px; border-radius: 4px; font-weight: bold; }
        .badge-shortage { color: #991b1b; background: #fee2e2; padding: 3px 8px; border-radius: 4px; font-weight: bold; }
        .signatures { margin-top: 60px; display: flex; justify-content: space-between; text-align: center; font-size: 12px; font-weight: bold; }
        .sig-box { width: 200px; border-top: 1px solid #0f172a; padding-top: 5px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>KGiSL Institute of Information Management</h1>
        <h2>${title} · ${department}</h2>
      </div>
      <div class="meta">
        <div><strong>Academic Period:</strong> ${period}</div>
        <div><strong>Generated Date:</strong> ${dateStr}</div>
        <div><strong>Institution Code:</strong> 7117 (KGiSL)</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>S.No</th>
            <th>Roll Number</th>
            <th>Student Name</th>
            <th>Total Sessions</th>
            <th>Attended</th>
            <th>Attendance %</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r, i) => `
            <tr>
              <td>${i + 1}</td>
              <td><strong>${r.rollNo}</strong></td>
              <td>${r.name}</td>
              <td>${r.total || 40}</td>
              <td>${r.attended || 34}</td>
              <td><strong>${r.percentage || 85}%</strong></td>
              <td><span class="${(r.percentage || 85) >= 75 ? 'badge-safe' : 'badge-shortage'}">${(r.percentage || 85) >= 75 ? 'SAFE (>=75%)' : 'SHORTAGE ALERT'}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="signatures">
        <div class="sig-box">Class In-Charge Signature</div>
        <div class="sig-box">HOD Signature</div>
        <div class="sig-box">Principal / Director Seal</div>
      </div>
      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}
