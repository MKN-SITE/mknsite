"use client";

import React, { useRef } from "react";
import { INSPECTION_CATEGORIES, type InspectionCategoryKey } from "./inspeksi-templates";
import styles from "./inspeksi-pdf-view.module.css";

export interface InspeksiPdfData {
  id?: number | string;
  category: InspectionCategoryKey;
  quarter: string; // e.g. "Q2"
  year: string | number; // e.g. "2026"
  inspectionDate: string;
  location?: string;
  serialOrRegNo?: string;
  itemSubtype?: string;
  inspectorName?: string;
  inspectorId?: string;
  inspectorPosition?: string;
  supervisorName?: string;
  supervisorId?: string;
  supervisorPosition?: string;
  toolInChargeName?: string;
  toolInChargeId?: string;
  toolInChargePosition?: string;
  isSafeToUse?: boolean | "ya" | "tidak";
  notes?: string;
  actionTaken?: string;
  photos?: string[];
  items?: Array<{
    no?: number;
    description?: string;
    merkType?: string;
    unit?: string;
    qty?: string | number;
    condition?: "good" | "enough" | "broken" | "ok" | "not_ok" | "memuaskan" | "tidak_memuaskan" | string;
    remarks?: string;
    categoryGroup?: string;
    personil?: string;
    badgeNo?: string;
    lockSerial?: string;
    helm?: boolean;
    kacamata?: boolean;
    earplug?: boolean;
    rompi?: boolean;
    sepatu?: boolean;
    kapan?: string;
    photoUrl?: string;
  }>;
}

interface InspeksiPdfViewProps {
  data: InspeksiPdfData;
  onClose?: () => void;
}

