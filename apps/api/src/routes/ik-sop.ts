import { Elysia, t } from "elysia";
import { readdir, stat, readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { resolve, join, extname, basename, normalize } from "path";
import { getAuthenticatedProfile } from "../auth/auth";

export interface SubCategoryDef {
  id: string;
  name: string;
  category: string;
  relPath: string;
}

export interface CategoryDef {
  id: string;
  name: string;
  description: string;
  subcategories: SubCategoryDef[];
}

export const IK_SOP_STRUCTURE: CategoryDef[] = [
  {
    id: "ik-mkn",
    name: "IK MKN",
    description: "Instruksi Kerja Multi Kontrol Nusantara",
    subcategories: [
      { id: "telco", name: "Telco", category: "ik-mkn", relPath: "ik-mkn/telco" },
      { id: "osp", name: "OSP", category: "ik-mkn", relPath: "ik-mkn/osp" },
      { id: "pit", name: "PIT", category: "ik-mkn", relPath: "ik-mkn/pit" },
      { id: "hse", name: "HSE", category: "ik-mkn", relPath: "ik-mkn/hse" },
      { id: "engineer", name: "Engineer", category: "ik-mkn", relPath: "ik-mkn/engineer" },
      { id: "bengalon", name: "Bengalon", category: "ik-mkn", relPath: "ik-mkn/bengalon" },
      { id: "helpdesk", name: "Helpdesk", category: "ik-mkn", relPath: "ik-mkn/helpdesk" },
      { id: "hc", name: "HC", category: "ik-mkn", relPath: "ik-mkn/hc" },
      { id: "finance", name: "Finance", category: "ik-mkn", relPath: "ik-mkn/finance" },
      { id: "warehouse", name: "Warehouse", category: "ik-mkn", relPath: "ik-mkn/warehouse" }
    ]
  },
  {
    id: "prosedur-kpc",
    name: "Prosedure KPC",
    description: "Standar Prosedur Kaltim Prima Coal",
    subcategories: [
      { id: "peraturan", name: "Peraturan", category: "prosedur-kpc", relPath: "prosedur-kpc/peraturan" },
      { id: "training", name: "Training", category: "prosedur-kpc", relPath: "prosedur-kpc/training" },
      { id: "emergency", name: "Emergency", category: "prosedur-kpc", relPath: "prosedur-kpc/emergency" }
    ]
  }
];

function getStorageRoot(): string {
  const containerPath = "/app/storage/ik-sop";
  if (existsSync(containerPath)) return containerPath;
  const devPath = resolve(import.meta.dir, "../../../../storage/ik-sop");
  if (existsSync(devPath)) return devPath;
  return containerPath;
}

export interface DocumentItem {
  id: string;
  filename: string;
  title: string;
  category: string;
  categoryName: string;
  subCategory: string;
  subCategoryName: string;
  relPath: string;
  size: number;
  extension: string;
  modifiedAt: string;
}

async function scanSubcategoryFiles(sub: SubCategoryDef): Promise<DocumentItem[]> {
  const root = getStorageRoot();
  const dirPath = join(root, sub.relPath);
  if (!existsSync(dirPath)) return [];

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    const cat = IK_SOP_STRUCTURE.find((c) => c.id === sub.category);
    const catName = cat?.name ?? sub.category;

    const fileEntries = entries.filter(
      (e) => e.isFile() && !e.name.startsWith(".") && e.name !== ".gitkeep" && e.name.toLowerCase() !== "index.html"
    );

    const docs = await Promise.all(
      fileEntries.map(async (e) => {
        const fullPath = join(dirPath, e.name);
        const stats = await stat(fullPath);
        const ext = extname(e.name).replace(/^\./, "").toLowerCase();
        const rawBase = basename(e.name, extname(e.name));
        const cleanTitle = rawBase.replace(/_/g, " ").replace(/\s+/g, " ").trim();
        const relPath = `${sub.relPath}/${e.name}`.replace(/\\/g, "/");

        return {
          id: Buffer.from(relPath).toString("base64url"),
          filename: e.name,
          title: cleanTitle,
          category: sub.category,
          categoryName: catName,
          subCategory: sub.id,
          subCategoryName: sub.name,
          relPath,
          size: stats.size,
          extension: ext,
          modifiedAt: stats.mtime.toISOString()
        };
      })
    );

    return docs;
  } catch {
    return [];
  }
}

