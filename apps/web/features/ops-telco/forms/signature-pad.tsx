"use client";

import React, { useEffect, useRef, useState } from "react";
import styles from "./signature-pad.module.css";

interface SignaturePadProps {
  onSave: (dataUrl: string) => void | Promise<void>;
  onCancel?: () => void;
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  disabled?: boolean;
}

export function SignaturePad({
  onSave,
  onCancel,
  title = "Tanda Tangan Digital",
  subtitle = "Gunakan jari, stylus, atau mouse untuk menandatangani di area di bawah.",
  submitLabel = "Simpan Tanda Tangan",
  disabled = false
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inisialisasi resolusi canvas tinggi untuk ketajaman goresan (HiDPI)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#0d2b3e";
  }, []);

  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || isSubmitting) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);
    setIsDrawing(true);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled || isSubmitting) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // Abaikan jika pointer capture telah dilepas
      }
    }
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasDrawn(false);
  };

  const handleOpenConfirm = () => {
    if (!hasDrawn || disabled || isSubmitting) return;
    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;

    setShowConfirmModal(false);
    setIsSubmitting(true);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      await onSave(dataUrl);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h4 className={styles.title}>{title}</h4>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
      </div>

      <div className={styles.canvasWrapper}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
        <div className={styles.guideLine} />
        <span className={styles.guideText}>Tanda tangan di atas garis ini</span>
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          onClick={handleClear}
          disabled={!hasDrawn || disabled || isSubmitting}
          className={styles.clearBtn}
        >
          Bersihkan
        </button>

        <div style={{ display: "flex", gap: "8px" }}>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className={styles.clearBtn}
              style={{ color: "#496574", background: "#f1f6f9", borderColor: "#d4e2eb" }}
            >
              Batal
            </button>
          )}
          <button
            type="button"
            onClick={handleOpenConfirm}
            disabled={!hasDrawn || disabled || isSubmitting}
            className={styles.submitBtn}
          >
            {isSubmitting ? "Menyimpan..." : submitLabel}
          </button>
        </div>
      </div>

      {showConfirmModal && (
        <div className={styles.modalOverlay} onClick={() => setShowConfirmModal(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Konfirmasi Tanda Tangan</h3>
            <p className={styles.modalText}>
              Apakah Anda yakin ingin menyimpan dan menandatangani dokumen Job Oncall ini? Tanda tangan Anda akan diverifikasi dan dicatat pada sistem.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancelBtn}
                onClick={() => setShowConfirmModal(false)}
              >
                Periksa Kembali
              </button>
              <button
                type="button"
                className={styles.modalConfirmBtn}
                onClick={handleConfirmSave}
              >
                Ya, Tanda Tangani
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