export function InspeksiPdfView({ data, onClose }: InspeksiPdfViewProps) {
  const meta = INSPECTION_CATEGORIES[data.category] || INSPECTION_CATEGORIES.tools;
  const printRef = useRef<HTMLDivElement | null>(null);

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = data.inspectionDate
    ? new Date(data.inspectionDate).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric"
      })
    : "";

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.topControlBar}>
        <div className={styles.barTitle}>
          <span>📄 Preview Dokumen Standar {meta.docNo}</span>
          <span className={styles.badge}>{data.quarter} {data.year}</span>
        </div>
        <div className={styles.barActions}>
          <button type="button" onClick={handlePrint} className={styles.btnPrint}>
            🖨️ Cetak / Simpan PDF
          </button>
          {onClose && (
            <button type="button" onClick={onClose} className={styles.btnClose}>
              ✕ Tutup
            </button>
          )}
        </div>
      </div>

      <div className={styles.sheetContainer}>
        {/* Printable Document Sheet 1: Inspection Form */}
        <div className={styles.documentSheet} ref={printRef}>
          {/* Header */}
          <div className={styles.docHeader}>
            <div className={styles.companyBox}>
              <div className={styles.logoMkn}>
                <div className={styles.logoDots}>
                  <span className={styles.dot1}></span>
                  <span className={styles.dot2}></span>
                  <span className={styles.dot3}></span>
                </div>
                <div>
                  <div className={styles.companyName}>PT. MULTI KONTROL NUSANTARA</div>
                  <div className={styles.companySub}>Member of Bakrie Group</div>
                </div>
              </div>
            </div>

            <div className={styles.titleBox}>
              <h2 className={styles.docTitle}>{meta.title}</h2>
              <div className={styles.docSubtitle}>{meta.subtitle}</div>
              {data.location && <div className={styles.metaRow}>Lokasi: {data.location}</div>}
              {data.serialOrRegNo && <div className={styles.metaRow}>No Reg / No Tangga: {data.serialOrRegNo}</div>}
            </div>

            <div className={styles.controlBox}>
              <table className={styles.controlTable}>
                <tbody>
                  <tr>
                    <td className={styles.controlLabel}>Doc No</td>
                    <td className={styles.controlVal}>: {meta.docNo}</td>
                  </tr>
                  <tr>
                    <td className={styles.controlLabel}>Publish Date</td>
                    <td className={styles.controlVal}>: {meta.publishDate}</td>
                  </tr>
                  <tr>
                    <td className={styles.controlLabel}>Rev.</td>
                    <td className={styles.controlVal}>: {meta.rev}</td>
                  </tr>
                  <tr>
                    <td className={styles.controlLabel}>Date Review</td>
                    <td className={styles.controlVal}>: {formattedDate || "___/___/___"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Sub Header / Info Bar */}
          <div className={styles.infoBar}>
            <div className={styles.infoCol}>
              <div><strong>Tanggal Inspeksi:</strong> {formattedDate || data.inspectionDate}</div>
              <div><strong>Periode / Triwulan:</strong> {data.quarter} / {data.year}</div>
            </div>
            <div className={styles.infoCol}>
              <div><strong>Kategori:</strong> {meta.label}</div>
              {data.itemSubtype && <div><strong>Tipe/Model:</strong> {data.itemSubtype}</div>}
            </div>
          </div>

          {/* Table Content depending on FormStructureType */}
          {meta.type === "inventory" && (
            <table className={styles.contentTable}>
              <thead>
                <tr>
                  <th style={{ width: "38px" }}>No.</th>
                  <th>Description</th>
                  <th style={{ width: "130px" }}>Merk/Type</th>
                  <th style={{ width: "50px" }}>Unit</th>
                  <th style={{ width: "50px" }}>Qty</th>
                  <th style={{ width: "160px" }} colSpan={3}>Tools Condition</th>
                  <th>Remarks / Catatan</th>
                </tr>
                <tr>
                  <th colSpan={5}></th>
                  <th style={{ width: "52px", fontSize: "10px" }}>Good</th>
                  <th style={{ width: "52px", fontSize: "10px" }}>Enough</th>
                  <th style={{ width: "52px", fontSize: "10px" }}>Broken</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.items && data.items.length > 0 ? (
                  data.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className={styles.textCenter}>{item.no || idx + 1}</td>
                      <td>{item.description}</td>
                      <td>{item.merkType || "-"}</td>
                      <td className={styles.textCenter}>{item.unit || "ea"}</td>
                      <td className={styles.textCenter}>{item.qty || 1}</td>
                      <td className={styles.textCenter}>{item.condition === "good" ? "✓" : ""}</td>
                      <td className={styles.textCenter}>{item.condition === "enough" ? "✓" : ""}</td>
                      <td className={styles.textCenter}>{item.condition === "broken" ? "✓" : ""}</td>
                      <td>{item.remarks || ""}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className={styles.textCenter}>Tidak ada item yang diinputkan.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {meta.type === "personnel-apd" && (
            <table className={styles.contentTable}>
              <thead>
                <tr>
                  <th rowSpan={2} style={{ width: "35px" }}>No.</th>
                  <th rowSpan={2} style={{ width: "180px" }}>Personil</th>
                  <th colSpan={5}>KELENGKAPAN APD</th>
                  <th rowSpan={2} style={{ width: "110px" }}>Keterangan</th>
                  <th rowSpan={2} style={{ width: "100px" }}>Kapan</th>
                  <th rowSpan={2} style={{ width: "90px" }}>Paraf / Ttd</th>
                </tr>
                <tr>
                  <th style={{ width: "55px", fontSize: "10px" }}>Helm</th>
                  <th style={{ width: "65px", fontSize: "10px" }}>Kacamata</th>
                  <th style={{ width: "60px", fontSize: "10px" }}>EarPlug</th>
                  <th style={{ width: "95px", fontSize: "10px" }}>Rompi/Baju</th>
                  <th style={{ width: "85px", fontSize: "10px" }}>Sepatu Safety</th>
                </tr>
              </thead>
              <tbody>
                {data.items && data.items.length > 0 ? (
                  data.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className={styles.textCenter}>{item.no || idx + 1}</td>
                      <td><strong>{item.personil}</strong></td>
                      <td className={styles.textCenter}>{item.helm !== false ? "✓" : "-"}</td>
                      <td className={styles.textCenter}>{item.kacamata !== false ? "✓" : "-"}</td>
                      <td className={styles.textCenter}>{item.earplug ? "✓" : "-"}</td>
                      <td className={styles.textCenter}>{item.rompi !== false ? "✓" : "-"}</td>
                      <td className={styles.textCenter}>{item.sepatu !== false ? "✓" : "-"}</td>
                      <td className={styles.textCenter}>{item.remarks || `${data.quarter} / ${data.year}`}</td>
                      <td className={styles.textCenter}>{item.kapan || data.inspectionDate}</td>
                      <td className={styles.textCenter}>
                        <span className={styles.signatureScript}>Ttd</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className={styles.textCenter}>Tidak ada data personil.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {meta.type === "padlock" && (
            <table className={styles.contentTable}>
              <thead>
                <tr>
                  <th style={{ width: "35px" }}>No</th>
                  <th style={{ width: "180px" }}>Nama</th>
                  <th style={{ width: "100px" }}>No Badge</th>
                  <th style={{ width: "110px" }}>No Seri Lock</th>
                  <th>Gambar / Foto Padlock</th>
                  <th style={{ width: "140px" }}>Keterangan / Ttd</th>
                </tr>
              </thead>
              <tbody>
                {data.items && data.items.length > 0 ? (
                  data.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className={styles.textCenter}>{item.no || idx + 1}</td>
                      <td><strong>{item.personil}</strong></td>
                      <td className={styles.textCenter}>{item.badgeNo || "-"}</td>
                      <td className={styles.textCenter}>{item.lockSerial || "-"}</td>
                      <td className={styles.textCenter}>
                        {item.photoUrl ? (
                          <img src={item.photoUrl} alt="Padlock" className={styles.tableThumbnail} />
                        ) : (
                          <span style={{ fontSize: "11px", color: "#64748b" }}>Terlampir di lampiran foto</span>
                        )}
                      </td>
                      <td className={styles.textCenter}>
                        <div>{item.remarks || `${data.quarter} ${data.year}`}</div>
                        <div className={styles.signatureScriptSmall}>Ttd</div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className={styles.textCenter}>Tidak ada data padlock.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {meta.type === "checklist" && (
            <table className={styles.contentTable}>
              <thead>
                <tr>
                  <th style={{ width: "38px" }}>No.</th>
                  <th>Hal / Komponen yang Diperiksa</th>
                  <th style={{ width: "130px" }} colSpan={2}>
                    {data.category === "katrol" ? "Kondisi" : "Kondisi"}
                  </th>
                  <th>Keterangan / Temuan</th>
                </tr>
                <tr>
                  <th colSpan={2}></th>
                  <th style={{ width: "65px", fontSize: "10px" }}>
                    {data.category === "double-lanyard" || data.category === "full-body-harness" || data.category === "single-lanyard" || data.category === "pole-harness"
                      ? "Memuaskan"
                      : "Baik / OK / YA"}
                  </th>
                  <th style={{ width: "65px", fontSize: "10px" }}>
                    {data.category === "double-lanyard" || data.category === "full-body-harness" || data.category === "single-lanyard" || data.category === "pole-harness"
                      ? "Tdk Memuaskan"
                      : "Rusak / TIDAK"}
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.items && data.items.length > 0 ? (
                  data.items.map((item, idx) => {
                    const isOk =
                      item.condition === "ok" ||
                      item.condition === "good" ||
                      item.condition === "baik" ||
                      item.condition === "memuaskan" ||
                      item.condition === "ya" ||
                      item.condition === "yes";
                    const isNotOk =
                      item.condition === "not_ok" ||
                      item.condition === "broken" ||
                      item.condition === "rusak" ||
                      item.condition === "tidak_memuaskan" ||
                      item.condition === "tidak" ||
                      item.condition === "no";

                    return (
                      <React.Fragment key={idx}>
                        {item.categoryGroup && (idx === 0 || data.items![idx - 1].categoryGroup !== item.categoryGroup) && (
                          <tr className={styles.groupHeaderRow}>
                            <td colSpan={5}>
                              <strong>{item.categoryGroup}</strong>
                            </td>
                          </tr>
                        )}
                        <tr>
                          <td className={styles.textCenter}>{item.no || idx + 1}</td>
                          <td>{item.description}</td>
                          <td className={styles.textCenter}>{isOk ? "✓" : ""}</td>
                          <td className={styles.textCenter}>{isNotOk ? "✓" : ""}</td>
                          <td>{item.remarks || ""}</td>
                        </tr>
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className={styles.textCenter}>Tidak ada checklist item.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {/* Safety Check Notice */}
          <div className={styles.safetyVerdictBox}>
            <div className={styles.verdictQuestion}>
              <strong>Apakah alat / perlengkapan ini aman untuk digunakan?</strong>
              <div className={styles.verdictCheckboxes}>
                <span className={data.isSafeToUse !== false && data.isSafeToUse !== "tidak" ? styles.checkedVerdict : ""}>
                  ☑ YA (AMAN)
                </span>
                <span className={data.isSafeToUse === false || data.isSafeToUse === "tidak" ? styles.checkedVerdict : ""}>
                  ☐ TIDAK (PERLU PERBAIKAN / REPLACEMENT)
                </span>
              </div>
            </div>
            {data.notes && (
              <div className={styles.notesBox}>
                <strong>Catatan / Temuan:</strong> {data.notes}
              </div>
            )}
            {data.actionTaken && (
              <div className={styles.notesBox}>
                <strong>Tindakan / Solusi:</strong> {data.actionTaken}
              </div>
            )}
          </div>

          {/* Signatures */}
          <div className={styles.signatureSection}>
            <div className={styles.signatureCol}>
              <div className={styles.sigDate}>Sangatta, {formattedDate || "________________"}</div>
              <div className={styles.sigTitle}>Diinspeksi / Petugas Inspeksi:</div>
              <div className={styles.sigSpace}>
                <div className={styles.signatureMark}>✓ Signed</div>
              </div>
              <div className={styles.sigName}>( {data.inspectorName || "...................................."} )</div>
              <div className={styles.sigSub}>
                Posisi: {data.inspectorPosition || "Teknisi Telco"} <br />
                ID / BN: {data.inspectorId || "-"}
              </div>
            </div>

            <div className={styles.signatureCol}>
              <div className={styles.sigDate}>&nbsp;</div>
              <div className={styles.sigTitle}>Diketahui Oleh:</div>
              <div className={styles.sigSpace}>
                <div className={styles.signatureMark}>✓ Verified</div>
              </div>
              <div className={styles.sigName}>( {data.supervisorName || "Rahmansyah"} )</div>
              <div className={styles.sigSub}>
                Posisi: {data.supervisorPosition || "Act. Spv Telco"} <br />
                ID / BN: {data.supervisorId || "2110997"}
              </div>
            </div>

            {meta.type === "inventory" && (
              <div className={styles.signatureCol}>
                <div className={styles.sigDate}>&nbsp;</div>
                <div className={styles.sigTitle}>Penanggung Jawab Tools:</div>
                <div className={styles.sigSpace}>
                  <div className={styles.signatureMark}>✓ Tools In Charge</div>
                </div>
                <div className={styles.sigName}>( {data.toolInChargeName || data.inspectorName || "...................................."} )</div>
                <div className={styles.sigSub}>
                  Posisi: {data.toolInChargePosition || "Teknisi Telco"} <br />
                  ID / BN: {data.toolInChargeId || data.inspectorId || "-"}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Printable Document Sheet 2: Photo Documentation Attachment */}
        {data.photos && data.photos.length > 0 && (
          <div className={`${styles.documentSheet} ${styles.pageBreakSheet}`}>
            <div className={styles.docHeader}>
              <div className={styles.companyBox}>
                <div className={styles.logoMkn}>
                  <div className={styles.logoDots}>
                    <span className={styles.dot1}></span>
                    <span className={styles.dot2}></span>
                    <span className={styles.dot3}></span>
                  </div>
                  <div>
                    <div className={styles.companyName}>PT. MULTI KONTROL NUSANTARA</div>
                    <div className={styles.companySub}>DOKUMENTASI FOTO INSPEKSI</div>
                  </div>
                </div>
              </div>
              <div className={styles.titleBox}>
                <h3 className={styles.docTitle}>LAMPIRAN FOTO INSPEKSI</h3>
                <div className={styles.docSubtitle}>{meta.label} - {data.quarter} / {data.year}</div>
              </div>
              <div className={styles.controlBox}>
                <table className={styles.controlTable}>
                  <tbody>
                    <tr>
                      <td className={styles.controlLabel}>Doc Ref</td>
                      <td className={styles.controlVal}>: {meta.docNo}</td>
                    </tr>
                    <tr>
                      <td className={styles.controlLabel}>Tanggal</td>
                      <td className={styles.controlVal}>: {formattedDate}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className={styles.photoGrid}>
              {data.photos.map((photoUrl, idx) => (
                <div key={idx} className={styles.photoCard}>
                  <div className={styles.photoWrapper}>
                    <img src={photoUrl} alt={`Dokumentasi Inspeksi ${idx + 1}`} className={styles.photoImg} />
                  </div>
                  <div className={styles.photoCaption}>
                    <strong>Foto #{idx + 1}</strong>: {meta.label} {data.location ? `- Lokasi: ${data.location}` : ""} ({data.quarter} {data.year})
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.signatureSection} style={{ marginTop: "24px" }}>
              <div className={styles.signatureCol}>
                <div className={styles.sigTitle}>Petugas Inspeksi:</div>
                <div className={styles.sigSpaceCompact}></div>
                <div className={styles.sigName}>( {data.inspectorName || "...................................."} )</div>
              </div>
              <div className={styles.signatureCol}>
                <div className={styles.sigTitle}>Diketahui Supervisor:</div>
                <div className={styles.sigSpaceCompact}></div>
                <div className={styles.sigName}>( {data.supervisorName || "Rahmansyah"} )</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