function getMimeType(ext: string): string {
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "doc":
      return "application/msword";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "xls":
      return "application/vnd.ms-excel";
    case "pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "ppt":
      return "application/vnd.ms-powerpoint";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "txt":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

export const ikSopRoutes = new Elysia({ prefix: "/ik-sop" })
  // 1. Structure Tree with counters
  .get("/tree", async ({ request, status }) => {
    let profile = await getAuthenticatedProfile(request.headers, "employee");
    if (!profile) profile = await getAuthenticatedProfile(request.headers, "admin");
    if (!profile) return status(401, { message: "Sesi tidak valid." });

    const tree = await Promise.all(
      IK_SOP_STRUCTURE.map(async (cat) => {
        const subcategories = await Promise.all(
          cat.subcategories.map(async (sub) => {
            const files = await scanSubcategoryFiles(sub);
            return {
              id: sub.id,
              name: sub.name,
              category: sub.category,
              relPath: sub.relPath,
              count: files.length
            };
          })
        );
        return {
          id: cat.id,
          name: cat.name,
          description: cat.description,
          subcategories
        };
      })
    );

    return { data: tree };
  })

  // 2. Document listing with optional filters
  .get(
    "/documents",
    async ({ query, request, status }) => {
      let profile = await getAuthenticatedProfile(request.headers, "employee");
      if (!profile) profile = await getAuthenticatedProfile(request.headers, "admin");
      if (!profile) return status(401, { message: "Sesi tidak valid." });

      const { category, subCategory, search } = query;
      const subcategoryPromises: Promise<DocumentItem[]>[] = [];

      for (const cat of IK_SOP_STRUCTURE) {
        if (category && cat.id !== category) continue;
        for (const sub of cat.subcategories) {
          if (subCategory && sub.id !== subCategory) continue;
          subcategoryPromises.push(scanSubcategoryFiles(sub));
        }
      }

      const results = await Promise.all(subcategoryPromises);
      let allDocs: DocumentItem[] = results.flat();

      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        allDocs = allDocs.filter(
          (d) =>
            d.filename.toLowerCase().includes(q) ||
            d.title.toLowerCase().includes(q) ||
            d.subCategoryName.toLowerCase().includes(q) ||
            d.categoryName.toLowerCase().includes(q)
        );
      }

      // Sort by modifiedAt DESC
      allDocs.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());

      return { data: allDocs, total: allDocs.length };
    },
    {
      query: t.Object({
        category: t.Optional(t.String()),
        subCategory: t.Optional(t.String()),
        search: t.Optional(t.String())
      })
    }
  )

  // 3. File Streaming & Download
  .get(
    "/documents/file",
    async ({ query, request, set, status }) => {
      let profile = await getAuthenticatedProfile(request.headers, "employee");
      if (!profile) profile = await getAuthenticatedProfile(request.headers, "admin");
      if (!profile) return status(401, { message: "Sesi tidak valid." });

      const filePathParam = query.path;
      if (!filePathParam) return status(400, { message: "Parameter path wajib diisi." });

      const root = getStorageRoot();
      const safeRelPath = normalize(filePathParam).replace(/^(\.\.[\/\\])+/, "");
      const targetPath = join(root, safeRelPath);

      // Path traversal security check
      if (!targetPath.startsWith(root)) {
        return status(403, { message: "Akses direktori dilarang." });
      }

      if (!existsSync(targetPath)) {
        return status(404, { message: "Dokumen tidak ditemukan." });
      }

      const fileStat = await stat(targetPath);
      if (!fileStat.isFile()) {
        return status(404, { message: "Dokumen tidak ditemukan." });
      }

      const ext = extname(targetPath).replace(/^\./, "").toLowerCase();
      const mime = getMimeType(ext);
      const filename = basename(targetPath);
      const disposition = query.download === "1" ? "attachment" : "inline";

      set.headers["Content-Type"] = mime;
      set.headers["Content-Disposition"] = `${disposition}; filename="${encodeURIComponent(filename)}"`;
      set.headers["Cache-Control"] = "public, max-age=3600";

      return await readFile(targetPath);
    },
    {
      query: t.Object({
        path: t.String(),
        download: t.Optional(t.String())
      })
    }
  )

  // 4. Upload document
  .post(
    "/upload",
    async ({ body, request, status }) => {
      let profile = await getAuthenticatedProfile(request.headers, "employee");
      if (!profile) profile = await getAuthenticatedProfile(request.headers, "admin");
      if (!profile) return status(401, { message: "Sesi tidak valid." });

      const { category, subCategory, file } = body;
      if (!category || !subCategory || !file) {
        return status(400, { message: "Kategori, subkategori, dan file wajib diisi." });
      }

      const catDef = IK_SOP_STRUCTURE.find((c) => c.id === category);
      const subDef = catDef?.subcategories.find((s) => s.id === subCategory);
      if (!catDef || !subDef) {
        return status(400, { message: "Kategori atau subkategori tidak valid." });
      }

      const root = getStorageRoot();
      const targetDir = join(root, subDef.relPath);
      if (!existsSync(targetDir)) {
        await mkdir(targetDir, { recursive: true });
      }

      const originalName = file.name || "dokumen";
      // Sanitize filename
      const safeName = originalName.replace(/[^\w\s\.\-\(\)]/gi, "_").trim();
      const targetFilePath = join(targetDir, safeName);

      const arrayBuffer = await file.arrayBuffer();
      await writeFile(targetFilePath, Buffer.from(arrayBuffer));

      const stats = await stat(targetFilePath);
      const ext = extname(safeName).replace(/^\./, "").toLowerCase();
      const relPath = `${subDef.relPath}/${safeName}`.replace(/\\/g, "/");

      return status(201, {
        message: "Dokumen berhasil diunggah.",
        data: {
          id: Buffer.from(relPath).toString("base64url"),
          filename: safeName,
          title: basename(safeName, extname(safeName)),
          category,
          categoryName: catDef.name,
          subCategory,
          subCategoryName: subDef.name,
          relPath,
          size: stats.size,
          extension: ext,
          modifiedAt: stats.mtime.toISOString()
        }
      });
    },
    {
      body: t.Object({
        category: t.String(),
        subCategory: t.String(),
        file: t.File({
          maxSize: "50m"
        })
      })
    }
  );
