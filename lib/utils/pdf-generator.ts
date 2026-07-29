// lib/utils/pdf-generator.ts

"use client";

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Hutang, Penghutang, Cicilan, Donatur, SystemConfig, PaymentItem } from '@/types';
import { formatCurrency, formatDate, terbilang, getToday, formatDateTime } from './formatters';

// ============================================================
// PDF GENERATOR ENGINE - WAZIQOH V5.0 (FIXED)
// ============================================================

const PRIMARY_GREEN = '#0f7b54';
const DARK_TEXT = '#1e293b';
const SLATE_TEXT = '#64748b';
const LIGHT_BG = '#f8fafc';
const BORDER_COLOR = '#e2e8f0';
const LIGHT_GREEN_BG = '#e8f5e9';

const LOGO_URL = 'https://dsjkuzirvaniunhwwnml.supabase.co/storage/v1/object/public/assets/iconkop.png';
const STAMP_URL = 'https://dsjkuzirvaniunhwwnml.supabase.co/storage/v1/object/public/assets/stamp.png';

type JsPdfWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

const getAutoTableFinalY = (doc: jsPDF, fallback: number): number =>
  (doc as JsPdfWithAutoTable).lastAutoTable?.finalY ?? fallback;


// ============================================================
// HELPERS - Image loading with aspect ratio preservation
// ============================================================

/**
 * Load image from URL and convert to base64
 * Returns { base64, width, height } for aspect ratio calculation
 */
const loadImageAsBase64 = async (url: string): Promise<{ base64: string; width: number; height: number } | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    // Get image dimensions for aspect ratio
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({ base64, width: img.width, height: img.height });
      };
      img.onerror = () => resolve(null);
      img.src = `data:image/png;base64,${base64}`;
    });
  } catch {
    return null;
  }
};

/**
 * Calculate image dimensions preserving aspect ratio
 * @param imgWidth - Original image width
 * @param imgHeight - Original image height  
 * @param maxWidth - Maximum allowed width
 * @param maxHeight - Maximum allowed height (priority constraint)
 * @returns { width, height } - Scaled dimensions
 */
const preserveAspectRatio = (
  imgWidth: number,
  imgHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } => {
  const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
  return {
    width: imgWidth * ratio,
    height: imgHeight * ratio,
  };
};

// ============================================================
// KOP SURAT - Desain sesuai gambar invoice donasi
// ============================================================
const addKopSurat = async (doc: jsPDF, config: SystemConfig, showPeriod: boolean = false): Promise<number> => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;

  let logoWidth = 0;
  let logoHeight = 0;
  
  // Logo - dengan rasio asli
  try {
    const logoData = await loadImageAsBase64(LOGO_URL);
    if (logoData) {
      const { width: logoW, height: logoH } = preserveAspectRatio(
        logoData.width,
        logoData.height,
        55,
        35
      );
      logoWidth = logoW;
      logoHeight = logoH;
      doc.addImage(logoData.base64, 'PNG', margin, 8, logoW, logoH);
    }
  } catch {
    // Skip logo if fails
  }

  const textStartX = logoWidth > 0 ? margin + logoWidth + 5 : margin + 24;
  
  doc.setFontSize(17);
  doc.setTextColor(PRIMARY_GREEN);
  doc.setFont('helvetica', 'bold');
  doc.text('BADAN OTONOM (BO) – WAZIQOH', textStartX, 12);

  doc.setFontSize(14);
  doc.setTextColor(DARK_TEXT);
  doc.setFont('helvetica', 'bold');
  doc.text('KELUARGA MAHASISWA BANTEN (KMB) MESIR', textStartX, 18);

  doc.setFontSize(10);
  doc.setTextColor(SLATE_TEXT);
  doc.setFont('helvetica', 'normal');
  doc.text(
    "Jl. 'Ainu Syams College, Gedung II, Lt. 3, No.5 Zahro, Nasr City, Kairo, Mesir",
    textStartX,
    24
  );

  doc.setFontSize(10);
  doc.setTextColor(DARK_TEXT);
  doc.setFont('helvetica', 'normal');
  doc.text('Email: waziqoh@gmail.com | Telp: (+20) 1507817887', textStartX, 29);

  const lineY = Math.max(logoHeight + 13, 30);
  doc.setDrawColor('#000000');
  doc.setLineWidth(0.1);
  doc.line(margin, lineY, pageWidth - margin, lineY);
  doc.setDrawColor('#000000');
  doc.setLineWidth(0.6);
  doc.line(margin, lineY + 1, pageWidth - margin, lineY + 1);

  // 🔥 FIX: Gunakan masa_jabatan, bukan periode
  if (showPeriod) {
    doc.setFontSize(8);
    doc.setTextColor(SLATE_TEXT);
    doc.setFont('helvetica', 'normal');
    doc.text(`Periode: ${config.masa_jabatan || ''}`, pageWidth / 2, lineY + 8, { align: 'center' });
    return lineY + 14;
  }

  return lineY + 8;
};

