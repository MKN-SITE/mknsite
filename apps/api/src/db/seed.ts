import { and, eq, notInArray } from "drizzle-orm";
import { db, pool } from ".";
import { config } from "../config/env";
import {
  accountAliases,
  authAccounts,
  authUsers,
  divisions,
  menus,
  permissions,
  rolePermissions,
  roles,
  userRoles,
  users
} from "./schema";
import {
  BOOTSTRAP_ACCOUNTS,
  DEACTIVATED_SYSTEM_MENU_URLS,
  DEFAULT_DIVISIONS,
  SYSTEM_MENUS,
  SYSTEM_PERMISSIONS,
  SYSTEM_ROLES,
  type BootstrapAccountDefinition
} from "./system-seed-data";
import { seedTowersFromExcel } from "../services/master-tower.service";

/**
 * Mengambil nilai password bootstrap dari environment variable.
 */
function getBootstrapPassword(key: BootstrapAccountDefinition["envPasswordKey"]): string | undefined {
  if (key === "SEED_ADMIN_PASSWORD") return config.seedAdminPassword;
  if (key === "SEED_SUPERADMIN_PASSWORD") return config.seedSuperadminPassword;
  if (key === "SEED_HR_PASSWORD") return config.seedHrPassword;
  if (key === "SEED_123_PASSWORD") return "123";
  return undefined;
}

/**
 * Menjalankan seeding MKN Site secara atomik di dalam satu transaksi database.
 * Fungsi ini idempoten dan aman dijalankan berulang kali tanpa menimpa password
 * akun existing atau menghapus role/menu kustom.
 */
