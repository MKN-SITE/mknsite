"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useRoles, type RoleSummaryDto } from "../hooks/use-roles";
import { useDivisions } from "../hooks/use-divisions";
import styles from "./create-user-modal.module.css";

export type CreateUserModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export function CreateUserModal({ open, onClose, onSuccess }: CreateUserModalProps) {
  const { roles, loading: loadingRoles, error: rolesError } = useRoles();
  const { divisions } = useDivisions();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [division, setDivision] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);

  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
  }>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Sembunyikan role yang memiliki izin admin.manage atau admin.security.manage
  const assignableRoles = useMemo(() => {
    return roles.filter(
      (role) =>
        !role.permissions.includes("admin.manage") &&
        !role.permissions.includes("admin.security.manage")
    );
  }, [roles]);

  const resetForm = () => {
    setName("");
    setEmail("");
    setDivision("");
    setPassword("");
    setSelectedRoleIds([]);
    setFieldErrors({});
    setApiError(null);
    setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return;
    resetForm();
    onClose();
  };

  const handleToggleRole = (roleId: number) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const validate = (): boolean => {
    const errors: { name?: string; email?: string; password?: string } = {};

    const trimmedName = name.trim();
    if (!trimmedName) {
      errors.name = "Nama lengkap wajib diisi";
    } else if (trimmedName.length > 160) {
      errors.name = "Nama lengkap maksimal 160 karakter";
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errors.email = "Email resmi wajib diisi";
    } else if (trimmedEmail.length > 191) {
      errors.email = "Email maksimal 191 karakter";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = "Format email tidak valid";
    }

    if (!password) {
      errors.password = "Kata sandi wajib diisi";
    } else if (password.length < 12) {
      errors.password = "Kata sandi minimal 12 karakter";
    } else if (password.length > 128) {
      errors.password = "Kata sandi maksimal 128 karakter";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    if (!validate()) return;

    setSubmitting(true);
    setApiError(null);

    try {
      await api("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          division: division.trim() || undefined,
          password,
          roleIds: selectedRoleIds
        })
      });

      resetForm();
      onClose();
      onSuccess?.();
    } catch (err: any) {
      if (err?.status === 409) {
        setApiError("Email sudah terdaftar");
      } else if (err?.status === 422) {
        setApiError(err?.message || "Validasi format data gagal. Periksa kembali input Anda.");
      } else if (err?.status === 403) {
        setApiError("Tidak diizinkan");
      } else {
        setApiError(err?.message || "Gagal membuat pengguna baru.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isPasswordMinValid = password.length >= 12;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Tambah Karyawan Baru"
      size="md"
      footer={
        <div className={styles.footerButtons}>
          <Button
            variant="secondary"
            size="md"
            onClick={handleClose}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            form="create-user-form"
            loading={submitting}
            loadingText="Menyimpan..."
          >
            Simpan Pengguna
          </Button>
        </div>
      }
    >
      <form id="create-user-form" className={styles.form} onSubmit={handleSubmit} noValidate>
        {apiError && (
          <div className={`${styles.alert} ${styles.alertDanger}`} role="alert">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{apiError}</span>
          </div>
        )}

        <FormField
          label="Nama Lengkap"
          name="name"
          placeholder="cth. Budi Santoso"
          value={name}
          maxLength={160}
          required
          error={fieldErrors.name}
          onChange={(e) => {
            setName(e.target.value);
            if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
          }}
          disabled={submitting}
        />

        <FormField
          label="Email Resmi"
          name="email"
          type="email"
          placeholder="budi@mknsite.online"
          value={email}
          maxLength={191}
          required
          error={fieldErrors.email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
          }}
          disabled={submitting}
        />

        <FormField
          label="Divisi / Departemen"
          name="division"
          placeholder="Pilih atau ketik divisi (cth. Human Resources)"
          value={division}
          maxLength={100}
          list="division-options"
          onChange={(e) => setDivision(e.target.value)}
          disabled={submitting}
        />
        <datalist id="division-options">
          {divisions.map((d) => (
            <option key={d.id} value={d.name} />
          ))}
        </datalist>

        <div className={styles.fieldWrapper}>
          <FormField
            label="Kata Sandi Akun"
            name="password"
            type="password"
            placeholder="Minimal 12 karakter"
            value={password}
            maxLength={128}
            required
            error={fieldErrors.password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
            }}
            disabled={submitting}
          />
          <div className={styles.counterRow} aria-live="polite">
            <span
              className={
                password.length > 0
                  ? isPasswordMinValid
                    ? styles.counterValid
                    : styles.counterInvalid
                  : undefined
              }
            >
              {password.length}/12 karakter minimum
            </span>
            <span>Maks 128</span>
          </div>
        </div>

        <div className={styles.rolesSection}>
          <label className={styles.rolesLabel}>Penugasan Role Karyawan</label>
          <p className={styles.rolesDescription}>
            Pilih hak akses peran untuk akun ini. Peran administratif tingkat tinggi tidak dapat diberikan melalui form karyawan.
          </p>

          {loadingRoles && (
            <div className={styles.rolesEmpty}>Memuat daftar role...</div>
          )}

          {rolesError && (
            <div className={`${styles.alert} ${styles.alertDanger}`} role="alert">
              <span>{rolesError}</span>
            </div>
          )}

          {!loadingRoles && !rolesError && assignableRoles.length === 0 && (
            <div className={styles.rolesEmpty}>Tidak ada role karyawan yang tersedia.</div>
          )}

          {!loadingRoles && assignableRoles.length > 0 && (
            <div className={styles.rolesList} role="group" aria-label="Daftar Role Karyawan">
              {assignableRoles.map((role: RoleSummaryDto) => {
                const isChecked = selectedRoleIds.includes(role.id);
                return (
                  <label key={role.id} className={styles.roleItem}>
                    <input
                      type="checkbox"
                      className={styles.roleCheckbox}
                      checked={isChecked}
                      onChange={() => handleToggleRole(role.id)}
                      disabled={submitting}
                    />
                    <div className={styles.roleInfo}>
                      <span className={styles.roleName}>{role.name}</span>
                      {role.permissions && role.permissions.length > 0 && (
                        <div className={styles.permissionsWrap}>
                          {role.permissions.map((perm) => (
                            <Badge
                              key={perm}
                              variant="neutral"
                              className={styles.permissionBadge}
                            >
                              {perm}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
