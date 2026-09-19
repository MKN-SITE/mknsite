export type InspectionCategoryKey =
  | "tools"
  | "special-tools"
  | "genset-tools"
  | "apd"
  | "double-lanyard"
  | "full-body-harness"
  | "katrol"
  | "padlock"
  | "pole-harness"
  | "single-lanyard"
  | "tali-karmantle"
  | "tangga";

export type FormStructureType = "inventory" | "personnel-apd" | "checklist" | "padlock";

export interface InspectionCategoryMeta {
  id: InspectionCategoryKey;
  label: string;
  badge: string;
  icon: string;
  docNo: string;
  publishDate: string;
  rev: string;
  title: string;
  subtitle: string;
  type: FormStructureType;
  defaultLocation?: string;
  defaultSubtype?: string;
  defaultItems?: Array<{
    no?: number;
    description?: string;
    merkType?: string;
    unit?: string;
    qty?: number | string;
    categoryGroup?: string;
    personil?: string;
    badgeNo?: string;
    lockSerial?: string;
    checkItem?: string;
  }>;
}

export const INSPECTION_CATEGORIES: Record<InspectionCategoryKey, InspectionCategoryMeta> = {
  tools: {
    id: "tools",
    label: "Tool",
    badge: "TL",
    icon: "🛠️",
    docNo: "FM-HSE-10-22",
    publishDate: "19 Sept. 09",
    rev: "01",
    title: "DAFTAR PERIKSA TOOLS BOX & TOOLS BOARD WAREHOUSE",
    subtitle: "Personal Toolkit Teknisi Telco Crew",
    type: "inventory",
    defaultLocation: "D-8",
    defaultItems: [
      { no: 1, description: "Tang potong besar", merkType: "Tekiro / Proskit", unit: "ea", qty: 1 },
      { no: 2, description: "Tang Kombinasi", merkType: "Tekiro / Proskit", unit: "ea", qty: 1 },
      { no: 3, description: "Tang lancip", merkType: "Tekiro", unit: "ea", qty: 1 },
      { no: 4, description: "Obeng flat kecil", merkType: "vessel", unit: "ea", qty: 1 },
      { no: 5, description: "Obeng plus kecil", merkType: "vessel", unit: "ea", qty: 1 },
      { no: 6, description: "Obeng flat besar", merkType: "vessel", unit: "ea", qty: 1 },
      { no: 7, description: "Obeng plus besar", merkType: "vessel", unit: "ea", qty: 1 },
      { no: 8, description: "Obeng flat kurus", merkType: "vessel", unit: "ea", qty: 1 },
      { no: 9, description: "Obeng plus kurus", merkType: "vessel", unit: "ea", qty: 1 },
      { no: 10, description: "Inserting Tool Krone", merkType: "Krone", unit: "ea", qty: 1 },
      { no: 11, description: "Inserting Tool Systimax", merkType: "Fluke / Vention", unit: "ea", qty: 1 },
      { no: 12, description: "Crimping disconnect", merkType: "Sanfiq", unit: "ea", qty: 1 },
      { no: 13, description: "Crimping RJ45", merkType: "Fluke", unit: "ea", qty: 1 },
      { no: 14, description: "Crimping RG 58", merkType: "Sanfiq", unit: "ea", qty: 1 },
      { no: 15, description: "Multitester Digital", merkType: "Sanwa", unit: "ea", qty: 1 },
      { no: 16, description: "Tone Generator", merkType: "Goldtools", unit: "set", qty: 1 },
      { no: 17, description: "Palu / Palu cabut paku", merkType: "Tekiro / Krisbow", unit: "ea", qty: 1 },
      { no: 18, description: "Kunci Inggris", merkType: "Krisbow / Tekiro", unit: "ea", qty: 1 },
      { no: 19, description: "Gergaji besi", merkType: "Krisbow", unit: "ea", qty: 1 },
      { no: 20, description: "Pisau / Cutter", merkType: "Tekiro / Proskit", unit: "ea", qty: 1 },
      { no: 21, description: "Meteran 5m", merkType: "Krisbow", unit: "ea", qty: 1 },
      { no: 22, description: "Kunci Torx", merkType: "Proskit", unit: "ea", qty: 1 },
      { no: 23, description: "Gembok Tools Box", merkType: "Master Lock", unit: "ea", qty: 1 },
      { no: 24, description: "Box alat / Tas", merkType: "Workpro / Stanley", unit: "ea", qty: 1 }
    ]
  },
  "special-tools": {
    id: "special-tools",
    label: "Special Tool",
    badge: "ST",
    icon: "🔬",
    docNo: "FM-HSE-10-22",
    publishDate: "19 Sept. 09",
    rev: "01",
    title: "DAFTAR PERIKSA TOOLS BOX & TOOLS BOARD WAREHOUSE",
    subtitle: "Special Tools Telco Crew (Warehouse & Mobil Ops)",
    type: "inventory",
    defaultLocation: "D-8",
    defaultItems: [
      { no: 1, description: "Laptop", merkType: "Dell", unit: "ea", qty: 4 },
      { no: 2, description: "Mata Bor", merkType: "NACHI", unit: "set", qty: 2 },
      { no: 3, description: "Bor DC", merkType: "BOSCH", unit: "set", qty: 3 },
      { no: 4, description: "Kunci Pass Ring", merkType: "TEKIRO", unit: "set", qty: 1 },
      { no: 5, description: "Kunci Shock", merkType: "TEKIRO", unit: "set", qty: 2 },
      { no: 6, description: "Cable Analyzer DSX-5000", merkType: "FLUKE", unit: "set", qty: 1 },
      { no: 7, description: "Fluke Network", merkType: "FLUKE", unit: "ea", qty: 2 },
      { no: 8, description: "Radio Tangan (HT)", merkType: "TAIT", unit: "ea", qty: 1 },
      { no: 9, description: "Senter Kepala", merkType: "NITECORE", unit: "ea", qty: 1 },
      { no: 10, description: "Label Print", merkType: "BRADY", unit: "ea", qty: 1 },
      { no: 11, description: "Fusion Splicer", merkType: "FITEL", unit: "ea", qty: 1 },
      { no: 12, description: "OTDR (FTB - 200)", merkType: "EXFO", unit: "ea", qty: 1 },
      { no: 13, description: "Katrol", merkType: "PETZL", unit: "ea", qty: 3 },
      { no: 14, description: "Full Body Harness", merkType: "KARAM", unit: "ea", qty: 4 },
      { no: 15, description: "Double Lanyard", merkType: "KARAM", unit: "ea", qty: 4 },
      { no: 16, description: "Pole Harness", merkType: "LNTL", unit: "ea", qty: 1 },
      { no: 17, description: "Single Lanyard", merkType: "KARAM", unit: "ea", qty: 2 },
      { no: 18, description: "Work Lamp + Battery + Charger Battery", merkType: "WIMPO", unit: "set", qty: 1 },
      { no: 19, description: "Webbing sling", merkType: "PETZL", unit: "ea", qty: 1 },
      { no: 20, description: "Carabiner Screw", merkType: "PETZL", unit: "ea", qty: 1 },
      { no: 21, description: "Life Jacket", merkType: "Standard", unit: "ea", qty: 1 },
      { no: 22, description: "Yes Phone", merkType: "Cino", unit: "ea", qty: 4 },
      { no: 23, description: "Baterai Eksternal", merkType: "Vivan", unit: "ea", qty: 1 },
      { no: 24, description: "GPS", merkType: "Garmin", unit: "ea", qty: 1 },
      { no: 25, description: "DB meter (Optical Power Meter)", merkType: "Deviser", unit: "ea", qty: 1 }
    ]
  },
  "genset-tools": {
    id: "genset-tools",
    label: "Genset Tool",
    badge: "GT",
    icon: "⚡",
    docNo: "FM-HSE-10-22",
    publishDate: "19 Sept. 09",
    rev: "01",
    title: "DAFTAR PERIKSA TOOLS BOX & TOOLS BOARD WAREHOUSE",
    subtitle: "Genset Maintenance Tools (Lokasi: GENSET / WKS05)",
    type: "inventory",
    defaultLocation: "GENSET",
    defaultItems: [
      { no: 1, description: "Tang potong besar", merkType: "Proskit", unit: "ea", qty: 1 },
      { no: 2, description: "Tang Kombinasi", merkType: "Proskit", unit: "ea", qty: 1 },
      { no: 3, description: "Tang lancip", merkType: "Proskit", unit: "ea", qty: 1 },
      { no: 4, description: "Palu cabut paku", merkType: "Krisbow", unit: "ea", qty: 1 },
      { no: 5, description: "Pisau / Cutter", merkType: "Joyko", unit: "ea", qty: 1 },
      { no: 6, description: "Kunci inggris 8\"", merkType: "Krisbow", unit: "ea", qty: 1 },
      { no: 7, description: "Pembuka Filter", merkType: "Standard", unit: "ea", qty: 1 },
      { no: 8, description: "Insertion Screwdriver", merkType: "Tekiro", unit: "set", qty: 1 },
      { no: 9, description: "Obeng jam", merkType: "Stanley", unit: "set", qty: 1 },
      { no: 10, description: "Tang pengupas kabel", merkType: "Prohex", unit: "ea", qty: 1 },
      { no: 11, description: "Multitester Digital", merkType: "Sanwa", unit: "ea", qty: 1 },
      { no: 12, description: "Cross Joint Piler", merkType: "Tekiro", unit: "ea", qty: 1 },
      { no: 13, description: "Gembok toolbox", merkType: "Sellery", unit: "ea", qty: 1 },
      { no: 14, description: "Crimping disconnect", merkType: "Profesional", unit: "ea", qty: 1 }
    ]
  },
  apd: {
    id: "apd",
    label: "APD",
    badge: "AP",
    icon: "🦺",
    docNo: "FM-HSE-11-02",
    publishDate: "19 Sept. 2009",
    rev: "00",
    title: "DAFTAR PERIKSA ALAT PELINDUNG DIRI ( APD )",
    subtitle: "Crew/Departement: Telco / Operations, Lokasi: D8 - Tango Delta",
    type: "personnel-apd",
    defaultLocation: "D8 - Tango Delta",
    defaultItems: [
      { no: 1, personil: "Dery Wicaksono" },
      { no: 2, personil: "M. Almauluddin Kala" },
      { no: 3, personil: "Januar" },
      { no: 4, personil: "Oneal L. P" },
      { no: 5, personil: "Indra P" },
      { no: 6, personil: "Sandi" },
      { no: 7, personil: "Asrianto" },
      { no: 8, personil: "M. Wildhan" },
      { no: 9, personil: "Imam Aulia F. A" },
      { no: 10, personil: "Michael Pardamean" }
    ]
  },
  "double-lanyard": {
    id: "double-lanyard",
    label: "Double Lanyard",
    badge: "DL",
    icon: "🪢",
    docNo: "FM-HSE-10-13",
    publishDate: "27 Oktober 2015",
    rev: "01",
    title: "DAFTAR PERIKSA FULL BODY HARNESS DAN LANYARD",
    subtitle: "Pemeriksaan Keselamatan Double Lanyard & Lifeline",
    type: "checklist",
    defaultItems: [
      { categoryGroup: "DOUBLE LANYARD", checkItem: "Periksa energi absorbing lanyard apakah ada fiber yang putus, tepi koyak, distorsi, atau berujung tajam, mencuat, retak korosi." },
      { categoryGroup: "DOUBLE LANYARD", checkItem: "Periksa connecting hook apakah berfungsi dengan baik." },
      { categoryGroup: "DOUBLE LANYARD", checkItem: "Hook gate harus dapat bergerak leluasa dan terkunci sewaktu ditutup." },
      { categoryGroup: "DOUBLE LANYARD", checkItem: "Pastikan adjuster (bila ada) bekerja dengan leluasa." },
      { categoryGroup: "DOUBLE LANYARD", checkItem: "Periksa energi absorber untuk menentukan apakah itu sudah pernah diaktifkan." },
      { categoryGroup: "DOUBLE LANYARD", checkItem: "Pastikan energi absorber cover dalam keadaan aman dan tidak tercabik atau rusak." },
      { categoryGroup: "DOUBLE LANYARD", checkItem: "Periksa semua label pengenal dan peringatan." },
      { categoryGroup: "DOUBLE LANYARD", checkItem: "Periksa setiap komponen sistem atau subsistem." },
      { categoryGroup: "DOUBLE LANYARD", checkItem: "Bila inspeksi atau pengoperasian menemukan kerusakan, segera singkirkan agar alat tidak digunakan." },
      { categoryGroup: "LIFELINE", checkItem: "Periksa Lifeline hardware apakah mengalami kerusakan, distorsi atau berujung tajam, mencuat, keretakan atau korosi." },
      { categoryGroup: "LIFELINE", checkItem: "Periksa connecting hook apakah berfungsi dengan baik." },
      { categoryGroup: "LIFELINE", checkItem: "Hook gate harus bergerak leluasa dan terkunci sewaktu ditutup." },
      { categoryGroup: "LIFELINE", checkItem: "Synthetic Rope: periksa seluruh panjang tali apakah terdapat potongan, kawat putus, lekukan tajam, menipis, keausan atau bahan kimia." },
      { categoryGroup: "LIFELINE", checkItem: "Periksa semua label pengenal dan peringatan serta komponen subsistem." }
    ]
  },
  "full-body-harness": {
    id: "full-body-harness",
    label: "Full Body Harness",
    badge: "FH",
    icon: "🦺",
    docNo: "FM-HSE-10-13",
    publishDate: "27 Oktober 2015",
    rev: "01",
    title: "DAFTAR PERIKSA FULL BODY HARNESS DAN LANYARD",
    subtitle: "Pemeriksaan Keselamatan Full Body Harness",
    type: "checklist",
    defaultItems: [
      { categoryGroup: "FULL - BODY HARNESS", checkItem: "Periksa buckle, D-ring, snap, thimble, dan wear pad. Semuanya tidak boleh cacat atau bertepi tajam, mencuat, retak atau bagian aus." },
      { categoryGroup: "FULL - BODY HARNESS", checkItem: "Pastikan buckle bekerja leluasa." },
      { categoryGroup: "FULL - BODY HARNESS", checkItem: "Semua fiber tidak koyak atau terdapat helai yang putus, tertarik jahitan, sobek, menipis, berjamur, terbakar atau pudar warnanya." },
      { categoryGroup: "FULL - BODY HARNESS", checkItem: "Periksa webbing dengan membengkokkan dan menekan pada benda bergaris tengah > 30 mm. Perhatikan apakah terdapat fiber putus." },
      { categoryGroup: "FULL - BODY HARNESS", checkItem: "Label harus ada dan terbaca dengan jelas." },
      { categoryGroup: "FULL - BODY HARNESS", checkItem: "Bersihkan dengan air dan sabun dengan benar. Simpan di tempat bersih, sejuk, gelap, kering yang tidak mengandung gas kimia." }
    ]
  },
  katrol: {
    id: "katrol",
    label: "Katrol",
    badge: "KT",
    icon: "⚙️",
    docNo: "FM-HSE-10-16",
    publishDate: "19 Sept. 2009",
    rev: "00",
    title: "DAFTAR PERIKSA KATROL (TRIWULAN INSPECTION)",
    subtitle: "Pemeriksaan Fisik Katrol, Pin, dan Kapasitas Angkat (SWL)",
    type: "checklist",
    defaultLocation: "D 8",
    defaultItems: [
      { no: 1, checkItem: "Body Katrol (tidak berkarat)" },
      { no: 2, checkItem: "Tidak Ada Retak di Body Katrol" },
      { no: 3, checkItem: "Safety Leech (berfungsi dgn baik)" },
      { no: 4, checkItem: "Pin Safety Leech" },
      { no: 5, checkItem: "Per Safety Leech" },
      { no: 6, checkItem: "Kapasitas Daya Angkat (SWL)" },
      { no: 7, checkItem: "Putaran Roda Katrol" },
      { no: 8, checkItem: "Pin Roda Katrol" }
    ]
  },
  padlock: {
    id: "padlock",
    label: "Padlock",
    badge: "PL",
    icon: "🔒",
    docNo: "FM-HSE-11-02",
    publishDate: "19 Sept. 2009",
    rev: "00",
    title: "INSPEKSI PERSONAL PADLOCK TAHUN 2026 (TRIWULAN)",
    subtitle: "Pemeriksaan Personal Padlock & Tagging Teknisi Lapangan",
    type: "padlock",
    defaultItems: [
      { no: 1, personil: "Januar Barbun Popang", badgeNo: "Z1010173", lockSerial: "81B246" },
      { no: 2, personil: "Imam Aulia", badgeNo: "Z104605", lockSerial: "1IB668" },
      { no: 3, personil: "Indra Pranata", badgeNo: "Z104603", lockSerial: "9DA394" },
      { no: 4, personil: "Dery Wicaksono", badgeNo: "Z103349", lockSerial: "21A647" },
      { no: 5, personil: "Muhammad. Almauluddin Kala", badgeNo: "Z125446", lockSerial: "21A642" },
      { no: 6, personil: "Asrianto", badgeNo: "Z128916", lockSerial: "20A142" },
      { no: 7, personil: "Michael Pardamean Batubara", badgeNo: "Z130112", lockSerial: "-" },
      { no: 8, personil: "Muhammad. Wildhan Maulana", badgeNo: "Z130115", lockSerial: "-" },
      { no: 9, personil: "Oneal Luthfianoer Permana", badgeNo: "Z130120", lockSerial: "-" },
      { no: 10, personil: "Sandi Setiawan Tanjung", badgeNo: "Z130125", lockSerial: "-" }
    ]
  },
  "pole-harness": {
    id: "pole-harness",
    label: "Pole Harness + adjust Single Lanyard",
    badge: "PH",
    icon: "🧗",
    docNo: "FM-HSE-10-13",
    publishDate: "27 Oktober 2015",
    rev: "01",
    title: "DAFTAR PERIKSA FULL BODY HARNESS DAN LANYARD",
    subtitle: "Pemeriksaan Pole Harness dan Adjustable Single Lanyard",
    type: "checklist",
    defaultItems: [
      { categoryGroup: "POLE HARNESS", checkItem: "Periksa buckle, D-ring dan ring positioning pada sabuk pinggang." },
      { categoryGroup: "POLE HARNESS", checkItem: "Periksa jahitan webbing dan bantalan pinggang (waist pad) dari aus/sobek." },
      { categoryGroup: "POLE HARNESS", checkItem: "Pastikan gesper pengunci tidak berkarat dan mengunci dengan kuat." },
      { categoryGroup: "ADJUSTABLE SINGLE LANYARD", checkItem: "Periksa rope adjuster mekanisme geser apakah mengunci secara otomatis." },
      { categoryGroup: "ADJUSTABLE SINGLE LANYARD", checkItem: "Periksa connecting carabiner / hook apakah gate menutup dan mengunci rapat." },
      { categoryGroup: "ADJUSTABLE SINGLE LANYARD", checkItem: "Periksa pelindung tali (chafing sleeve) dan thimble dari keausan." }
    ]
  },
  "single-lanyard": {
    id: "single-lanyard",
    label: "Single Lanyard",
    badge: "SL",
    icon: "🪝",
    docNo: "FM-HSE-10-13",
    publishDate: "27 Oktober 2015",
    rev: "01",
    title: "DAFTAR PERIKSA FULL BODY HARNESS DAN LANYARD",
    subtitle: "Pemeriksaan Single Lanyard & Energy Absorber",
    type: "checklist",
    defaultItems: [
      { categoryGroup: "SINGLE LANYARD", checkItem: "Periksa energi absorbing lanyard apakah ada fiber yang putus, tepi koyak, distorsi, atau berujung tajam, mencuat, retak korosi." },
      { categoryGroup: "SINGLE LANYARD", checkItem: "Periksa connecting hook apakah berfungsi dengan baik." },
      { categoryGroup: "SINGLE LANYARD", checkItem: "Hook gate harus dapat bergerak leluasa dan terkunci sewaktu ditutup." },
      { categoryGroup: "SINGLE LANYARD", checkItem: "Pastikan adjuster (bila ada) bekerja dengan leluasa." },
      { categoryGroup: "SINGLE LANYARD", checkItem: "Periksa energi absorber untuk menentukan apakah itu sudah pernah diaktifkan." },
      { categoryGroup: "SINGLE LANYARD", checkItem: "Pastikan energi absorber cover dalam keadaan aman dan tidak tercabik atau rusak." },
      { categoryGroup: "SINGLE LANYARD", checkItem: "Periksa semua label pengenal dan peringatan." },
      { categoryGroup: "SINGLE LANYARD", checkItem: "Bila inspeksi menemukan kerusakan, segera singkirkan agar tidak digunakan." }
    ]
  },
  "tali-karmantle": {
    id: "tali-karmantle",
    label: "Tali Karmantle",
    badge: "TK",
    icon: "🧶",
    docNo: "FM-HSE-10-17",
    publishDate: "19 Sept. 09",
    rev: "00",
    title: "DAFTAR PERIKSA TALI TAMBANG",
    subtitle: "Pemeriksaan Tali Tambang / Karmantle Telco Rigging & Rescue",
    type: "checklist",
    defaultItems: [
      { no: 1, checkItem: "Panjang tali yang cukup untuk digunakan" },
      { no: 2, checkItem: "Tali bebas dari oli, gemuk dan kotoran." },
      { no: 3, checkItem: "Tidak ada bagian serabut tali yang aus atau putus" },
      { no: 4, checkItem: "Tali tidak berjamur atau lembab." },
      { no: 5, checkItem: "Tidak terdapat anyaman tali yang putus." },
      { no: 6, checkItem: "Pintalan tali tidak rusak atau terlepas" },
      { no: 7, checkItem: "Rol untuk menggulung tali berfungsi dengan baik" }
    ]
  },
  tangga: {
    id: "tangga",
    label: "Tangga",
    badge: "TG",
    icon: "🪜",
    docNo: "FM-HSE-10-18",
    publishDate: "4 May 2018",
    rev: "1 (4 May 2020)",
    title: "DAFTAR PERIKSA TANGGA PORTABLE",
    subtitle: "Pemeriksaan Fisik Tangga Fiber / Aluminium dan Komponen Pengunci",
    type: "checklist",
    defaultLocation: "D8 Tango Delta",
    defaultItems: [
      { categoryGroup: "UMUM – Semua Jenis Tangga", checkItem: "Oli, Gemuk, atau kotoran Berlebihan" },
      { categoryGroup: "UMUM – Semua Jenis Tangga", checkItem: "Longgar pada pijakan atau anak tangga, paku, baut atau komponen Logam lainnya" },
      { categoryGroup: "UMUM – Semua Jenis Tangga", checkItem: "Retak, lepas, patah pada tangga, penyangga atau anak tangga" },
      { categoryGroup: "UMUM – Semua Jenis Tangga", checkItem: "Keausan pada anak tangga atau pijakan" },
      { categoryGroup: "UMUM – Semua Jenis Tangga", checkItem: "Sayatan pada tangga, penyangga, anak tangga atau pijakan" },
      { categoryGroup: "UMUM – Semua Jenis Tangga", checkItem: "Landasan anti – slip rusak atau aus" },
      { categoryGroup: "UMUM – Semua Jenis Tangga", checkItem: "Pecah dan serat kaca keluar pada tangga dari serat kaca (fiber glass)" },
      { categoryGroup: "UMUM – Semua Jenis Tangga", checkItem: "Berkarat, teroksidasi dan keausan berlebih terutama pada pijakan" },
      { categoryGroup: "UMUM – Semua Jenis Tangga", checkItem: "Label informasi yang hilang atau tidak terbaca" },
      { categoryGroup: "TANGGA YANG DAPAT DIPANJANGKAN", checkItem: "Pengunci rentangan yang longgar, patah atau hilang" },
      { categoryGroup: "TANGGA YANG DAPAT DIPANJANGKAN", checkItem: "Pengunci yang rusak yang tidak terpasang dengan baik saat Tangga dipanjangkan" },
      { categoryGroup: "TANGGA YANG DAPAT DIPANJANGKAN", checkItem: "Kurang lubrikasi pada bagian-bagian yang bergerak" },
      { categoryGroup: "TANGGA YANG DAPAT DIPANJANGKAN", checkItem: "Bantalan atau penyangga yang hilang atau rusak" },
      { categoryGroup: "TANGGA YANG DAPAT DIPANJANGKAN", checkItem: "Seling, rantai tali yang rusak" },
      { categoryGroup: "TANGGA BERPENYANGGA", checkItem: "Bantalan penyangga, batang penguat, atau penyangga engsel yang hilang atau rusak" },
      { categoryGroup: "TANGGA BERPENYANGGA", checkItem: "Perlengkapan perentang atau pengunci yang rusak atau tidak berfungsi" },
      { categoryGroup: "TANGGA BERPENYANGGA", checkItem: "Engsel atau engsel perentang yang longgar atau bengkok" }
    ]
  }
};
