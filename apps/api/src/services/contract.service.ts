import { and, desc, eq, gte, isNull, lte, ne, sql } from "drizzle-orm";
import { db } from "../db";
import { authAccounts, authUsers, employeeContracts, users } from "../db/schema";
import { emailService } from "./email.service";

export interface UpdateProfileDto {
  name?: string;
  username?: string | null;
  phone?: string | null;
  startDate?: string | null;
  division?: string | null;
  kpcId?: string | null;
}

export interface CreateContractDto {
  contractNumber: string;
  sequenceNumber?: number;
  contractType?: string;
  startDate: string;
  endDate: string;
  status?: string;
  position?: string | null;
  notes?: string | null;
}

export interface UpdateContractDto {
  contractNumber?: string;
  sequenceNumber?: number;
  contractType?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  position?: string | null;
  notes?: string | null;
}

export interface PersonalProfileResponse {
  user: {
    id: number;
    name: string;
    username: string | null;
    email: string;
    phone: string | null;
    startDate: string | null;
    division: string | null;
    kpcId: string | null;
    avatarUrl: string | null;
    accountType: string;
    tenure: {
      years: number;
      months: number;
      days: number;
      formatted: string;
    } | null;
  };
  contracts: Array<{
    id: number;
    contractNumber: string;
    sequenceNumber: number;
    sequenceLabel: string;
    contractType: string;
    startDate: string;
    endDate: string;
    durationDays: number;
    status: string;
    position: string | null;
    notes: string | null;
    reminderSentAt: Date | null;
  }>;
  summary: {
    totalContracts: number;
    extensionCount: number;
    activeContract: {
      id: number;
      contractNumber: string;
      sequenceNumber: number;
      sequenceLabel: string;
      contractType: string;
      startDate: string;
      endDate: string;
      daysRemaining: number;
      isExpiringSoon: boolean;
      isExpired: boolean;
      position: string | null;
    } | null;
  };
}

