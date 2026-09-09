# Dokumentasi Realtime API (Server-Sent Events)

Status: **Dokumentasi Aktual & Panduan Integrasi Client**  
Disusun pada: 2026-09-09  
Terkait Tiket: **D04** (GitHub Issue [#5](https://github.com/MKN-SITE/mknsite/issues/5))  
Mandat: Mendokumentasikan mekanisme Server-Sent Events (SSE), event catalog, keterbatasan runtime in-memory, contoh client implementation, serta prosedur pengujian streaming terautentikasi.

---

## 1. Arsitektur Transport & Autentikasi

Layanan realtime MKN Site dibangun di atas protokol standar web **Server-Sent Events (SSE)** melalui endpoint:

```http
GET /realtime/events
GET /realtime/events?context=employee
GET /realtime/events?context=admin
```

### Karakteristik Transport & Isolasi Konteks:
- **Protokol:** HTTP/1.1 atau HTTP/2 Streaming (Unidirectional server-to-client).
- **Header Response:**
  - `Content-Type: text/event-stream; charset=utf-8`
  - `Cache-Control: no-cache`
  - `Connection: keep-alive`
  - `Access-Control-Allow-Credentials: true`
- **Autentikasi & Isolasi Konteks:**
  - Menggunakan HTTP-only session cookie dari browser. Client EventSource **wajib** menyertakan opsi `{ withCredentials: true }`.
  - Parameter `?context=admin`: Hanya menerima cookie sesi administrator (`mkn_admin.session_token`) dan memverifikasi izin `admin.manage`. Jika cookie tidak ada atau tidak valid, server mengembalikan `401 Unauthorized` seketika tanpa fallback ke sesi employee.
  - Parameter `?context=employee`: Hanya menerima cookie sesi karyawan (`mkn_employee.session_token`). Jika cookie tidak ada atau tidak valid, server mengembalikan `401 Unauthorized` seketika tanpa fallback ke sesi admin.
  - Default (tanpa query context): Memeriksa sesi employee terlebih dahulu, lalu admin jika employee kosong.
- **Revalidasi Sesi Berkala:**
  - Server melakukan validasi database berkala setiap interval heartbeat 25 detik terhadap sesi aktif. Jika sesi telah dicabut atau akun dinonaktifkan, event `session.revoked` dikirim dan koneksi diputus secara graceful dari server.

---

## 2. Katalog Event (Event Catalog)

Setiap event yang dikirimkan melalui stream menggunakan format baku SSE:
```text
event: <nama-event>
data: <payload-json>

```

Berikut adalah seluruh event yang di-emit oleh server saat ini:

### 2.1. `event: connected`
- **Pemicu:** Dikirimkan oleh server segera setelah koneksi HTTP streaming berhasil dibuka dan sesi terverifikasi.
- **Tujuan:** Konfirmasi bahwa client telah terhubung ke hub notifikasi.
- **Payload Data (JSON):**
  ```json
  {
    "occurredAt": "2026-09-09T04:18:45.125Z"
  }
  ```
- **Tindakan Rekomendasi Client:** Menandai indikator status UI menjadi *Live* / *Connected*.

---

### 2.2. `event: access.updated`
- **Pemicu:** 
  1. Administrator memperbarui daftar role pengguna melalui `PATCH /admin/users/:id/roles`.
  2. Administrator mengaktifkan kembali akun pengguna melalui `PATCH /admin/users/:id/status` (`isActive: true`).
- **Penerima:** Hanya pengguna target (`userId`).
- **Payload Data (JSON):**
  ```json
  {
    "type": "access.updated",
    "message": "Hak akses Anda diperbarui oleh administrator.",
    "occurredAt": "2026-09-09T04:25:10.000Z"
  }
  ```
- **Tindakan Rekomendasi Client:** Memuat ulang data profil pengguna (`GET /auth/me`) atau melakukan reload halaman agar hak akses modul dan navigasi langsung terbarui.

---

### 2.3. `event: session.revoked`
- **Pemicu:** Administrator menonaktifkan akun pengguna melalui `PATCH /admin/users/:id/status` (`isActive: false`).
- **Penerima:** Hanya pengguna target (`userId`).
- **Payload Data (JSON):**
  ```json
  {
    "type": "session.revoked",
    "message": "Akun Anda dinonaktifkan oleh administrator.",
    "occurredAt": "2026-09-09T04:26:00.000Z"
  }
  ```
- **Tindakan Rekomendasi Client:**
  1. Segera menutup koneksi stream (`stream.close()`).
  2. Membersihkan state autentikasi lokal.
  3. Mengarahkan pengguna ke halaman login (`/login` untuk karyawan atau `/admin/login` untuk admin).

---

### 2.4. `event: admin.users.updated`
- **Pemicu:** Setiap kali terjadi mutasi data pengguna oleh administrator (`POST /admin/users`, `PATCH /admin/users/:id`, `PATCH /admin/users/:id/roles`, `PATCH /admin/users/:id/status`, atau `POST /admin/users/:id/revoke-sessions`).
- **Penerima:** Seluruh stream administrator aktif yang terkoneksi dengan `?context=admin` (tidak dikirimkan ke stream karyawan biasa).
- **Payload Data (JSON):**
  ```json
  {
    "type": "admin.users.updated",
    "userId": 2,
    "occurredAt": "2026-09-09T05:35:07.024Z"
  }
  ```
- **Tindakan Rekomendasi Client:** Halaman dashboard/manajemen pengguna admin memicu revalidasi data (`mutate()` / refetch daftar pengguna atau detail pengguna dengan ID terkait) agar antarmuka terbarui secara realtime.

---

### 2.5. `event: notification.created` (Transport Heartbeat / Keep-Alive)
- **Pemicu:** Timer internal server yang berjalan setiap 25 detik per koneksi aktif.
- **Tujuan:** Mencegah pemutusan koneksi oleh reverse proxy, firewall, Cloudflare Tunnel, atau gateway perantara yang memiliki batas waktu idle timeout, sekaligus menjadi interval revalidasi keaktifan sesi di database.
- **Payload Data (JSON):**
  ```json
  {
    "type": "notification.created",
    "message": "keep-alive",
    "occurredAt": "2026-09-09T04:19:10.125Z"
  }
  ```
- **Tindakan Rekomendasi Client:** Diabaikan oleh listener bisnis (hanya berfungsi sebagai *liveness check* di tingkat transport).

---

## 3. Keterbatasan Arsitektur Saat Ini

Hasil audit kode pada `apps/api/src/lib/realtime.ts` dan `apps/api/src/routes/realtime.ts` menunjukkan beberapa batasan teknis yang harus dipahami oleh developer:

1. **In-Memory Single Process Hub:**
   - Objek subscriber disimpan pada struktur data in-memory:
     ```typescript
     const subscribers = new Map<number, Set<(event: RealtimeEvent) => void>>();
     ```
   - *Dampak:* Realtime hub hanya bekerja untuk **satu instance proses server**. Jika API di-scale ke beberapa instance/container (misalnya load balanced di Coolify/Docker), event yang dipublish pada Node A tidak akan terkirim ke subscriber yang terhubung di Node B. Untuk multi-instance, diperlukan broker pub/sub seperti Redis.
2. **Ketiadaan Event Replay & Durability:**
   - Server tidak menyimpan riwayat event ke database dan tidak mendukung header `Last-Event-ID`.
   - *Dampak:* Jika koneksi terputus sesaat (misal sinyal seluler drop), event yang di-publish selama masa disconnect akan hilang. Client yang terhubung kembali wajib memvalidasi ulang state atau me-refetch data profil.
3. **Prioritas Konteks Sesi & Fallback Cookie:**
   - Logika autentikasi realtime saat ini:
     ```typescript
     const employee = await getAuthenticatedProfile(request.headers, "employee");
     const admin = employee ? null : await getAuthenticatedProfile(request.headers, "admin");
     const user = employee ?? admin;
     ```
   - *Dampak:* Server selalu mengecek cookie `mkn_employee` terlebih dahulu. Jika seorang pengguna memiliki sesi karyawan dan sesi administrator aktif pada browser yang sama, tab administrator akan menggunakan identitas karyawan secara keliru. Masalah ini dijadwalkan diperbaiki pada **Tiket R01** dengan menambahkan parameter `?context=admin|employee`.
4. **Heartbeat Transport Menggunakan Event Bisnis:**
   - Keep-alive heartbeat saat ini menggunakan event bernama `notification.created` dengan teks pesan `"keep-alive"`. Hal ini mencampur layer transport dengan layer notifikasi bisnis.

---

## 4. Panduan & Contoh Implementasi Client

### 4.1. Contoh 1: Implementasi Standar JavaScript Browser (EventSource)

```javascript
/**
 * Contoh koneksi SSE murni pada browser.
 * Wajib withCredentials: true agar session cookie terkirim.
 */
function connectMknRealtime(apiUrl, loginPath = "/login") {
  const stream = new EventSource(`${apiUrl}/realtime/events`, { withCredentials: true });

  stream.addEventListener("connected", (event) => {
    const data = JSON.parse(event.data);
    console.log("[Realtime] Terhubung ke server pada:", data.occurredAt);
  });

  stream.addEventListener("access.updated", (event) => {
    const data = JSON.parse(event.data);
    console.warn("[Realtime] Hak akses diperbarui:", data.message);
    // Muat ulang aplikasi untuk menyegarkan navigasi & permission RBAC
    window.location.reload();
  });

  stream.addEventListener("session.revoked", (event) => {
    const data = JSON.parse(event.data);
    console.error("[Realtime] Sesi dicabut:", data.message);
    stream.close();
    window.location.href = loginPath;
  });

  stream.onerror = (err) => {
    console.warn("[Realtime] Koneksi terputus, browser akan otomatis mencoba menyambung ulang...", err);
  };

  return stream;
}
```

---

### 4.2. Contoh 2: React Custom Hook (`useRealtime`) untuk Next.js

```typescript
"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface RealtimeHookOptions {
  apiUrl: string;
  loginPath?: "/login" | "/admin/login";
  onAccessUpdated?: () => void;
}

export function useRealtime({ apiUrl, loginPath = "/login", onAccessUpdated }: RealtimeHookOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const router = useRouter();
  const streamRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const stream = new EventSource(`${apiUrl}/realtime/events`, { withCredentials: true });
    streamRef.current = stream;

    stream.addEventListener("connected", () => {
      setIsConnected(true);
    });

    stream.addEventListener("access.updated", () => {
      if (onAccessUpdated) {
        onAccessUpdated();
      } else {
        window.location.reload();
      }
    });

    stream.addEventListener("session.revoked", () => {
      setIsConnected(false);
      stream.close();
      router.replace(loginPath);
    });

    stream.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      stream.close();
      setIsConnected(false);
    };
  }, [apiUrl, loginPath, onAccessUpdated, router]);

  return { isConnected };
}
```

---

## 5. Prosedur Pengujian Manual (Streaming dengan cURL)

Pengujian endpoint SSE tidak dapat menggunakan request HTTP satu kali biasa karena koneksi dipertahankan terbuka.

### Prasyarat:
Pastikan Anda sudah memiliki session token yang valid dari login karyawan atau admin.

### 1. Uji Tanpa Cookie (Ekspektasi: HTTP 401 Unauthorized)
```bash
curl -i -X GET http://localhost:3001/realtime/events
```
**Hasil Aktual:**
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json;charset=utf-8

{"message":"Sesi tidak valid untuk koneksi realtime."}
```

---

### 2. Uji Terautentikasi (Ekspektasi: Header text/event-stream & Event connected)
Gunakan flag `-N` (unbuffered) dan batas waktu `-m 30` untuk melihat event inisial dan heartbeat pertama:

```bash
# Ganti dengan cookie token yang valid:
curl -N -m 30 -i -X GET http://localhost:3001/realtime/events \
  -H "Cookie: mkn_employee.session_token=P0SY5tRHXBgZDef7UaBX8x7gcE8qFngK..."
```

**Hasil Aktual Stream:**
```text
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

event: connected
data: {"occurredAt":"2026-09-09T04:18:45.125Z"}

event: notification.created
data: {"type":"notification.created","message":"keep-alive","occurredAt":"2026-09-09T04:19:10.125Z"}
```

---

## 6. Realisasi Penyempurnaan Tiket R01 (Selesai)

Seluruh rencana penyempurnaan pada tiket implementasi **R01** (*Konteks/revalidasi/cleanup SSE dan admin.users.updated*) telah selesai diimplementasikan dan diverifikasi:

1. **Parameter Konteks Eksplisit & Isolasi Ketat:**
   - Parameter query `GET /realtime/events?context=employee|admin` terisolasi ketat. Request `context=admin` menolak sesi employee dengan HTTP 401 tanpa fallback (dan sebaliknya).
2. **Event `admin.users.updated`:**
   - Event `{ type: "admin.users.updated", userId: number, occurredAt: string }` dibroadcast ke seluruh admin stream saat terjadi mutasi pengguna (`create`, `profile update`, `role update`, `status update`, `revoke sessions`).
3. **Revalidasi Sesi Berkala:**
   - Database revalidation berjalan setiap interval heartbeat 25 detik. Jika sesi dicabut dari `auth_session` atau status akun dinonaktifkan, koneksi langsung mengirimkan event `session.revoked` dan ditutup secara graceful.
4. **Pembersihan Resource (Cleanup):**
   - Blok `finally` pada asynchronous stream generator membersihkan listener memori dari set `subscribers`/`adminSubscribers` dan menghentikan timer heartbeat (zero memory leaks).
5. **Client Helper:**
   - Disediakan helper `connectRealtime(context, handlers)` pada `apps/web/lib/sse.ts` serta integrasi status koneksi pada `apps/web/components/realtime-status.tsx`.