export async function seedDatabase(connection = db): Promise<void> {
  // FASE 1: Sinkronisasi Katalog Sistem & Metadata (Menu, Izin, Peran, Role-Permissions, Divisi)
  // Fase ini idempoten dan aman dijalankan berulang kali
  await connection.transaction(async (tx) => {
    // 1. Sinkronisasi Menu Sistem (OPS Telco)
    for (const menuData of SYSTEM_MENUS) {
      const [existingMenu] = await tx.select().from(menus).where(eq(menus.url, menuData.url)).limit(1);
      if (!existingMenu) {
        await tx.insert(menus).values({
          title: menuData.title,
          icon: menuData.icon,
          description: menuData.description,
          url: menuData.url,
          requiredPermission: menuData.requiredPermission,
          sortOrder: menuData.sortOrder,
          isActive: menuData.isActive,
          badgeCount: menuData.badgeCount,
          badgeColor: menuData.badgeColor
        });
      } else {
        await tx.update(menus).set({
          title: menuData.title,
          icon: menuData.icon,
          description: menuData.description,
          requiredPermission: menuData.requiredPermission,
          sortOrder: menuData.sortOrder,
          isActive: menuData.isActive,
          badgeCount: menuData.badgeCount,
          badgeColor: menuData.badgeColor
        }).where(eq(menus.id, existingMenu.id));
      }
    }

    // 2. Nonaktifkan menu lama yang sudah tidak digunakan (misal /portal/hr)
    for (const deactUrl of DEACTIVATED_SYSTEM_MENU_URLS) {
      await tx.update(menus).set({ isActive: 0 }).where(eq(menus.url, deactUrl));
    }

    // 3. Sinkronisasi Izin Sistem (system permissions) secara idempoten
    for (const perm of SYSTEM_PERMISSIONS) {
      await tx.insert(permissions).values({ name: perm.name, slug: perm.slug })
        .onDuplicateKeyUpdate({ set: { name: perm.name } });
    }

    // 4. Sinkronisasi Peran Sistem (system roles) secara idempoten
    for (const role of SYSTEM_ROLES) {
      await tx.insert(roles).values({ name: role.name, slug: role.slug })
        .onDuplicateKeyUpdate({ set: { name: role.name } });
    }

    // Ambil daftar seluruh permissions dan roles untuk pemetaan ID
    const allPermissions = await tx.select().from(permissions);
    const allRoles = await tx.select().from(roles);
    const permMap = new Map(allPermissions.map((p) => [p.slug, p.id]));
    const roleMap = new Map(allRoles.map((r) => [r.slug, r.id]));

    // 5. Sinkronisasi Hak Akses Peran Sistem (role_permissions)
    // HANYA mengelola role sistem resmi; role kustom milik admin TIDAK tersentuh
    for (const systemRole of SYSTEM_ROLES) {
      const roleId = roleMap.get(systemRole.slug);
      if (!roleId) continue;

      const expectedPermIds: number[] = [];
      for (const permSlug of systemRole.permissions) {
        const permId = permMap.get(permSlug);
        if (permId) {
          expectedPermIds.push(permId);
        }
      }

      // Hapus izin lama yang tidak lagi terdaftar pada konfigurasi resmi role sistem ini
      if (expectedPermIds.length > 0) {
        await tx.delete(rolePermissions).where(
          and(
            eq(rolePermissions.roleId, roleId),
            notInArray(rolePermissions.permissionId, expectedPermIds)
          )
        );
      } else {
        await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
      }

      // Pasang seluruh izin wajib untuk role sistem ini
      for (const permId of expectedPermIds) {
        await tx.insert(rolePermissions).values({ roleId, permissionId: permId })
          .onDuplicateKeyUpdate({ set: { roleId } });
      }
    }

    // 6. Sinkronisasi Divisi Pokok Perusahaan
    for (const div of DEFAULT_DIVISIONS) {
      await tx.insert(divisions).values({ name: div.name, description: div.description })
        .onDuplicateKeyUpdate({ set: { description: div.description } });
    }
  });

  // FASE 2: Validasi dan Inisialisasi Akun Bootstrap (Admin, Superadmin, HR)
  // Berjalan dalam transaksi terpisah agar tidak membatalkan pembaruan metadata sistem jika terjadi kegagalan akun
  await connection.transaction(async (tx) => {
    const allRoles = await tx.select().from(roles);
    const roleMap = new Map(allRoles.map((r) => [r.slug, r.id]));

    for (const account of BOOTSTRAP_ACCOUNTS) {
      const normalizedEmail = account.email.trim().toLowerCase();
      const [existingUser] = await tx.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);

      let mknUserId: number;

      if (existingUser) {
        // Validasi: accountType tidak boleh bertentangan dengan konfigurasi bootstrap
        if (existingUser.accountType !== account.accountType) {
          throw new Error(
            `[SEED CONFLICT] Akun '${normalizedEmail}' terdaftar dengan tipe '${existingUser.accountType}', bertentangan dengan konfigurasi bootstrap '${account.accountType}'. Seed dibatalkan.`
          );
        }

        mknUserId = existingUser.id;
        // Lengkapi dan perbarui data profil bootstrap
        const userUpdates: Record<string, any> = {};
        if (account.division && existingUser.division !== account.division) {
          userUpdates.division = account.division;
        }
        if (account.name && existingUser.name !== account.name) {
          userUpdates.name = account.name;
        }
        if (account.email.startsWith("123@")) {
          userUpdates.kpcId = "Z110779";
          userUpdates.username = "123";
        }
        if (Object.keys(userUpdates).length > 0) {
          await tx.update(users).set(userUpdates).where(eq(users.id, mknUserId));
        }
      } else {
        // Akun baru: wajib memiliki password dari environment variable
        const envPassword = getBootstrapPassword(account.envPasswordKey);
        if (!envPassword) {
          throw new Error(
            `[SEED ERROR] Akun bootstrap '${normalizedEmail}' belum ada, dan environment variable '${account.envPasswordKey}' tidak ditemukan. Harap sediakan password melalui '${account.envPasswordKey}'.`
          );
        }

        const hashedPassword = await Bun.password.hash(envPassword, { algorithm: "argon2id" });

        const [insertedUser] = await tx.insert(users).values({
          name: account.name,
          email: normalizedEmail,
          accountType: account.accountType,
          division: account.division,
          kpcId: account.email.startsWith("123@") ? "Z110779" : null,
          username: account.email.startsWith("123@") ? "123" : null,
          passwordHash: hashedPassword,
          isActive: 1
        });
        mknUserId = Number(insertedUser.insertId);
      }

      // Pastikan role utama bootstrap terpasang pada user
      const targetRoleId = roleMap.get(account.roleSlug);
      if (targetRoleId) {
        if (account.email.startsWith("123@")) {
          const hrRoleId = roleMap.get("hr");
          if (hrRoleId) {
            await tx.delete(userRoles).where(
              and(eq(userRoles.userId, mknUserId), eq(userRoles.roleId, hrRoleId))
            );
          }
        }
        await tx.insert(userRoles).values({
          userId: mknUserId,
          roleId: targetRoleId
        }).onDuplicateKeyUpdate({ set: { roleId: targetRoleId } });
      }

      // 8. Validasi & Sinkronisasi auth_user (Better Auth)
      const [existingAuthUser] = await tx.select().from(authUsers).where(eq(authUsers.email, normalizedEmail)).limit(1);
      let authUserId: string;

      if (!existingAuthUser) {
        authUserId = crypto.randomUUID();
        await tx.insert(authUsers).values({
          id: authUserId,
          mknUserId: mknUserId,
          name: account.name,
          email: normalizedEmail,
          emailVerified: true
        });
      } else {
        authUserId = existingAuthUser.id;
        if (!existingAuthUser.mknUserId) {
          await tx.update(authUsers).set({ mknUserId: mknUserId }).where(eq(authUsers.id, authUserId));
        } else if (existingAuthUser.mknUserId !== mknUserId) {
          throw new Error(
            `[SEED CONFLICT] auth_user untuk '${normalizedEmail}' terhubung ke mknUserId ${existingAuthUser.mknUserId}, bukan ${mknUserId}. Seed dibatalkan.`
          );
        }
      }

      // 9. Validasi & Sinkronisasi auth_account (Better Auth)
      // Hanya provider 'credential' yang dianggap sebagai password login
      const [existingCredential] = await tx.select().from(authAccounts).where(
        and(
          eq(authAccounts.userId, authUserId),
          eq(authAccounts.providerId, "credential")
        )
      ).limit(1);

      if (!existingCredential) {
        // Jika belum ada kredensial, gunakan passwordHash yang sudah ada pada users
        const [currentUser] = await tx.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, mknUserId)).limit(1);
        let hashToUse = currentUser?.passwordHash;

        if (!hashToUse) {
          const envPassword = getBootstrapPassword(account.envPasswordKey);
          if (!envPassword) {
            throw new Error(
              `[SEED ERROR] Kredensial untuk '${normalizedEmail}' belum tersedia dan passwordHash users kosong. Harap sediakan password melalui '${account.envPasswordKey}'.`
            );
          }
          hashToUse = await Bun.password.hash(envPassword, { algorithm: "argon2id" });
          await tx.update(users).set({ passwordHash: hashToUse }).where(eq(users.id, mknUserId));
        }

        await tx.insert(authAccounts).values({
          id: crypto.randomUUID(),
          accountId: authUserId,
          providerId: "credential",
          userId: authUserId,
          password: hashToUse
        });
      }

      // 10. Validasi & Sinkronisasi account_aliases (Email alias & shortcut username)
      const aliasesToRegister = [normalizedEmail];
      if (normalizedEmail === "123@mknsite.online") {
        aliasesToRegister.push("123");
      }

      for (const aliasValue of aliasesToRegister) {
        const [existingAlias] = await tx
          .select()
          .from(accountAliases)
          .where(eq(accountAliases.normalizedValue, aliasValue))
          .limit(1);

        if (!existingAlias) {
          await tx.insert(accountAliases).values({
            userId: mknUserId,
            aliasType: aliasValue.includes("@") ? "email" : "username",
            normalizedValue: aliasValue
          });
        }
      }
    }
  });

  // FASE 3: Seeding Master Tower Telekomunikasi dari file Excel Master
  await seedTowersFromExcel();
}

export const runSeed = seedDatabase;

// CLI Entrypoint terpisah — pool.end hanya dipanggil bila dieksekusi langsung
if (import.meta.main) {
  console.log("Memulai seeding MKN Site (Transactional & Secure)...");
  try {
    await seedDatabase(db);
    console.log("Seed MKN Site selesai dengan sukses.");
  } catch (error: any) {
    console.error(`Gagal menjalankan seed: ${error?.message || error}`);
    await pool.end();
    process.exit(1);
  }
  await pool.end();
}