export function calculateTenure(startDateStr: string | null, referenceDate = new Date()): {
  years: number;
  months: number;
  days: number;
  formatted: string;
} | null {
  if (!startDateStr) return null;

  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) return null;

  let years = referenceDate.getFullYear() - start.getFullYear();
  let months = referenceDate.getMonth() - start.getMonth();
  let days = referenceDate.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    // Days in previous month
    const prevMonthLastDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 0).getDate();
    days += prevMonthLastDay;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years < 0) {
    return { years: 0, months: 0, days: 0, formatted: "0 Hari" };
  }

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} Tahun`);
  if (months > 0) parts.push(`${months} Bulan`);
  if (days > 0 || parts.length === 0) parts.push(`${days} Hari`);

  return {
    years,
    months,
    days,
    formatted: parts.join(" ")
  };
}

export function getSequenceLabel(sequenceNumber: number, contractType?: string): string {
  if (sequenceNumber <= 1) {
    return "Kontrak Awal";
  }
  return `Perpanjangan Ke-${sequenceNumber - 1}`;
}

export function calculateDaysDifference(targetDateStr: string, fromDate = new Date()): number {
  const target = new Date(targetDateStr);
  const from = new Date(fromDate.toISOString().slice(0, 10)); // normalize to midnight
  const targetMidnight = new Date(target.toISOString().slice(0, 10));
  const diffTime = targetMidnight.getTime() - from.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export class ContractService {
  async getPersonalProfileAndContracts(userId: number): Promise<PersonalProfileResponse> {
    const [userRecord] = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        email: users.email,
        phone: users.phone,
        startDate: users.startDate,
        division: users.division,
        kpcId: users.kpcId,
        avatarUrl: users.avatarUrl,
        accountType: users.accountType
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRecord) {
      throw new Error(`User with ID ${userId} not found`);
    }

    const tenure = calculateTenure(userRecord.startDate);

    const contractRecords = await db
      .select()
      .from(employeeContracts)
      .where(eq(employeeContracts.userId, userId))
      .orderBy(employeeContracts.sequenceNumber);

    const mappedContracts = contractRecords.map((c) => {
      const start = new Date(c.startDate).getTime();
      const end = new Date(c.endDate).getTime();
      const durationDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));

      return {
        id: c.id,
        contractNumber: c.contractNumber,
        sequenceNumber: c.sequenceNumber,
        sequenceLabel: getSequenceLabel(c.sequenceNumber, c.contractType),
        contractType: c.contractType,
        startDate: c.startDate,
        endDate: c.endDate,
        durationDays,
        status: c.status,
        position: c.position,
        notes: c.notes,
        reminderSentAt: c.reminderSentAt
      };
    });

    // Find active contract or latest contract
    const activeRecord = mappedContracts.find((c) => c.status === "active") || (mappedContracts.length > 0 ? mappedContracts[mappedContracts.length - 1] : null);

    let activeSummary = null;
    if (activeRecord) {
      const daysRemaining = calculateDaysDifference(activeRecord.endDate);
      activeSummary = {
        id: activeRecord.id,
        contractNumber: activeRecord.contractNumber,
        sequenceNumber: activeRecord.sequenceNumber,
        sequenceLabel: activeRecord.sequenceLabel,
        contractType: activeRecord.contractType,
        startDate: activeRecord.startDate,
        endDate: activeRecord.endDate,
        daysRemaining,
        isExpiringSoon: daysRemaining <= 30 && daysRemaining >= 0,
        isExpired: daysRemaining < 0,
        position: activeRecord.position
      };
    }

    const extensionCount = Math.max(0, mappedContracts.length - 1);

    return {
      user: {
        ...userRecord,
        tenure
      },
      contracts: mappedContracts,
      summary: {
        totalContracts: mappedContracts.length,
        extensionCount,
        activeContract: activeSummary
      }
    };
  }

  async checkAndSendContractExpiryReminders(): Promise<{
    processed: number;
    remindersSent: number;
    results: Array<{
      userId: number;
      email: string;
      contractNumber: string;
      daysRemaining: number;
      success: boolean;
    }>;
  }> {
    // Cari kontrak berstatus 'active' yang end_date <= CURDATE() + 30 days dan reminder_sent_at IS NULL
    const expiringContracts = await db
      .select({
        contractId: employeeContracts.id,
        userId: employeeContracts.userId,
        contractNumber: employeeContracts.contractNumber,
        sequenceNumber: employeeContracts.sequenceNumber,
        contractType: employeeContracts.contractType,
        startDate: employeeContracts.startDate,
        endDate: employeeContracts.endDate,
        userName: users.name,
        userEmail: users.email
      })
      .from(employeeContracts)
      .innerJoin(users, eq(employeeContracts.userId, users.id))
      .where(
        and(
          eq(employeeContracts.status, "active"),
          isNull(employeeContracts.reminderSentAt),
          sql`${employeeContracts.endDate} <= DATE_ADD(CURRENT_DATE(), INTERVAL 30 DAY)`,
          sql`${employeeContracts.endDate} >= CURRENT_DATE()`
        )
      );

    const results: Array<{
      userId: number;
      email: string;
      contractNumber: string;
      daysRemaining: number;
      success: boolean;
    }> = [];

    for (const c of expiringContracts) {
      const daysRemaining = calculateDaysDifference(c.endDate);

      try {
        await emailService.sendContractExpiryReminderEmail({
          to: c.userEmail,
          name: c.userName,
          contractNumber: c.contractNumber,
          sequenceNumber: c.sequenceNumber,
          contractType: c.contractType,
          startDate: c.startDate,
          endDate: c.endDate,
          daysRemaining
        });

        // Catat timestamp bahwa reminder telah dikirimkan
        await db
          .update(employeeContracts)
          .set({
            reminderSentAt: new Date()
          })
          .where(eq(employeeContracts.id, c.contractId));

        results.push({
          userId: c.userId,
          email: c.userEmail,
          contractNumber: c.contractNumber,
          daysRemaining,
          success: true
        });
      } catch (err) {
        console.error(`Failed to send contract reminder to ${c.userEmail}:`, err);
        results.push({
          userId: c.userId,
          email: c.userEmail,
          contractNumber: c.contractNumber,
          daysRemaining,
          success: false
        });
      }
    }

    return {
      processed: expiringContracts.length,
      remindersSent: results.filter((r) => r.success).length,
      results
    };
  }

  async sendTestReminder(userId: number): Promise<{
    success: boolean;
    recipient: string;
    contractNumber: string;
    daysRemaining: number;
    message: string;
  }> {
    const profile = await this.getPersonalProfileAndContracts(userId);
    if (!profile.summary.activeContract) {
      throw new Error("Tidak ada data kontrak aktif untuk pengiriman uji notifikasi.");
    }

    const active = profile.summary.activeContract;
    const daysRemaining = active.daysRemaining;

    await emailService.sendContractExpiryReminderEmail({
      to: profile.user.email,
      name: profile.user.name,
      contractNumber: active.contractNumber,
      sequenceNumber: active.sequenceNumber,
      contractType: active.contractType,
      startDate: active.startDate,
      endDate: active.endDate,
      daysRemaining
    });

    return {
      success: true,
      recipient: profile.user.email,
      contractNumber: active.contractNumber,
      daysRemaining,
      message: `Uji notifikasi pengingat kontrak (${daysRemaining} hari) berhasil dikirim ke ${profile.user.email}.`
    };
  }

  async updateProfile(userId: number, dto: UpdateProfileDto): Promise<PersonalProfileResponse> {
    const [existing] = await db
      .select({ id: users.id, name: users.name, username: users.username })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!existing) {
      throw new Error(`User with ID ${userId} tidak ditemukan.`);
    }

    if (dto.username !== undefined && dto.username !== null && dto.username.trim() !== "") {
      const normalizedUsername = dto.username.trim().toLowerCase();
      const [conflict] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.username, normalizedUsername), ne(users.id, userId)))
        .limit(1);

      if (conflict) {
        throw new Error(`Username @${normalizedUsername} sudah digunakan oleh akun lain.`);
      }
    }

    const updates: Partial<{
      name: string;
      username: string | null;
      phone: string | null;
      startDate: string | null;
      division: string | null;
      kpcId: string | null;
    }> = {};

    if (dto.name !== undefined) updates.name = dto.name.trim();
    if (dto.username !== undefined) {
      updates.username = dto.username && dto.username.trim() !== "" ? dto.username.trim().toLowerCase() : null;
    }
    if (dto.phone !== undefined) {
      updates.phone = dto.phone && dto.phone.trim() !== "" ? dto.phone.trim() : null;
    }
    if (dto.startDate !== undefined) {
      updates.startDate = dto.startDate && dto.startDate.trim() !== "" ? dto.startDate.trim() : null;
    }
    if (dto.division !== undefined) {
      updates.division = dto.division && dto.division.trim() !== "" ? dto.division.trim() : null;
    }
    if (dto.kpcId !== undefined) {
      updates.kpcId = dto.kpcId && dto.kpcId.trim() !== "" ? dto.kpcId.trim().toUpperCase() : null;
    }

    if (Object.keys(updates).length > 0) {
      await db.update(users).set(updates).where(eq(users.id, userId));

      if (updates.name) {
        await db.update(authUsers).set({ name: updates.name }).where(eq(authUsers.mknUserId, userId));
      }
    }

    return this.getPersonalProfileAndContracts(userId);
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    if (!currentPassword) {
      throw new Error("Kata sandi saat ini harus diisi.");
    }
    if (!newPassword || newPassword.length < 8) {
      throw new Error("Kata sandi baru minimal 8 karakter.");
    }

    const [user] = await db
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new Error("Akun pengguna tidak ditemukan.");
    }

    const isMatch = await Bun.password.verify(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new Error("Kata sandi saat ini tidak cocok.");
    }

    const newHashed = await Bun.password.hash(newPassword, { algorithm: "argon2id" });

    // Update users legacy passwordHash
    await db.update(users).set({ passwordHash: newHashed }).where(eq(users.id, userId));

    // Update Better-Auth auth_account password
    const [authUser] = await db
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(eq(authUsers.mknUserId, userId))
      .limit(1);

    if (authUser?.id) {
      await db.update(authAccounts).set({ password: newHashed }).where(eq(authAccounts.userId, authUser.id));
    }

    return {
      success: true,
      message: "Kata sandi akun Anda berhasil diperbarui."
    };
  }

  async createContract(userId: number, dto: CreateContractDto): Promise<PersonalProfileResponse> {
    if (!dto.contractNumber || dto.contractNumber.trim() === "") {
      throw new Error("Nomor kontrak wajib diisi.");
    }
    if (!dto.startDate || !dto.endDate) {
      throw new Error("Tanggal mulai dan tanggal selesai kontrak wajib diisi.");
    }

    let sequence = dto.sequenceNumber;
    if (!sequence || sequence <= 0) {
      const existing = await db
        .select({ seq: employeeContracts.sequenceNumber })
        .from(employeeContracts)
        .where(eq(employeeContracts.userId, userId))
        .orderBy(desc(employeeContracts.sequenceNumber))
        .limit(1);

      sequence = (existing[0]?.seq || 0) + 1;
    }

    const contractType =
      dto.contractType && dto.contractType.trim() !== ""
        ? dto.contractType.trim()
        : getSequenceLabel(sequence);

    const status = dto.status || "active";

    if (status === "active") {
      await db
        .update(employeeContracts)
        .set({ status: "extended" })
        .where(and(eq(employeeContracts.userId, userId), eq(employeeContracts.status, "active")));
    }

    await db.insert(employeeContracts).values({
      userId,
      contractNumber: dto.contractNumber.trim(),
      sequenceNumber: sequence,
      contractType,
      startDate: dto.startDate,
      endDate: dto.endDate,
      status,
      position: dto.position ? dto.position.trim() : null,
      notes: dto.notes ? dto.notes.trim() : null
    });

    return this.getPersonalProfileAndContracts(userId);
  }

  async updateContract(userId: number, contractId: number, dto: UpdateContractDto): Promise<PersonalProfileResponse> {
    const [contract] = await db
      .select()
      .from(employeeContracts)
      .where(and(eq(employeeContracts.id, contractId), eq(employeeContracts.userId, userId)))
      .limit(1);

    if (!contract) {
      throw new Error("Kontrak tidak ditemukan atau Anda tidak memiliki akses.");
    }

    const updates: Partial<{
      contractNumber: string;
      sequenceNumber: number;
      contractType: string;
      startDate: string;
      endDate: string;
      status: string;
      position: string | null;
      notes: string | null;
      reminderSentAt: Date | null;
    }> = {};

    if (dto.contractNumber !== undefined) updates.contractNumber = dto.contractNumber.trim();
    if (dto.sequenceNumber !== undefined) updates.sequenceNumber = dto.sequenceNumber;
    if (dto.contractType !== undefined) updates.contractType = dto.contractType.trim();
    if (dto.startDate !== undefined) updates.startDate = dto.startDate;
    if (dto.endDate !== undefined) {
      updates.endDate = dto.endDate;
      if (dto.endDate !== contract.endDate) {
        updates.reminderSentAt = null; // Reset reminder jika tanggal akhir berubah
      }
    }
    if (dto.status !== undefined) {
      updates.status = dto.status;
      if (dto.status === "active" && contract.status !== "active") {
        await db
          .update(employeeContracts)
          .set({ status: "extended" })
          .where(and(eq(employeeContracts.userId, userId), eq(employeeContracts.status, "active")));
      }
    }
    if (dto.position !== undefined) updates.position = dto.position ? dto.position.trim() : null;
    if (dto.notes !== undefined) updates.notes = dto.notes ? dto.notes.trim() : null;

    if (Object.keys(updates).length > 0) {
      await db.update(employeeContracts).set(updates).where(eq(employeeContracts.id, contractId));
    }

    return this.getPersonalProfileAndContracts(userId);
  }

  async deleteContract(userId: number, contractId: number): Promise<PersonalProfileResponse> {
    const [contract] = await db
      .select({ id: employeeContracts.id })
      .from(employeeContracts)
      .where(and(eq(employeeContracts.id, contractId), eq(employeeContracts.userId, userId)))
      .limit(1);

    if (!contract) {
      throw new Error("Kontrak tidak ditemukan atau Anda tidak memiliki akses.");
    }

    await db.delete(employeeContracts).where(eq(employeeContracts.id, contractId));

    return this.getPersonalProfileAndContracts(userId);
  }
}

export const contractService = new ContractService();
