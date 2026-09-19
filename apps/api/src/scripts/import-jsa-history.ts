import { opsTelcoJsaService } from "../services/ops-telco-jsa.service";

async function main() {
  console.log("Starting JSA historical import...");
  const res = await opsTelcoJsaService.importHistoryFromDirectory();
  console.log("Import finished:", res);
  process.exit(0);
}

main().catch(err => {
  console.error("Import failed:", err);
  process.exit(1);
});