// ============================================================
// STAMP & TTD Helper
// ============================================================
const addStampAndTTD = async (
  doc: jsPDF,
  config: SystemConfig,
  nama: string,
  jabatan: string,
  x: number,
  y: number,
  ttdUrl?: string,
  withStamp: boolean = true
) => {
  doc.setFontSize(9);
  doc.setTextColor(DARK_TEXT);
  doc.setFont('helvetica', 'normal');

  if (ttdUrl) {
    try {
      const ttdData = await loadImageAsBase64(ttdUrl);
      if (ttdData) {
        const { width: ttdW, height: ttdH } = preserveAspectRatio(
          ttdData.width,
          ttdData.height,
          45,
          12
        );
        doc.addImage(ttdData.base64, 'PNG', x - ttdW / 2, y, ttdW, ttdH);
      }
    } catch {
      // Skip
    }
  }

  if (withStamp) {
    try {
      const stampData = await loadImageAsBase64(STAMP_URL);
      if (stampData) {
        const { width: stampW, height: stampH } = preserveAspectRatio(
          stampData.width,
          stampData.height,
          40,
          14
        );
        doc.addImage(stampData.base64, 'PNG', x - stampW / 2 - 22, y + 2, stampW, stampH);
      }
    } catch {
      // Skip stamp if fails
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(DARK_TEXT);
  doc.text(nama, x, y + 20, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(SLATE_TEXT);
  doc.text(jabatan, x, y + 25, { align: 'center' });
};

// ============================================================
// INVOICE DONASI - SUPPORT MULTIPLE CURRENCY (PREMIUM DESIGN)
// ============================================================
export const generateKwitansiPDF = async (donatur: Donatur, config: SystemConfig) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  // Kop Surat
  const startY = await addKopSurat(doc, config);

  // ============================================================
  // HEADER INVOICE
  // ============================================================
  let currentY = startY + 15;

  // Title - INVOICE (kiri)
  doc.setFontSize(26);
  doc.setTextColor(DARK_TEXT);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', margin, currentY);

  // Subtitle - OFFICIAL PAYMENT RECEIPT
  currentY += 7;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(PRIMARY_GREEN);
  doc.text('OFFICIAL PAYMENT RECEIPT', margin, currentY);

  // No. Invoice & Tanggal (kanan atas)
  doc.setFontSize(10);
  doc.setTextColor(DARK_TEXT);
  doc.setFont('helvetica', 'normal');
  doc.text('NO. INVOICE', pageWidth - margin, startY + 12, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(
    donatur.invoice_number || `INV/${formatDate(getToday()).replace(/\//g, '')}/${String(Math.floor(Math.random() * 900) + 100)}`,
    pageWidth - margin,
    startY + 17,
    { align: 'right' }
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(formatDate(donatur.timestamp || getToday()), pageWidth - margin, startY + 23, { align: 'right' });

  // ============================================================
  // DITERIMA DARI + BADGE METODE (Horizontal Layout)
  // ============================================================
  currentY += 15;
  
  // Label "Diterima dari :"
  doc.setFontSize(11);
  doc.setTextColor(DARK_TEXT);
  doc.setFont('helvetica', 'normal');
  doc.text('Diterima dari :', margin, currentY);

  currentY += 7;
  
  // === Nama Donatur (Kiri) ===
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(PRIMARY_GREEN);
  const namaText = `${donatur.nama} (${donatur.kekeluargaan || 'KMB'})`;
  doc.text(namaText, margin, currentY);

  // === Badge Metode (Kanan, Sejajar Vertikal) ===
  const metodeText = donatur.metode_pembayaran || 'TUNAI';
  const badgePadding = 10;
  const badgeFontSize = 9;
  doc.setFontSize(badgeFontSize);
  doc.setFont('helvetica', 'bold');
  const badgeTextWidth = doc.getTextWidth(metodeText);
  const badgeWidth = badgeTextWidth + badgePadding * 2;
  const badgeHeight = 10;
  
  // Position: right aligned with margin, vertically centered with nama
  const badgeX = pageWidth - margin - badgeWidth;
  const badgeY = currentY - 7; // Adjust to align with text baseline
  
  // Draw badge with rounded rectangle
  doc.setFillColor(15, 123, 84);
  doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 4, 4, 'F');
  
  // Badge text
  doc.setFontSize(badgeFontSize);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor('#FFFFFF');
  doc.text(metodeText, badgeX + badgePadding, badgeY + 7);

  // ============================================================
  // SPACER
  // ============================================================
  currentY += 14;

  // ============================================================
  // TABEL PEMBAYARAN
  // ============================================================
  const tableData = donatur.jenis_pembayaran.map((item: PaymentItem) => {
    let nominal = 0;
    let currency = 'EGP';
    
    if (item.nominal_egp > 0) {
      nominal = item.nominal_egp;
      currency = 'EGP';
    } else if (item.nominal_idr > 0) {
      nominal = item.nominal_idr;
      currency = 'IDR';
    } else if ((item.nominal_usd ?? 0) > 0) {
      nominal = item.nominal_usd ?? 0;
      currency = 'USD';
    }
    
    return [
      item.jenis || 'Pembayaran',
      formatCurrency(nominal, currency),
      currency,
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['Deskripsi Pembayaran', 'Nominal', 'Mata Uang']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [232, 245, 233],
      textColor: [15, 123, 84],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 11,
      lineWidth: 0.3,
      lineColor: [220, 220, 220],
    },
    bodyStyles: {
      fillColor: [245, 245, 245],
      fontSize: 11,
      textColor: DARK_TEXT,
      lineWidth: 0.3,
      lineColor: [220, 220, 220],
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 55 },
      2: { halign: 'center', cellWidth: 40 },
    },
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    styles: {
      font: 'helvetica',
      valign: 'middle',
      minCellHeight: 14,
    },
  });

  const finalY = getAutoTableFinalY(doc, currentY) + 18;

  // ============================================================
  // TOTAL PEMBAYARAN
  // ============================================================
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(DARK_TEXT);
  doc.text('TOTAL PEMBAYARAN', margin, finalY);

  // Build total text with all currencies
  const totalParts: string[] = [];
  if (donatur.total_egp > 0) {
    totalParts.push(formatCurrency(donatur.total_egp, 'EGP'));
  }
  if (donatur.total_idr > 0) {
    totalParts.push(formatCurrency(donatur.total_idr, 'IDR'));
  }
  if (donatur.total_usd > 0) {
    totalParts.push(formatCurrency(donatur.total_usd, 'USD'));
  }
  
  const totalText = totalParts.join(' | ') || formatCurrency(0, 'EGP');

  doc.setTextColor(PRIMARY_GREEN);
  doc.setFontSize(15);
  doc.text(totalText, pageWidth - margin, finalY, { align: 'right' });

  // ============================================================
  // TERBILANG - PRECISE AUTO-WRAP WITH EXACT HEIGHT
  // ============================================================
  const terbilangY = finalY + 14;
  
  // Build terbilang text
  const terbilangParts: string[] = [];
  if (donatur.total_egp > 0) {
    terbilangParts.push(`${terbilang(donatur.total_egp)} EGP`);
  }
  if (donatur.total_idr > 0) {
    terbilangParts.push(`${terbilang(donatur.total_idr)} IDR`);
  }
  if (donatur.total_usd > 0) {
    terbilangParts.push(`${terbilang(donatur.total_usd)} USD`);
  }
  
  const terbilangPrefix = 'Terbilang : ';
  const terbilangContent = terbilangParts.length > 0 
    ? terbilangParts.join(' DAN ') 
    : 'Nol';
  const terbilangFullText = terbilangPrefix + terbilangContent;

  // === CALCULATE EXACT DIMENSIONS ===
  const terbilangPadding = 5;
  const terbilangMaxWidth = contentWidth - terbilangPadding * 2;
  const terbilangFontSize = 11;
  const terbilangLineHeight = 5.5;
  
  doc.setFontSize(terbilangFontSize);
  doc.setFont('helvetica', 'normal');
  
  // Split text into lines
  const textLines = doc.splitTextToSize(terbilangFullText, terbilangMaxWidth);
  const actualLineCount = textLines.length;
  
  // Calculate EXACT height: padding top + (lines * lineHeight) + padding bottom
  const terbilangVerticalPadding = 4;
  const terbilangBoxHeight = (actualLineCount * terbilangLineHeight) + (terbilangVerticalPadding * 2);
  const minBoxHeight = 13;
  const finalBoxHeight = Math.max(minBoxHeight, terbilangBoxHeight);
  
  // === DRAW BACKGROUND ===
  doc.setFillColor(232, 245, 233);
  doc.rect(margin, terbilangY - terbilangVerticalPadding, contentWidth, finalBoxHeight, 'F');

  // === RENDER TEXT LINES ===
  const textStartX = margin + terbilangPadding;
  const textStartY = terbilangY + terbilangVerticalPadding;
  
  doc.setFontSize(terbilangFontSize);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(DARK_TEXT);
  
  textLines.forEach((line: string, index: number) => {
    doc.text(line, textStartX, textStartY + (index * terbilangLineHeight));
  });

  // === CALCULATE NEXT Y POSITION ===
  const terbilangEndY = terbilangY + finalBoxHeight + 10;

  // ============================================================
  // TANDA TANGAN
  // ============================================================
  const signY = terbilangEndY + 8;
  const ttdCenterX = pageWidth - margin - 35;
  
  // Garis tanda tangan
  doc.setDrawColor(BORDER_COLOR);
  doc.setLineWidth(0.2);
  doc.line(ttdCenterX - 35, signY - 5, pageWidth - margin, signY - 5);
  
  doc.setFontSize(11);
  doc.setTextColor(DARK_TEXT);
  doc.setFont('helvetica', 'normal');
  doc.text('Hormat kami,', ttdCenterX, signY, { align: 'center' });

  // TTD Direktur
  if (config.ttd_direktur_url) {
    try {
      const ttdData = await loadImageAsBase64(config.ttd_direktur_url);
      if (ttdData) {
        const { width: ttdW, height: ttdH } = preserveAspectRatio(
          ttdData.width,
          ttdData.height,
          70,
          25
        );
        const ttdX = ttdCenterX - ttdW / 2;
        doc.addImage(ttdData.base64, 'PNG', ttdX, signY + 4, ttdW, ttdH);
        
        const nameY = signY + 4 + ttdH + 7;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(DARK_TEXT);
        doc.text(config.ttd_direktur_nama || "Akfa Ma'rufa MS Hubballkhair", ttdCenterX, nameY, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(SLATE_TEXT);
        doc.text(config.ttd_direktur_jabatan || 'Direktur WAZIQOH KMB Mesir', ttdCenterX, nameY + 6, { align: 'center' });
      }
    } catch {
      // Skip TTD
    }
  }

  // STAMP
  try {
    const stampData = await loadImageAsBase64(STAMP_URL);
    if (stampData) {
      const { width: stampW, height: stampH } = preserveAspectRatio(
        stampData.width,
        stampData.height,
        38,
        22
      );
      const stampX = ttdCenterX - stampW - 12;
      doc.addImage(stampData.base64, 'PNG', stampX, signY + 6, stampW, stampH);
    }
  } catch {
    // Skip stamp
  }

  // ============================================================
  // FOOTER
  // ============================================================
  const footerY = Math.min(signY + 200, 285);
  doc.setDrawColor(BORDER_COLOR);
  doc.setLineWidth(0.2);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

  doc.setFontSize(7);
  doc.setTextColor(SLATE_TEXT);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'KWITANSI INI ADALAH BUKTI PEMBAYARAN SAH BADAN OTONOM WAZIQOH KMB MESIR',
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );

  doc.save(`Kwitansi_${donatur.invoice_number || 'donasi'}.pdf`);
};

// ============================================================
// INVOICE CICILAN - Ukuran kecil 100x190mm
// ============================================================
export const generateInvoiceCicilan = async (
  cicilan: Cicilan,
  hutang: Hutang,
  penghutang: Penghutang,
  sisaSebelum: number,
  sisaSetelah: number,
  config: SystemConfig
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [100, 190],
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;

  let logoBottomY = 7;
  try {
    const logoData = await loadImageAsBase64(LOGO_URL);
    if (logoData) {
      const { width: logoW, height: logoH } = preserveAspectRatio(
        logoData.width,
        logoData.height,
        53,
        23
      );
      const logoX = (pageWidth - logoW) / 2;
      doc.addImage(logoData.base64, 'PNG', logoX, 7, logoW, logoH);
      logoBottomY = 7 + logoH + 3;
    }
  } catch {
    // Skip logo
  }

  const titleY = logoBottomY + 5;
  doc.setFontSize(15);
  doc.setTextColor(PRIMARY_GREEN);
  doc.setFont('helvetica', 'bold');
  doc.text('PEMBAYARAN BERHASIL', pageWidth / 2, titleY, { align: 'center' });

  let currentY = titleY + 10;
  const labelX = margin;
  const valueX = pageWidth - margin;
  const lineHeight = 6;

  doc.setTextColor(DARK_TEXT);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('No. Invoice', labelX, currentY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(cicilan.id_cicilan || `CCL/${formatDate(getToday()).replace(/\//g, '')}/${String(Math.floor(Math.random() * 900) + 100)}`, valueX, currentY, { align: 'right' });

  currentY += lineHeight;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Tanggal', labelX, currentY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(formatDate(cicilan.tanggal_bayar || getToday()), valueX, currentY, { align: 'right' });

  currentY += lineHeight;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Nama', labelX, currentY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(penghutang.nama_lengkap, valueX, currentY, { align: 'right' });

  currentY += 8;
  doc.setDrawColor(BORDER_COLOR);
  doc.setLineWidth(0.2);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  currentY += 7;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(DARK_TEXT);
  doc.text('Detail Transaksi', margin, currentY);

  currentY += 5;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Rincian Pembiayaan', labelX, currentY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(hutang.rincian_hutang || '-', valueX, currentY, { align: 'right' });

  currentY += 5;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Akad', labelX, currentY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(hutang.jenis_akad || '-', valueX, currentY, { align: 'right' });

  currentY += 5;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Jatuh Tempo', labelX, currentY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(formatDate(hutang.tanggal_jatuh_tempo || getToday()), valueX, currentY, { align: 'right' });

  currentY += 8;
  doc.setDrawColor(BORDER_COLOR);
  doc.setLineWidth(0.2);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  currentY += 7;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(DARK_TEXT);
  doc.text('Rincian Pembayaran', margin, currentY);

  currentY += 5;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Metode', labelX, currentY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(cicilan.metode_bayar || 'Tunai', valueX, currentY, { align: 'right' });

  currentY += 5;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Nominal Bayar', labelX, currentY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(PRIMARY_GREEN);
  doc.text(formatCurrency(cicilan.nominal_bayar, cicilan.mata_uang || 'EGP'), valueX, currentY, { align: 'right' });

  currentY += 5;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(DARK_TEXT);
  doc.text('Sisa Sebelum', labelX, currentY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(formatCurrency(sisaSebelum, cicilan.mata_uang || 'EGP'), valueX, currentY, { align: 'right' });

  currentY += 5;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Sisa Setelah', labelX, currentY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const sisaColor = sisaSetelah <= 0 ? PRIMARY_GREEN : '#d97706';
  doc.setTextColor(sisaColor);
  doc.text(formatCurrency(Math.max(0, sisaSetelah), cicilan.mata_uang || 'EGP'), valueX, currentY, { align: 'right' });

  let afterPaymentY = currentY + 10;
  if (sisaSetelah <= 0) {
    doc.setFontSize(12);
    doc.setTextColor(PRIMARY_GREEN);
    doc.setFont('helvetica', 'bold');
    doc.text('LUNAS', pageWidth / 2, afterPaymentY, { align: 'center' });
    afterPaymentY += 8;
  }

  const signY = afterPaymentY + 2;

  if (config.ttd_direktur_url) {
    try {
      const ttdData = await loadImageAsBase64(config.ttd_direktur_url);
      if (ttdData) {
        const { width: ttdW, height: ttdH } = preserveAspectRatio(
          ttdData.width,
          ttdData.height,
          40,
          17
        );
        const ttdX = (pageWidth - ttdW) / 2;
        doc.addImage(ttdData.base64, 'PNG', ttdX, signY, ttdW, ttdH);
      }
    } catch {
      // Skip
    }
  }

  try {
    const stampData = await loadImageAsBase64(STAMP_URL);
    if (stampData) {
      const { width: stampW, height: stampH } = preserveAspectRatio(
        stampData.width,
        stampData.height,
        23,
        12
      );
      const stampX = (pageWidth / 2) - stampW - 4;
      doc.addImage(stampData.base64, 'PNG', stampX, signY + 1, stampW, stampH);
    }
  } catch {
    // Skip
  }

  const nameY = signY + 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(DARK_TEXT);
  doc.text(config.ttd_direktur_nama || "Akfa Ma'rufa MS Hubballkhair", pageWidth / 2, nameY, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(SLATE_TEXT);
  doc.text(config.ttd_direktur_jabatan || 'Direktur WAZIQOH KMB Mesir', pageWidth / 2, nameY + 4, { align: 'center' });

  const footerY = nameY + 16;
  doc.setFontSize(6);
  doc.setTextColor(SLATE_TEXT);
  doc.setFont('helvetica', 'normal');
  doc.text('Terima kasih telah membayar tepat waktu', pageWidth / 2, footerY, { align: 'center' });
  doc.text('Wassalamualaikum warahmatullahi wabarakatuh', pageWidth / 2, footerY + 4, { align: 'center' });

  doc.save(`Invoice_${cicilan.id_cicilan || 'pembayaran'}.pdf`);
};

// ============================================================
// SURAT PERJANJIAN AKAD SYARIAH - V2.1 OPTIMIZED
// Format: A4 Portrait, margin 2.5cm, font 12pt
// ============================================================

export const generateSuratPerjanjian = async (
  hutang: Hutang,
  penghutang: Penghutang,
  cicilanList: Cicilan[],
  config: SystemConfig
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 25; // 2.5cm
  const contentWidth = pageWidth - (margin * 2); // 160mm
  const lineHeight = 5.5; // ~12pt dengan line spacing 1.15
  const indent = 7; // indent untuk sub-poin

  // ============================================================
  // KONSTANTA FONT HELPERS
  // ============================================================
  const setNormal = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor('#1a1a1a');
  };

  const setBold = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor('#1a1a1a');
  };

  const setItalic = () => {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(12);
    doc.setTextColor('#1a1a1a');
  };

  // ============================================================
  // HELPER: Render teks dengan justify
  // ============================================================
  const renderText = (
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    options?: { bold?: boolean; italic?: boolean; align?: 'left' | 'center' | 'right' | 'justify' }
  ): number => {
    if (options?.bold) setBold();
    else if (options?.italic) setItalic();
    else setNormal();

    const lines = doc.splitTextToSize(text, maxWidth);
    lines.forEach((line: string, idx: number) => {
      doc.text(line, x, y + (idx * lineHeight), {
        maxWidth,
        align: options?.align || 'justify',
      });
    });

    return y + (lines.length * lineHeight);
  };

  // ============================================================
  // HELPER: Render paragraf
  // ============================================================
  const renderParagraph = (
    text: string,
    y: number,
    options?: { bold?: boolean; italic?: boolean; indent?: number }
  ): number => {
    const x = margin + (options?.indent || 0);
    const maxW = contentWidth - (options?.indent || 0);
    return renderText(text, x, y, maxW, { ...options, align: 'justify' });
  };

  // ============================================================
  // HELPER: Render list item dengan prefix
  // ============================================================
  const renderListItem = (
    prefix: string,
    text: string,
    y: number,
    options?: { prefixBold?: boolean; textBold?: boolean; indent?: number }
  ): number => {
    const baseIndent = options?.indent || 0;
    const prefixWidth = doc.getTextWidth(prefix + ' ');
    const textX = margin + baseIndent + prefixWidth;
    const textMaxW = contentWidth - baseIndent - prefixWidth;

    if (options?.prefixBold) setBold();
    else setNormal();
    doc.text(prefix + ' ', margin + baseIndent, y);

    if (options?.textBold) setBold();
    else setNormal();

    const lines = doc.splitTextToSize(text, textMaxW);
    lines.forEach((line: string, idx: number) => {
      const lineX = idx === 0 ? textX : margin + baseIndent + prefixWidth;
      doc.text(line, lineX, y + (idx * lineHeight), {
        maxWidth: textMaxW,
        align: 'justify',
      });
    });

    return y + (lines.length * lineHeight);
  };

  // ============================================================
  // HELPER: Render list item dengan bold pada kata tertentu
  // ============================================================
  const renderListItemWithBold = (
    prefix: string,
    parts: { text: string; bold?: boolean }[],
    y: number,
    options?: { indent?: number }
  ): number => {
    const baseIndent = options?.indent || 0;
    const prefixWidth = doc.getTextWidth(prefix + ' ');
    const textX = margin + baseIndent + prefixWidth;
    const textMaxW = contentWidth - baseIndent - prefixWidth;

    setBold();
    doc.text(prefix + ' ', margin + baseIndent, y);

    let currentX = textX;
    let currentY = y;
    let lineWidth = 0;

    parts.forEach((part) => {
      if (part.bold) setBold();
      else setNormal();

      const words = part.text.split(' ');
      words.forEach((word, wIdx) => {
        const space = wIdx > 0 ? ' ' : '';
        const wordWidth = doc.getTextWidth(space + word);

        if (lineWidth + wordWidth > textMaxW && lineWidth > 0) {
          currentY += lineHeight;
          currentX = textX;
          lineWidth = 0;
        }

        doc.text(space + word, currentX, currentY);
        currentX += wordWidth;
        lineWidth += wordWidth;
      });
    });

    return currentY + lineHeight;
  };

  // ============================================================
  // HELPER: Render bold inline (teks campur normal & bold)
  // ============================================================
  const renderBoldInline = (
    parts: { text: string; bold?: boolean }[],
    x: number,
    y: number,
    maxWidth: number
  ): number => {
    let currentX = x;
    let currentY = y;
    let lineWidth = 0;

    parts.forEach((part) => {
      if (part.bold) setBold();
      else setNormal();

      const words = part.text.split(' ');
      words.forEach((word, wIdx) => {
        const space = wIdx > 0 ? ' ' : '';
        const wordWidth = doc.getTextWidth(space + word);

        if (lineWidth + wordWidth > maxWidth && lineWidth > 0) {
          currentY += lineHeight;
          currentX = x;
          lineWidth = 0;
        }

        doc.text(space + word, currentX, currentY);
        currentX += wordWidth;
        lineWidth += wordWidth;
      });
    });

    return currentY + lineHeight;
  };

  // ============================================================
  // HALAMAN 1 - KOP, JUDUL, PEMBUKA, DATA, PASAL 1
  // ============================================================
  let y = await addKopSurat(doc, config);
  y += 8;

  // --- JUDUL ---
  setBold();
  doc.setFontSize(14);
  doc.text('SURAT AKAD PEMBIAYAAN SYARIAH', pageWidth / 2, y, { align: 'center' });

  y += 8;
  setItalic();
  doc.setFontSize(12);
  doc.text('Bismillaahirrahmaanirrahim', pageWidth / 2, y, { align: 'center' });

  // --- PEMBUKA ---
  y += 12;
  y = renderParagraph('Yang bertanda tangan di bawah ini:', y);

  y += lineHeight;
  y = renderBoldInline(
    [
      { text: 'I. ', bold: true },
      { text: 'WAZIQOH KMB MESIR, berkedudukan di Kairo, Republik Arab Mesir, dalam hal ini diwakili oleh ' },
      { text: (config.ttd_direktur_jabatan || 'Direktur WAZIQOH KMB Mesir'), bold: true },
      { text: ' selaku pihak yang bertindak untuk dan atas nama Pemberi Pembiayaan, selanjutnya disebut ' },
      { text: 'PIHAK PERTAMA.', bold: true },
    ],
    margin,
    y,
    contentWidth
  );

  y += lineHeight;
  y = renderParagraph('II. Data Penerima Pembiayaan:', y, { bold: true });

  // --- DATA PENGHUTANG ---
  y += lineHeight * 0.5;

  const dataItems = [
    { label: 'Nama Lengkap', value: penghutang.nama_lengkap },
    { label: 'Alamat di Mesir', value: penghutang.alamat_mesir || '-' },
    { label: 'Alamat di Indonesia', value: penghutang.alamat_indonesia || '-' },
    { label: 'No. WhatsApp Pribadi', value: penghutang.no_wa_pribadi || '-' },
    { label: 'No. WhatsApp Kerabat', value: penghutang.no_wa_kerabat || '-' },
    { label: 'No. Telp Seluler', value: penghutang.no_telp_seluler || '-' },
  ];

  const maxLabelWidth = Math.max(...dataItems.map(d => doc.getTextWidth(d.label))) + 5;

  dataItems.forEach((item) => {
    setNormal();
    doc.text(`• ${item.label}`, margin + indent, y);
    setBold();
    doc.text(`: ${item.value}`, margin + indent + maxLabelWidth, y);
    y += lineHeight;
  });

  y += lineHeight * 0.5;
  y = renderBoldInline(
    [
      { text: 'Dalam hal ini bertindak atas nama diri sendiri selaku Penerima Pembiayaan, yang selanjutnya disebut ' },
      { text: 'PIHAK KEDUA.', bold: true },
    ],
    margin,
    y,
    contentWidth
  );

  y += lineHeight;
  y = renderParagraph('Para Pihak sepakat untuk mengadakan Perjanjian Pembiayaan Syariah berdasarkan ketentuan-ketentuan berikut:', y);

  // --- PASAL 1 ---
  y += lineHeight;
  setBold();
  doc.text('PASAL 1', margin, y);
  y += lineHeight;
  doc.text('RINCIAN PEMBIAYAAN DAN AKAD', margin, y);
  y += lineHeight * 1.5;

  // AYAT 1: PIHAK PERTAMA menyalurkan Fasilitas Pembiayaan
  y = renderListItem('1.', 'PIHAK PERTAMA menyalurkan Fasilitas Pembiayaan kepada PIHAK KEDUA berdasarkan kesepakatan akad syariah dengan rincian sebagai berikut:', y, { prefixBold: true });

  y += lineHeight * 0.3;

  // --- TABEL RINCIAN PEMBIAYAAN ---
  const rincianItems = [
    { label: 'Rincian', value: hutang.rincian_hutang || '-' },
    { label: 'Akad', value: hutang.jenis_akad || '-' },
    { label: 'Nominal Pokok', value: formatCurrency(hutang.nominal_pokok || 0, hutang.mata_uang) },
    { label: 'Nominal Wajib', value: formatCurrency(hutang.nominal_total || 0, hutang.mata_uang) },
    { label: 'Jatuh Tempo', value: formatDate(hutang.tanggal_jatuh_tempo) },
  ];

  const maxRincianLabelWidth = Math.max(...rincianItems.map(d => doc.getTextWidth(d.label))) + 5;

  rincianItems.forEach((item) => {
    setNormal();
    doc.text(`• ${item.label}`, margin + indent + 3, y);
    setBold();
    doc.text(`: ${item.value}`, margin + indent + 3 + maxRincianLabelWidth, y);
    y += lineHeight;
  });

  y += lineHeight * 0.5;

  // AYAT 2: Penjelasan Nominal Pokok dan Nominal Wajib
  const nominalPenjelasan = `Nominal Pokok adalah jumlah dana yang disalurkan PIHAK PERTAMA kepada PIHAK KEDUA sebagai pokok pembiayaan, sedangkan Nominal Wajib (${formatCurrency(hutang.nominal_total || 0, hutang.mata_uang)}) adalah keseluruhan kewajiban yang harus dikembalikan PIHAK KEDUA, yang telah mencakup nominal pokok beserta margin/nisbah keuntungan yang disepakati bersama.`;

  y = renderListItem('2.', nominalPenjelasan, y, { prefixBold: true });

  y += lineHeight * 0.5;

  // AYAT 3: PIHAK KEDUA mengakui
  y = renderListItem('3.', 'PIHAK KEDUA mengakui telah menerima fasilitas pembiayaan tersebut dan menyatakan sanggup serta bertanggung jawab penuh untuk mengembalikan seluruh Total Kewajiban Pelunasan sesuai ketentuan yang diatur dalam Surat Akad ini.', y, { prefixBold: true });

  // ============================================================
  // HALAMAN 2 - PASAL 2 dan PASAL 3
  // ============================================================
  doc.addPage();
  y = await addKopSurat(doc, config);
  y += 8;

  // --- PASAL 2 ---
  setBold();
  doc.text('PASAL 2', margin, y);
  y += lineHeight;
  doc.text('MEKANISME PELUNASAN', margin, y);
  y += lineHeight * 1.5;

  y = renderListItem('1.', 'PIHAK KEDUA berjanji dan mengikatkan diri untuk melakukan pengembalian seluruh Total Kewajiban Pelunasan sebagaimana dimaksud pada Pasal 1 Ayat 1 kepada PIHAK PERTAMA, yang dapat dilakukan secara dicicil maupun dilunasi sekaligus secara penuh paling lambat pada tanggal jatuh tempo yang ditentukan.', y, { prefixBold: true });

  y += lineHeight * 0.5;

  y = renderListItem('2.', 'Jumlah nominal Total Kewajiban Pelunasan yang tertulis dalam Surat Akad ini bersifat tetap (fixed) sesuai kesepakatan akad syariah yang sah dan tidak dapat diubah secara sepihak.', y, { prefixBold: true });

  // --- PASAL 3 ---
  y += lineHeight * 1.5;
  setBold();
  doc.text('PASAL 3', margin, y);
  y += lineHeight;
  doc.text('JAMINAN KTP INDONESIA DAN KETENTUAN PENGAMBILAN', margin, y);
  y += lineHeight * 1.5;

  // Ayat 1
  y = renderListItemWithBold(
    '1.',
    [
      { text: 'Sebagai jaminan komitmen, iktikad baik, dan kepatuhan pengembalian pembiayaan, PIHAK KEDUA ' },
      { text: 'WAJIB', bold: true },
      { text: ' menyerahkan Kartu Tanda Penduduk (KTP) Asli Indonesia milik PIHAK KEDUA kepada PIHAK PERTAMA untuk disimpan sampai seluruh kewajiban dinyatakan ' },
      { text: 'LUNAS.', bold: true },
    ],
    y
  );

  y += lineHeight * 0.5;
  y = renderListItem('2.', 'Penyerahan KTP Asli merupakan syarat mutlak sebelum pembiayaan dicairkan.', y, { prefixBold: true });

  y += lineHeight * 0.5;

  // Ayat 3
  y = renderListItemWithBold(
    '3.',
    [
      { text: 'KTP Asli yang ditahan oleh PIHAK PERTAMA ' },
      { text: 'BOLEH DIPINJAM ATAU DIAMBIL SEMENTARA', bold: true },
      { text: ' oleh PIHAK KEDUA hanya dalam kondisi mendesak/darurat, yaitu:' },
    ],
    y
  );

  y += lineHeight * 0.3;

  const kondisiDarurat = [
    { prefix: 'a.', text: 'Keperluan Ibadah Haji yang memerlukan verifikasi identitas resmi;' },
    { prefix: 'b.', text: 'Urusan administrasi darurat di KBRI Kairo atau Imigrasi Mesir yang tidak dapat diwakilkan;' },
    { prefix: 'c.', text: 'Kepulangan darurat ke Indonesia akibat musibah/kondisi mendesak keluarga di Indonesia, seperti: Orang tua/anggota keluarga inti meninggal dunia, keluarga terdekat sakit kritis/mewajibkan pendampingan, atau terkena bencana alam/musibah tak terduga di kampung halaman.' },
  ];

  kondisiDarurat.forEach((item) => {
    y = renderListItem(item.prefix, item.text, y, { indent: indent + 3 });
    y += lineHeight * 0.2;
  });

  y += lineHeight * 0.3;

  // Ayat 4
  y = renderListItemWithBold(
    '4.',
    [
      { text: 'KTP Asli ' },
      { text: 'TIDAK BOLEH DIAMBIL', bold: true },
      { text: ' apabila kepulangan ke Indonesia bertujuan untuk:' },
    ],
    y
  );

  y += lineHeight * 0.3;

  const larangan = [
    { prefix: 'a.', text: 'Liburan, rekreasi, jalan-jalan, atau kepentingan pribadi non-darurat lainnya;' },
    { prefix: 'b.', text: 'Kepulangan final (studi selesai/drop out) sebelum seluruh kewajiban pembiayaan dinyatakan LUNAS 100%.' },
  ];

  larangan.forEach((item) => {
    y = renderListItem(item.prefix, item.text, y, { indent: indent + 3 });
    y += lineHeight * 0.2;
  });

  y += lineHeight * 0.3;
  y = renderListItem('5.', 'Apabila KTP diambil sementara untuk keperluan mendesak sebagaimana dimaksud pada Ayat 3 Pasal ini, PIHAK KEDUA wajib memberikan jaminan pengganti sementara yang disetujui PIHAK PERTAMA dan berjanji mengembalikannya segera setelah urusan selesai.', y, { prefixBold: true });

  // ============================================================
  // HALAMAN 3 - PASAL 4, PENUTUP, TANDA TANGAN
  // ============================================================
  doc.addPage();
  y = await addKopSurat(doc, config);
  y += 8;

  // --- PASAL 4 ---
  setBold();
  doc.text('PASAL 4', margin, y);
  y += lineHeight;
  doc.text('WANPRESTASI DAN PENYELESAIAN PERSELISIHAN', margin, y);
  y += lineHeight * 1.5;

  y = renderListItem('1.', 'PIHAK KEDUA dinyatakan Cidera Janji (Wanprestasi) apabila tidak memenuhi kewajiban pembayaran/pelunasan sesuai jadwal yang disepakati, atau melanggar ketentuan penahanan jaminan.', y, { prefixBold: true });

  y += lineHeight * 0.5;
  y = renderListItem('2.', 'Apabila terjadi perselisihan sehubungan dengan akad perjanjian ini, kedua belah pihak bersepakat untuk menyelesaikannya secara musyawarah kekeluargaan.', y, { prefixBold: true });

  y += lineHeight * 0.5;
  y = renderListItem('3.', 'Apabila musyawarah tidak mencapai mufakat, para pihak bersepakat untuk memilih domisili hukum di Kepaniteraan Pengadilan Negeri terdekat yang berwenang di Indonesia.', y, { prefixBold: true });

  // --- PENUTUP ---
  y += lineHeight * 1.5;
  y = renderParagraph('Demikian Surat Akad Perjanjian Pembiayaan Syariah ini dibuat dalam rangkap 3 (tiga) asli, dan memiliki kekuatan hukum yang sah mengikat kedua belah pihak.', y);

  y += lineHeight;
  
  // Dibuat di dan Pada tanggal
  const penutupItems = [
    { label: 'Dibuat di', value: 'Kairo, Republik Arab Mesir' },
    { label: 'Pada tanggal', value: formatDate(getToday()) },
  ];

  const maxPenutupLabelWidth = Math.max(...penutupItems.map(d => doc.getTextWidth(d.label))) + 5;

  penutupItems.forEach((item) => {
    setNormal();
    doc.text(item.label, margin, y);
    setBold();
    doc.text(`: ${item.value}`, margin + maxPenutupLabelWidth, y);
    y += lineHeight * 1;
  });

  y += lineHeight * 0.5;

  // --- TANDA TANGAN ---
  y += lineHeight * 2;
  const signY = Math.min(y, 235);
  const leftX = margin + 30;
  const rightX = pageWidth - margin - 30;

  // PIHAK PERTAMA (Kiri)
  setNormal();
  doc.text('PIHAK PERTAMA', leftX, signY, { align: 'center' });
  doc.text('Pemberi Pembiayaan', leftX, signY + lineHeight, { align: 'center' });
  setBold();
  doc.text('WAZIQOH KMB MESIR', leftX, signY + (lineHeight * 2), { align: 'center' });

  // TTD Pihak Pertama
  if (config.ttd_direktur_url) {
    try {
      const ttdData = await loadImageAsBase64(config.ttd_direktur_url);
      if (ttdData) {
        const { width: ttdW, height: ttdH } = preserveAspectRatio(
          ttdData.width,
          ttdData.height,
          60,
          25
        );
        doc.addImage(ttdData.base64, 'PNG', leftX - ttdW / 2, signY + (lineHeight * 3) - 5, ttdW, ttdH);
      }
    } catch { /* skip */ }
  }

  // Nama Pihak Pertama
  setBold();
  doc.text(`( ${config.ttd_direktur_nama || "Akfa Ma'rufa MS Hubballkhair"} )`, leftX, signY + (lineHeight * 7), { align: 'center' });

  // PIHAK KEDUA (Kanan)
  setNormal();
  doc.text('PIHAK KEDUA', rightX, signY, { align: 'center' });
  doc.text('Penerima Pembiayaan', rightX, signY + lineHeight, { align: 'center' });

  // TTD Pihak Kedua
  if (penghutang.foto_ttd_url) {
    try {
      const ttdData = await loadImageAsBase64(penghutang.foto_ttd_url);
      if (ttdData) {
        const { width: ttdW, height: ttdH } = preserveAspectRatio(
          ttdData.width,
          ttdData.height,
          60,
          25
        );
        doc.addImage(ttdData.base64, 'PNG', rightX - ttdW / 2, signY + (lineHeight * 3) - 5, ttdW, ttdH);
      }
    } catch { /* skip */ }
  }

  // Nama Pihak Kedua
  setBold();
  doc.text(`( ${penghutang.nama_lengkap} )`, rightX, signY + (lineHeight * 7), { align: 'center' });

  // Save
  doc.save(`Surat_Perjanjian_${hutang.id_hutang}.pdf`);
};

// ============================================================
// LAPORAN REKAPITULASI
// ============================================================
export const generateLaporanRekapitulasi = async (
  data: Array<Record<string, unknown>>,
  title: string,
  config: SystemConfig,
  filterInfo: string
) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;

  const startY = await addKopSurat(doc, config, true);

  doc.setFontSize(14);
  doc.setTextColor(DARK_TEXT);
  doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), pageWidth / 2, startY + 12, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(SLATE_TEXT);
  doc.text(`Filter: ${filterInfo}`, pageWidth / 2, startY + 18, { align: 'center' });
  doc.text(`Dicetak: ${formatDateTime(new Date().toISOString())}`, pageWidth / 2, startY + 23, { align: 'center' });

  const tableStart = startY + 30;
  const headers = Object.keys(data[0] || {});
  
  const toCell = (value: unknown): string | number | boolean => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };
  const rows = data.map((row) => headers.map((header) => toCell(row[header])));

  autoTable(doc, {
    startY: tableStart,
    head: [headers],
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 123, 84],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: margin, right: margin },
  });

  const finalY = getAutoTableFinalY(doc, tableStart) + 20;
  doc.setFontSize(10);
  doc.setTextColor(DARK_TEXT);
  doc.setFont('helvetica', 'normal');
  doc.text(`Kairo, ${formatDate(getToday())}`, pageWidth - margin - 40, finalY, { align: 'center' });
  doc.text('Direktur WAZIQOH', pageWidth - margin - 40, finalY + 5, { align: 'center' });

  await addStampAndTTD(
    doc,
    config,
    config.ttd_direktur_nama || "Akfa Ma'rufa MS Hubballkhair",
    config.ttd_direktur_jabatan || 'Direktur WAZIQOH KMB Mesir',
    pageWidth - margin - 40,
    finalY + 8,
    config.ttd_direktur_url,
    true
  );

  doc.save(`Laporan_${title.replace(/\s/g, '_')}.pdf`);
};